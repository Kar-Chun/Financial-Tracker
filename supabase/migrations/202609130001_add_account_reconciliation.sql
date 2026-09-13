begin;

-- Reserved adjustment type already exists. Mark only this controlled writer's
-- records so cleanup never treats legacy adjustments as reconciliation data.
alter table public.transactions add column is_reconciliation boolean not null default false;
alter table public.transactions add constraint transactions_reconciliation_shape_check
  check (not is_reconciliation or (transaction_type = 'adjustment' and category_id is null));

create function public.validate_reconciliation_integrity()
returns trigger language plpgsql set search_path = ''
as $$
declare
  v_id uuid;
  v_marked boolean;
begin
  if tg_table_name = 'transactions' then v_id := new.id;
  elsif tg_op = 'DELETE' then v_id := old.transaction_id;
  else v_id := new.transaction_id;
  end if;
  select is_reconciliation into v_marked from public.transactions where id = v_id;
  if not coalesce(v_marked, false) then return null; end if;
  if (select count(*) from public.transaction_entries where transaction_id = v_id) <> 1
    or not exists (
      select 1 from public.transaction_entries e join public.accounts a on a.id = e.account_id
      join public.transactions t on t.id = e.transaction_id
      where t.id = v_id and a.account_type in ('bank', 'cash') and a.user_id = t.user_id
    ) then
    raise exception using errcode = '23514', message = 'Reconciliation requires one Bank or Cash entry.';
  end if;
  return null;
end;
$$;

create constraint trigger reconciliation_transaction_integrity
after insert or update on public.transactions deferrable initially deferred
for each row execute function public.validate_reconciliation_integrity();
create constraint trigger reconciliation_entry_integrity
after insert or update or delete on public.transaction_entries deferrable initially deferred
for each row execute function public.validate_reconciliation_integrity();

create function public.protect_reconciliation_history()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if old.is_reconciliation then
    if tg_op = 'DELETE'
      and current_setting('finance_tracker.account_delete_user_id', true) = old.user_id::text
      and exists (
        select 1 from public.transaction_entries e where e.transaction_id = old.id
        and e.account_id::text = current_setting('finance_tracker.account_delete_account_id', true)
      )
      and not exists (
        select 1 from public.transaction_entries e where e.transaction_id = old.id
        and e.account_id::text <> current_setting('finance_tracker.account_delete_account_id', true)
      ) then return old;
    end if;
    raise exception using errcode = '23514', message = 'Balance adjustments are read-only. Reconcile again to correct the balance.';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  if new.is_reconciliation then
    raise exception using errcode = '23514', message = 'Existing transactions cannot become reconciliation adjustments.';
  end if;
  return new;
end;
$$;
create trigger protect_reconciliation_history before update or delete on public.transactions
for each row execute function public.protect_reconciliation_history();

