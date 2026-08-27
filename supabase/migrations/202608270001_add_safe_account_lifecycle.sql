begin;

-- Ledger rows stay immutable during normal operation. The permanent account
-- deletion RPC sets both transaction-local values before removing rows that
-- belong to the locked account.
create or replace function public.prevent_investment_ledger_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE'
    and current_setting('finance_tracker.account_delete_user_id', true) = old.user_id::text
    and current_setting('finance_tracker.account_delete_account_id', true) = old.account_id::text
  then
    return old;
  end if;

  raise exception 'Investment ledger entries are immutable. Record a controlled correction instead.';
end;
$$;

create or replace function public.archive_account(p_account_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_account public.accounts%rowtype;
  v_local_date date;
  v_current_minor bigint;
  v_native_minor bigint;
  v_base_minor bigint;
begin
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

  if v_account.archived_at is not null then
    return;
  end if;

  select (clock_timestamp() at time zone profile.timezone)::date
  into v_local_date
  from public.profiles profile
  where profile.id = v_user_id;

  if exists (
    select 1
    from public.transaction_entries entry
    join public.transactions transaction_record
      on transaction_record.id = entry.transaction_id
    where entry.account_id = v_account.id
      and transaction_record.deleted_at is null
      and transaction_record.transaction_date > v_local_date
  ) then
    raise exception using errcode = '23514', message = 'An account with future transactions cannot be archived.';
  end if;

  if v_account.account_type in ('bank', 'cash') then
    select v_account.opening_balance_minor
      + coalesce(sum(entry.amount_minor), 0)::bigint
    into v_current_minor
    from public.transaction_entries entry
    join public.transactions transaction_record
      on transaction_record.id = entry.transaction_id
    where entry.account_id = v_account.id
      and transaction_record.deleted_at is null
      and transaction_record.transaction_date <= v_local_date;

    if v_current_minor <> 0 then
      raise exception using
        errcode = '23514',
        message = 'Account represented value must be zero before archiving.';
    end if;
  elsif v_account.investment_tracking_mode = 'detailed' then
    select represented.native_value_minor
    into v_native_minor
    from public.get_detailed_investment_value(v_account.id, v_local_date) represented;

    if v_native_minor is null then
      raise exception using
        errcode = '23514',
        message = 'Account represented value must be available before archiving.';
    end if;

    if v_native_minor <> 0 then
      raise exception using
        errcode = '23514',
        message = 'Account represented value must be zero before archiving.';
    end if;
  else
    -- Active Simple investment summaries already implement latest valuation
    -- plus qualifying post-valuation transfers. Reuse that exact formula.
    select summary.native_value_minor, summary.base_value_minor
    into v_native_minor, v_base_minor
    from public.get_account_summaries() summary
    where summary.id = v_account.id;

    if coalesce(v_native_minor, 0) <> 0 or coalesce(v_base_minor, 0) <> 0 then
      raise exception using
        errcode = '23514',
        message = 'Account represented value must be zero before archiving.';
    end if;
  end if;

  update public.accounts
  set archived_at = clock_timestamp()
  where id = v_account.id;

  perform public.refresh_snapshot_for_user(v_user_id);
end;
$$;

create or replace function public.restore_account(p_account_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_account public.accounts%rowtype;
begin
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

  if v_account.archived_at is null then
    return;
  end if;

  update public.accounts
  set archived_at = null
  where id = v_account.id;

  perform public.refresh_snapshot_for_user(v_user_id);
end;
$$;

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
  v_valuation_count integer := 0;
  v_holding_count integer := 0;
  v_trade_count integer := 0;
  v_price_count integer := 0;
  v_cash_event_count integer := 0;
begin
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
    and transaction_record.deleted_at is null;

  if v_active_transaction_count > 0 then
    raise exception using
      errcode = '23503',
      message = format(
        'Account is used by %s active transaction%s.',
        v_active_transaction_count,
        case when v_active_transaction_count = 1 then '' else 's' end
      );
  end if;

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
    'soft_deleted_transactions_purged', v_deleted_transaction_count,
    'investment_valuations_deleted', v_valuation_count,
    'investment_holdings_deleted', v_holding_count,
    'investment_trades_deleted', v_trade_count,
    'investment_prices_deleted', v_price_count,
    'investment_cash_events_deleted', v_cash_event_count
  );
end;
$$;

revoke all on function public.prevent_investment_ledger_mutation() from public, anon, authenticated;
revoke all on function public.archive_account(uuid) from public, anon;
revoke all on function public.restore_account(uuid) from public, anon;
revoke all on function public.delete_account_permanently(uuid) from public, anon;

grant execute on function public.archive_account(uuid) to authenticated;
grant execute on function public.restore_account(uuid) to authenticated;
grant execute on function public.delete_account_permanently(uuid) to authenticated;

commit;