create function public.reconcile_account_balance(
  p_account_id uuid,
  p_expected_current_balance_minor bigint,
  p_actual_balance_minor bigint,
  p_expected_currency_code text,
  p_note text default null
)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_account public.accounts%rowtype;
  v_current bigint;
  v_difference bigint;
  v_today date;
  v_timezone text;
  v_transaction_id uuid;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication is required.';
  end if;
  -- Ordinary transaction create/edit/delete use the same per-user lock,
  -- including edits away from an old account and soft deletions.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('ledgerly.transaction:' || v_user_id::text, 0));
  select * into v_account from public.accounts
    where id = p_account_id and user_id = v_user_id for update;
  if not found then
    raise exception using errcode = '42501', message = 'Account not found.';
  end if;
  if v_account.archived_at is not null then
    raise exception using errcode = '22023', message = 'Archived accounts cannot be reconciled.';
  end if;
  if v_account.account_type not in ('bank', 'cash') then
    raise exception using errcode = '22023', message = 'Only Bank and Cash accounts can be reconciled.';
  end if;
  if p_actual_balance_minor is null or p_expected_current_balance_minor is null
    or abs(p_actual_balance_minor::numeric) > 9007199254740991
    or abs(p_expected_current_balance_minor::numeric) > 9007199254740991
    or char_length(btrim(coalesce(p_note, ''))) > 500 then
    raise exception using errcode = '22023', message = 'Reconciliation amount or note is invalid.';
  end if;

  select p.timezone into v_timezone from public.profiles p where p.id = v_user_id for share;
  if not found then
    raise exception using errcode = '23514', message = 'Current account balance is unavailable.';
  end if;
  v_today := (current_timestamp at time zone v_timezone)::date;
  -- Account summaries use the transaction's timestamp. If lock acquisition
  -- crossed local midnight, retry in a fresh transaction rather than reconcile
  -- against yesterday's represented state.
  if v_today <> (clock_timestamp() at time zone v_timezone)::date then
    raise exception using errcode = '40001', message = 'Account balance changed. Review the updated balance and try again.';
  end if;

  -- Reuse the existing current represented balance; no reconciliation-specific formula.
  select s.current_balance_minor into v_current from public.get_account_summaries() s where s.id = v_account.id;
  if v_current is null then
    raise exception using errcode = '23514', message = 'Current account balance is unavailable.';
  end if;
  if v_current <> p_expected_current_balance_minor
    or p_expected_currency_code is distinct from v_account.currency_code then
    raise exception using errcode = '40001', message = 'Account balance changed. Review the updated balance and try again.';
  end if;
  if abs(p_actual_balance_minor::numeric - v_current::numeric) > 9007199254740991 then
    raise exception using errcode = '22023', message = 'Reconciliation difference is too large.';
  end if;
  v_difference := p_actual_balance_minor - v_current;
  if v_difference = 0 then
    return jsonb_build_object('transaction_id', null, 'balance_minor', v_current, 'adjustment_minor', 0);
  end if;
  insert into public.transactions(user_id, transaction_type, category_id, description, transaction_date, is_reconciliation)
    values (v_user_id, 'adjustment', null, nullif(btrim(p_note), ''), v_today, true)
    returning id into v_transaction_id;
  insert into public.transaction_entries(transaction_id, account_id, amount_minor)
    values (v_transaction_id, v_account.id, v_difference);
  if v_today <> (clock_timestamp() at time zone v_timezone)::date then
    raise exception using errcode = '40001', message = 'Account balance changed. Review the updated balance and try again.';
  end if;
  perform public.refresh_snapshot_for_user(v_user_id);
  return jsonb_build_object('transaction_id', v_transaction_id, 'balance_minor', p_actual_balance_minor, 'adjustment_minor', v_difference);
end;
$$;

-- Existing ordinary mutation bodies, with a shared serialization lock and
-- explicit read-only protection for non-ordinary transactions.
create or replace function public.upsert_financial_transaction(
  p_transaction_type text,
  p_amount_minor bigint,
  p_account_id uuid,
  p_transaction_date date,
  p_category_id uuid default null,
  p_destination_account_id uuid default null,
  p_description text default null,
  p_transaction_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_source public.accounts%rowtype;
  v_destination public.accounts%rowtype;
  v_transaction_id uuid;
  v_category_type text;
  v_category_archived_at timestamptz;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('ledgerly.transaction:' || v_user_id::text, 0));

  if v_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication is required.';
  end if;

  if p_transaction_type not in ('expense', 'income', 'transfer') then
    raise exception using errcode = '22023', message = 'Transaction type is invalid for V1.';
  end if;

  if p_amount_minor is null or p_amount_minor <= 0 then
    raise exception using errcode = '22023', message = 'Amount must be greater than zero.';
  end if;

  if p_transaction_date is null then
    raise exception using errcode = '22023', message = 'Transaction date is required.';
  end if;

  select account.*
  into v_source
  from public.accounts account
  where account.id = p_account_id
    and account.user_id = v_user_id
  for update;

  if not found then
    raise exception using errcode = '42501', message = 'Source account not found.';
  end if;

  if v_source.archived_at is not null then
    raise exception using errcode = '22023', message = 'Archived accounts cannot be used.';
  end if;

  if p_transaction_type in ('expense', 'income') then
    if p_category_id is null then
      raise exception using errcode = '22023', message = 'A category is required.';
    end if;

    select category.category_type, category.archived_at
    into v_category_type, v_category_archived_at
    from public.categories category
    where category.id = p_category_id
      and category.user_id = v_user_id;

    if not found then
      raise exception using errcode = '42501', message = 'Category not found.';
    end if;

    if v_category_archived_at is not null then
      raise exception using errcode = '22023', message = 'Archived categories cannot be used.';
    end if;

    if v_category_type <> p_transaction_type then
      raise exception using errcode = '22023', message = 'Category type does not match the transaction.';
    end if;
  else
    if p_destination_account_id is null then
      raise exception using errcode = '22023', message = 'A destination account is required.';
    end if;

    if p_destination_account_id = p_account_id then
      raise exception using errcode = '22023', message = 'Transfer accounts must be different.';
    end if;

    select account.*
    into v_destination
    from public.accounts account
    where account.id = p_destination_account_id
      and account.user_id = v_user_id
    for update;

    if not found then
      raise exception using errcode = '42501', message = 'Destination account not found.';
    end if;

    if v_destination.archived_at is not null then
      raise exception using errcode = '22023', message = 'Archived accounts cannot be used.';
    end if;

    if v_source.currency_code <> v_destination.currency_code then
      raise exception using
        errcode = '22023',
        message = 'Cross-currency transfers are not supported in V1.';
    end if;
  end if;

  if p_transaction_id is null then
    insert into public.transactions (
      user_id,
      transaction_type,
      category_id,
      description,
      transaction_date
    )
    values (
      v_user_id,
      p_transaction_type,
      case when p_transaction_type = 'transfer' then null else p_category_id end,
      nullif(btrim(p_description), ''),
      p_transaction_date
    )
    returning id into v_transaction_id;
  else
    select transaction_record.id
    into v_transaction_id
    from public.transactions transaction_record
    where transaction_record.id = p_transaction_id
      and transaction_record.user_id = v_user_id
      and transaction_record.deleted_at is null
    for update;

    if not found then
      raise exception using errcode = '42501', message = 'Transaction not found.';
    end if;

    if exists (select 1 from public.transactions where id = v_transaction_id and is_reconciliation) then
      raise exception using errcode = '23514', message = 'Balance adjustments are read-only. Reconcile again to correct the balance.';
    end if;

    update public.transactions
    set
      transaction_type = p_transaction_type,
      category_id = case when p_transaction_type = 'transfer' then null else p_category_id end,
      description = nullif(btrim(p_description), ''),
      transaction_date = p_transaction_date
    where id = v_transaction_id;

    delete from public.transaction_entries
    where transaction_id = v_transaction_id;
  end if;

  if p_transaction_type = 'expense' then
    insert into public.transaction_entries (transaction_id, account_id, amount_minor)
    values (v_transaction_id, p_account_id, -p_amount_minor);
  elsif p_transaction_type = 'income' then
    insert into public.transaction_entries (transaction_id, account_id, amount_minor)
    values (v_transaction_id, p_account_id, p_amount_minor);
  else
    insert into public.transaction_entries (transaction_id, account_id, amount_minor)
    values
      (v_transaction_id, p_account_id, -p_amount_minor),
      (v_transaction_id, p_destination_account_id, p_amount_minor);
  end if;

  perform public.refresh_snapshot_for_user(v_user_id);
  return v_transaction_id;
end;
$$;

create or replace function public.soft_delete_transaction(p_transaction_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('ledgerly.transaction:' || v_user_id::text, 0));

  if v_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication is required.';
  end if;

  if exists (select 1 from public.transactions where id = p_transaction_id and user_id = v_user_id and is_reconciliation) then
    raise exception using errcode = '23514', message = 'Balance adjustments are read-only. Reconcile again to correct the balance.';
  end if;

  update public.transactions
  set deleted_at = now()
  where id = p_transaction_id
    and user_id = v_user_id
    and deleted_at is null;

  if not found then
    raise exception using errcode = '42501', message = 'Transaction not found.';
  end if;

  perform public.refresh_snapshot_for_user(v_user_id);
end;
$$;


-- Existing scoped investment cleanup stays intact. Only marked reconciliation
-- history receives a new, single-account purge exception.
create or replace function public.delete_account_permanently(p_account_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_account public.accounts%rowtype;
  v_active_transaction_count integer := 0;
  v_deleted_transaction_count integer := 0;
  v_reconciliation_count integer := 0;
  v_valuation_count integer := 0;
  v_holding_count integer := 0;
  v_trade_count integer := 0;
  v_price_count integer := 0;
  v_cash_event_count integer := 0;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('ledgerly.transaction:' || v_user_id::text, 0));

  if v_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication is required.';
  end if;

  select account.*
  into v_account
  from public.accounts account
  where account.id = p_account_id
    and account.user_id = v_user_id
  for update;

  if not found then
    raise exception using errcode = '42501', message = 'Account not found.';
  end if;

  select count(distinct transaction_record.id)::integer
  into v_active_transaction_count
  from public.transaction_entries entry
  join public.transactions transaction_record
    on transaction_record.id = entry.transaction_id
  where entry.account_id = v_account.id
    and transaction_record.user_id = v_user_id
    and transaction_record.deleted_at is null
    and not transaction_record.is_reconciliation;

  if v_active_transaction_count > 0 then
    raise exception using
      errcode = '23503',
      message = format(
        'Account is used by %s active transaction%s.',
        v_active_transaction_count,
        case when v_active_transaction_count = 1 then '' else 's' end
      );
  end if;

  -- Only explicitly marked single-account reconciliation history is removable.
  -- Legacy/general adjustments remain protected as active financial history.
  if exists (
    select 1 from public.transactions t join public.transaction_entries e on e.transaction_id = t.id
    where e.account_id = v_account.id and t.is_reconciliation
      and (t.user_id <> v_user_id or exists (
        select 1 from public.transaction_entries other_entry
        where other_entry.transaction_id = t.id and other_entry.account_id <> v_account.id
      ))
  ) then
    raise exception using errcode = '23514', message = 'Account cleanup cannot remove shared adjustment history.';
  end if;
  perform set_config('finance_tracker.account_delete_user_id', v_user_id::text, true);
  perform set_config('finance_tracker.account_delete_account_id', v_account.id::text, true);

  with removed as (
    delete from public.transactions t
    where t.user_id = v_user_id and t.is_reconciliation
      and exists (select 1 from public.transaction_entries e where e.transaction_id = t.id and e.account_id = v_account.id)
    returning t.id
  )
  select count(*)::integer into v_reconciliation_count from removed;

  -- A complete already-soft-deleted transaction is purged, including every
  -- entry in a deleted transfer. Those rows are already excluded everywhere.
  with removed as (
    delete from public.transactions transaction_record
    where transaction_record.user_id = v_user_id
      and transaction_record.deleted_at is not null
      and exists (
        select 1
        from public.transaction_entries entry
        where entry.transaction_id = transaction_record.id
          and entry.account_id = v_account.id
      )
    returning transaction_record.id
  )
  select count(*)::integer into v_deleted_transaction_count from removed;

  -- Permit immutable ledger deletion only for this authenticated user's locked
  -- account and only for the duration of this database transaction.
  perform set_config('finance_tracker.account_delete_user_id', v_user_id::text, true);
  perform set_config('finance_tracker.account_delete_account_id', v_account.id::text, true);

  with removed as (
    delete from public.investment_prices price
    using public.investment_holdings holding
    where price.holding_id = holding.id
      and holding.account_id = v_account.id
      and holding.user_id = v_user_id
    returning price.id
  )
  select count(*)::integer into v_price_count from removed;

  with removed as (
    delete from public.investment_trades trade
    where trade.account_id = v_account.id
      and trade.user_id = v_user_id
    returning trade.id
  )
  select count(*)::integer into v_trade_count from removed;

  with removed as (
    delete from public.investment_cash_events cash_event
    where cash_event.account_id = v_account.id
      and cash_event.user_id = v_user_id
    returning cash_event.id
  )
  select count(*)::integer into v_cash_event_count from removed;

  with removed as (
    delete from public.investment_holdings holding
    where holding.account_id = v_account.id
      and holding.user_id = v_user_id
    returning holding.id
  )
  select count(*)::integer into v_holding_count from removed;

  with removed as (
    delete from public.investment_valuations valuation
    where valuation.account_id = v_account.id
      and valuation.user_id = v_user_id
    returning valuation.id
  )
  select count(*)::integer into v_valuation_count from removed;

  delete from public.accounts account
  where account.id = v_account.id
    and account.user_id = v_user_id;

  if not found then
    raise exception using errcode = '42501', message = 'Account could not be deleted.';
  end if;

  perform set_config('finance_tracker.account_delete_user_id', '', true);
  perform set_config('finance_tracker.account_delete_account_id', '', true);
  perform public.refresh_snapshot_for_user(v_user_id);

  return jsonb_build_object(
    'account_id', v_account.id,
    'reconciliations_purged', v_reconciliation_count,
    'soft_deleted_transactions_purged', v_deleted_transaction_count,
    'investment_valuations_deleted', v_valuation_count,
    'investment_holdings_deleted', v_holding_count,
    'investment_trades_deleted', v_trade_count,
    'investment_prices_deleted', v_price_count,
    'investment_cash_events_deleted', v_cash_event_count
  );
end;
$$;


revoke all on function public.validate_reconciliation_integrity() from public, anon, authenticated;
revoke all on function public.protect_reconciliation_history() from public, anon, authenticated;
revoke all on function public.reconcile_account_balance(uuid, bigint, bigint, text, text) from public, anon;
grant execute on function public.reconcile_account_balance(uuid, bigint, bigint, text, text) to authenticated;
-- CREATE OR REPLACE preserves existing grants; restate the authenticated-only boundary.
revoke all on function public.upsert_financial_transaction(text, bigint, uuid, date, uuid, uuid, text, uuid) from public, anon;
revoke all on function public.soft_delete_transaction(uuid) from public, anon;
revoke all on function public.delete_account_permanently(uuid) from public, anon;
grant execute on function public.upsert_financial_transaction(text, bigint, uuid, date, uuid, uuid, text, uuid) to authenticated;
grant execute on function public.soft_delete_transaction(uuid) to authenticated;
grant execute on function public.delete_account_permanently(uuid) to authenticated;

commit;
