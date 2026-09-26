-- Security Remediation Phase 1 only. Existing rows are not rewritten.
begin;

-- Internal boundary validation. Returning the original NUMERIC preserves exact input;
-- trunc is used only for comparison, never to coerce an unsupported value.
create or replace function public.validate_investment_numeric(
  p_value text, p_scale integer, p_allow_zero boolean default false
)
returns numeric
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_value numeric;
begin
  if p_value is null or p_scale is null or p_scale not in (10, 12) or p_allow_zero is null then
    raise exception using errcode = '22023', message = 'Investment number is outside the supported precision or range.';
  end if;
  begin
    v_value := p_value::numeric;
  exception when invalid_text_representation or numeric_value_out_of_range then
    raise exception using errcode = '22023', message = 'Investment number is outside the supported precision or range.';
  end;
  -- PostgreSQL NUMERIC NaN compares greater than finite values. Check explicitly
  -- before comparisons/arithmetic; isfinite(numeric) is not a PostgreSQL function.
  if v_value::text in ('NaN', 'Infinity', '-Infinity') then
    raise exception using errcode = '22023', message = 'Investment number must be finite.';
  end if;
  if v_value < 0 or (not p_allow_zero and v_value = 0) then
    raise exception using errcode = '22023', message = 'Investment number must be positive (opening average cost may be zero).';
  end if;
  if v_value >= pg_catalog.power(10::numeric, (30 - p_scale)::numeric)
    or v_value <> pg_catalog.trunc(v_value, p_scale) then
    raise exception using errcode = '22023', message = 'Investment number is outside the supported precision or range.';
  end if;
  return v_value;
end;
$$;

create or replace function public.validate_opening_investment_numbers(p_holdings jsonb)
returns void
language plpgsql
immutable
set search_path = ''
as $$
declare v_item jsonb;
begin
  if jsonb_typeof(coalesce(p_holdings, '[]'::jsonb)) <> 'array' then
    raise exception using errcode = '22023', message = 'Opening holdings must be an array.';
  end if;
  for v_item in select value from jsonb_array_elements(coalesce(p_holdings, '[]'::jsonb)) loop
    perform public.validate_investment_numeric(v_item->>'quantity', 10);
    perform public.validate_investment_numeric(v_item->>'average_cost', 10, true);
    perform public.validate_investment_numeric(v_item->>'current_price', 10);
  end loop;
end;
$$;

revoke all on function public.validate_investment_numeric(text, integer, boolean),
  public.validate_opening_investment_numbers(jsonb) from public, anon, authenticated;

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
    if v_source.account_type not in ('bank', 'cash') then
      raise exception using errcode = '22023', message = 'Expense and Income require a Bank or Cash account.';
    end if;

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

create or replace function public.validate_transaction_integrity()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_transaction_id uuid;
  v_type text;
  v_user_id uuid;
  v_category_id uuid;
  v_deleted_at timestamptz;
  v_entry_count integer;
  v_account_count integer;
  v_currency_count integer;
  v_amount_total numeric;
  v_all_negative boolean;
  v_all_positive boolean;
begin
  if tg_table_name = 'transactions' then
    v_transaction_id := new.id;
  elsif tg_op = 'DELETE' then
    v_transaction_id := old.transaction_id;
  else
    v_transaction_id := new.transaction_id;
  end if;

  select transaction_type, user_id, category_id, deleted_at
  into v_type, v_user_id, v_category_id, v_deleted_at
  from public.transactions
  where id = v_transaction_id;

  if not found or v_deleted_at is not null then
    return null;
  end if;

  select
    count(*)::integer,
    count(distinct entry.account_id)::integer,
    count(distinct account.currency_code)::integer,
    coalesce(sum(entry.amount_minor), 0),
    bool_and(entry.amount_minor < 0),
    bool_and(entry.amount_minor > 0)
  into
    v_entry_count,
    v_account_count,
    v_currency_count,
    v_amount_total,
    v_all_negative,
    v_all_positive
  from public.transaction_entries entry
  join public.accounts account on account.id = entry.account_id
  where entry.transaction_id = v_transaction_id;

  if v_type in ('expense', 'income') and exists (
    select 1 from public.transaction_entries entry
    join public.accounts account on account.id = entry.account_id
    where entry.transaction_id = v_transaction_id
      and account.account_type not in ('bank', 'cash')
  ) then
    raise exception using errcode = '23514', message = 'Expense and Income require a Bank or Cash account.';
  end if;

  if v_type = 'expense' then
    if v_category_id is null or not exists (
      select 1
      from public.categories category
      where category.id = v_category_id
        and category.user_id = v_user_id
        and category.category_type = 'expense'
        and category.archived_at is null
    ) then
      raise exception using errcode = '23514', message = 'An active expense category is required.';
    end if;

    if v_entry_count <> 1 or not coalesce(v_all_negative, false) then
      raise exception using errcode = '23514', message = 'An expense must contain one negative entry.';
    end if;
  elsif v_type = 'income' then
    if v_category_id is null or not exists (
      select 1
      from public.categories category
      where category.id = v_category_id
        and category.user_id = v_user_id
        and category.category_type = 'income'
        and category.archived_at is null
    ) then
      raise exception using errcode = '23514', message = 'An active income category is required.';
    end if;

    if v_entry_count <> 1 or not coalesce(v_all_positive, false) then
      raise exception using errcode = '23514', message = 'Income must contain one positive entry.';
    end if;
  elsif v_type = 'transfer' then
    if v_category_id is not null then
      raise exception using errcode = '23514', message = 'A transfer cannot have a category.';
    end if;

    if v_entry_count <> 2
      or v_account_count <> 2
      or v_currency_count <> 1
      or v_amount_total <> 0
    then
      raise exception using
        errcode = '23514',
        message = 'A transfer requires two opposite same-currency entries.';
    end if;
  elsif v_entry_count = 0 then
    raise exception using
      errcode = '23514',
      message = 'A financial transaction must contain at least one entry.';
  end if;

  return null;
end;
$$;

create or replace function public.get_eligible_expense_facts(
  p_start_date date,
  p_end_date date
)
returns table (
  transaction_id uuid,
  transaction_date date,
  amount_minor bigint,
  category_id uuid,
  category_name text,
  category_parent_id uuid,
  root_category_id uuid,
  root_category_name text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_base_currency text;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication is required.';
  end if;

  if p_start_date is null or p_end_date is null or p_end_date < p_start_date then
    raise exception using errcode = '22023', message = 'Eligible spending date range is invalid.';
  end if;

  select profile.base_currency
  into v_base_currency
  from public.profiles profile
  where profile.id = v_user_id;

  if not found then
    raise exception using errcode = 'P0001', message = 'A user profile is required.';
  end if;

  return query
  select
    transaction_record.id,
    transaction_record.transaction_date,
    (-entry.amount_minor)::bigint,
    category.id,
    category.name,
    category.parent_id,
    coalesce(parent.id, category.id),
    coalesce(parent.name, category.name)
  from public.transactions transaction_record
  join public.transaction_entries entry
    on entry.transaction_id = transaction_record.id
  join public.accounts account
    on account.id = entry.account_id
    and account.user_id = v_user_id
    and account.currency_code = v_base_currency
    and account.account_type in ('bank', 'cash')
  left join public.categories category
    on category.id = transaction_record.category_id
    and category.user_id = v_user_id
  left join public.categories parent
    on parent.id = category.parent_id
    and parent.user_id = v_user_id
  where transaction_record.user_id = v_user_id
    and transaction_record.transaction_type = 'expense'
    and transaction_record.deleted_at is null
    and transaction_record.transaction_date between p_start_date and p_end_date;
end;
$$;

create or replace function public.preview_detailed_investment_conversion(
  p_account_id uuid,
  p_opening_cash_minor bigint,
  p_holdings jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid(); v_account public.accounts%rowtype; v_item jsonb;
  v_detailed_value bigint; v_old_value bigint; v_quantity numeric; v_price numeric;
begin
  if v_user_id is null then raise exception 'Authentication required.'; end if;
  select * into v_account from public.accounts where id = p_account_id and user_id = v_user_id;
  if v_account.id is null or v_account.account_type <> 'investment' or v_account.investment_tracking_mode <> 'simple' then raise exception 'A Simple investment account is required.'; end if;
  if p_opening_cash_minor is null or p_opening_cash_minor < 0 then raise exception 'Opening broker cash cannot be negative.'; end if;
  perform public.validate_opening_investment_numbers(p_holdings);
  v_detailed_value := p_opening_cash_minor;
  for v_item in select value from jsonb_array_elements(coalesce(p_holdings, '[]'::jsonb)) loop
    v_quantity := (v_item->>'quantity')::numeric; v_price := (v_item->>'current_price')::numeric;
    if v_quantity <= 0 or v_price <= 0 then raise exception 'Opening quantities and prices must be positive.'; end if;
    v_detailed_value := v_detailed_value + round(v_quantity * v_price * public.investment_currency_scale(v_account.currency_code))::bigint;
  end loop;
  select coalesce(native_value_minor, 0) into v_old_value from public.get_account_summaries() where id = p_account_id;
  return jsonb_build_object('simple_native_value_minor', coalesce(v_old_value, 0), 'detailed_native_value_minor', v_detailed_value, 'difference_minor', v_detailed_value - coalesce(v_old_value, 0), 'currency_code', v_account.currency_code);
end;
$$;

create or replace function public.enable_detailed_investment_tracking(
  p_account_id uuid,
  p_started_on date,
  p_opening_cash_minor bigint,
  p_holdings jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid(); v_account public.accounts%rowtype; v_today date; v_item jsonb;
  v_holding_id uuid; v_quantity numeric; v_average_cost numeric; v_current_price numeric;
  v_symbol text; v_name text; v_asset_type text; v_basis bigint;
begin
  if v_user_id is null then raise exception 'Authentication required.'; end if;
  select account.* into v_account from public.accounts account where account.id = p_account_id and account.user_id = v_user_id for update;
  if v_account.id is null or v_account.account_type <> 'investment' then raise exception 'Investment account not found.'; end if;
  if v_account.archived_at is not null then raise exception 'Archived accounts cannot enable detailed tracking.'; end if;
  if v_account.investment_tracking_mode <> 'simple' then raise exception 'Detailed tracking is already enabled.'; end if;
  select (now() at time zone timezone)::date into v_today from public.profiles where id = v_user_id;
  if p_started_on is null or p_started_on > v_today then raise exception 'Detailed tracking start date cannot be in the future.'; end if;
  if p_opening_cash_minor is null or p_opening_cash_minor < 0 then raise exception 'Opening broker cash cannot be negative.'; end if;
  if jsonb_typeof(coalesce(p_holdings, '[]'::jsonb)) <> 'array' then raise exception 'Opening holdings must be an array.'; end if;

  -- Validate the complete batch before changing the account or any ledger row.
  perform public.validate_opening_investment_numbers(p_holdings);

  update public.accounts set investment_tracking_mode = 'detailed', detailed_started_on = p_started_on, detailed_started_at = clock_timestamp() where id = v_account.id;
  insert into public.investment_cash_events(account_id, user_id, event_type, amount_minor, event_date, note)
  values(v_account.id, v_user_id, 'opening_cash', p_opening_cash_minor, p_started_on, 'Detailed tracking opening cash');

  for v_item in select value from jsonb_array_elements(coalesce(p_holdings, '[]'::jsonb)) loop
    v_symbol := upper(btrim(coalesce(v_item->>'symbol', ''))); v_name := btrim(coalesce(v_item->>'name', ''));
    v_asset_type := lower(coalesce(v_item->>'asset_type', 'other'));
    v_quantity := (v_item->>'quantity')::numeric; v_average_cost := (v_item->>'average_cost')::numeric; v_current_price := (v_item->>'current_price')::numeric;
    if char_length(v_symbol) not between 1 and 20 or char_length(v_name) not between 1 and 120 then raise exception 'Each opening holding requires a symbol and name.'; end if;
    if v_asset_type not in ('stock', 'etf', 'fund', 'other') then raise exception 'Opening holding asset type is invalid.'; end if;
    if v_quantity <= 0 or v_average_cost < 0 or v_current_price <= 0 then raise exception 'Opening holding values are invalid.'; end if;
    insert into public.investment_holdings(account_id, user_id, symbol, name, asset_type, currency_code)
    values(v_account.id, v_user_id, v_symbol, v_name, v_asset_type, v_account.currency_code) returning id into v_holding_id;
    v_basis := round(v_quantity * v_average_cost * public.investment_currency_scale(v_account.currency_code))::bigint;
    insert into public.investment_trades(holding_id, account_id, user_id, trade_type, quantity, unit_price, fee_minor, cash_effect_minor, cost_basis_effect_minor, realized_gain_minor, trade_date, note)
    values(v_holding_id, v_account.id, v_user_id, 'opening_position', v_quantity, v_average_cost, 0, 0, v_basis, 0, p_started_on, 'Opening position');
    insert into public.investment_prices(holding_id, user_id, price, priced_at)
    values(v_holding_id, v_user_id, v_current_price, p_started_on);
  end loop;
  perform public.refresh_snapshot_for_user(v_user_id);
  return v_account.id;
end;
$$;

create or replace function public.record_investment_trade(
  p_account_id uuid, p_holding_id uuid, p_trade_type text, p_quantity numeric,
  p_unit_price numeric, p_fee_minor bigint, p_trade_date date, p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid(); v_account public.accounts%rowtype; v_holding public.investment_holdings%rowtype;
  v_today date; v_current_quantity numeric; v_current_basis bigint; v_broker_cash bigint;
  v_gross bigint; v_cash_effect bigint; v_basis_effect bigint; v_realized bigint; v_trade_id uuid; v_latest_trade date;
begin
  if v_user_id is null then raise exception 'Authentication required.'; end if;
  if p_trade_type not in ('buy', 'sell') then raise exception 'Trade type must be buy or sell.'; end if;
  perform public.validate_investment_numeric(p_quantity::text, 10);
  perform public.validate_investment_numeric(p_unit_price::text, 10);
  if p_quantity is null or p_quantity <= 0 or p_unit_price is null or p_unit_price <= 0 then raise exception 'Quantity and unit price must be positive.'; end if;
  if p_fee_minor is null or p_fee_minor < 0 then raise exception 'Trade fee cannot be negative.'; end if;
  if p_note is not null and char_length(btrim(p_note)) > 300 then raise exception 'Trade note is too long.'; end if;
  select * into v_account from public.accounts where id = p_account_id and user_id = v_user_id for update;
  if v_account.id is null or v_account.account_type <> 'investment' or v_account.investment_tracking_mode <> 'detailed' or v_account.archived_at is not null then raise exception 'Detailed investment account not found.'; end if;
  select * into v_holding from public.investment_holdings where id = p_holding_id and account_id = v_account.id and user_id = v_user_id and archived_at is null for update;
  if v_holding.id is null or v_holding.currency_code <> v_account.currency_code then raise exception 'Holding not found for this account.'; end if;
  select (now() at time zone timezone)::date into v_today from public.profiles where id = v_user_id;
  if p_trade_date is null or p_trade_date < v_account.detailed_started_on or p_trade_date > v_today then raise exception 'Trade date is outside the detailed tracking period.'; end if;
  select max(trade_date) into v_latest_trade from public.investment_trades where account_id = v_account.id;
  if v_latest_trade is not null and p_trade_date < v_latest_trade then raise exception 'Trades must be appended in date order.'; end if;
  select coalesce(sum(case when trade_type = 'sell' then -quantity else quantity end), 0)::numeric,
    coalesce(sum(cost_basis_effect_minor), 0)::bigint
  into v_current_quantity, v_current_basis from public.investment_trades where holding_id = v_holding.id;
  select broker_cash_minor into v_broker_cash from public.get_detailed_investment_value(v_account.id, p_trade_date);
  v_gross := round(p_quantity * p_unit_price * public.investment_currency_scale(v_account.currency_code))::bigint;
  if p_trade_type = 'buy' then
    v_cash_effect := -(v_gross + p_fee_minor); v_basis_effect := v_gross + p_fee_minor; v_realized := 0;
    if v_broker_cash + v_cash_effect < 0 then raise exception 'Insufficient broker cash for this buy.'; end if;
  else
    if p_quantity > v_current_quantity then raise exception 'Cannot sell more quantity than currently owned.'; end if;
    if p_fee_minor > v_gross then raise exception 'Sale fee cannot exceed sale proceeds.'; end if;
    v_cash_effect := v_gross - p_fee_minor;
    v_basis_effect := -round(v_current_basis::numeric * p_quantity / v_current_quantity)::bigint;
    v_realized := v_cash_effect + v_basis_effect;
  end if;
  insert into public.investment_trades(holding_id, account_id, user_id, trade_type, quantity, unit_price, fee_minor, cash_effect_minor, cost_basis_effect_minor, realized_gain_minor, trade_date, note)
  values(v_holding.id, v_account.id, v_user_id, p_trade_type, p_quantity, p_unit_price, p_fee_minor, v_cash_effect, v_basis_effect, v_realized, p_trade_date, nullif(btrim(p_note), '')) returning id into v_trade_id;
  perform public.refresh_snapshot_for_user(v_user_id);
  return v_trade_id;
end;
$$;

create or replace function public.update_investment_prices(p_account_id uuid, p_priced_at date, p_prices jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare v_user_id uuid := auth.uid(); v_account public.accounts%rowtype; v_today date; v_item jsonb; v_holding_id uuid; v_price numeric; v_count integer := 0;
begin
  if v_user_id is null then raise exception 'Authentication required.'; end if;
  select * into v_account from public.accounts where id = p_account_id and user_id = v_user_id and account_type = 'investment' and investment_tracking_mode = 'detailed' and archived_at is null for update;
  if v_account.id is null then raise exception 'Detailed investment account not found.'; end if;
  select (now() at time zone timezone)::date into v_today from public.profiles where id = v_user_id;
  if p_priced_at is null or p_priced_at < v_account.detailed_started_on or p_priced_at > v_today then raise exception 'Price date is outside the detailed tracking period.'; end if;
  if jsonb_typeof(p_prices) <> 'array' or jsonb_array_length(p_prices) = 0 then raise exception 'At least one price is required.'; end if;
  -- Validate every price before storing any price in the batch.
  for v_item in select value from jsonb_array_elements(p_prices) loop
    perform public.validate_investment_numeric(v_item->>'price', 10);
  end loop;
  for v_item in select value from jsonb_array_elements(p_prices) loop
    v_holding_id := (v_item->>'holding_id')::uuid; v_price := (v_item->>'price')::numeric;
    if v_price <= 0 or not exists(select 1 from public.investment_holdings where id = v_holding_id and account_id = v_account.id and user_id = v_user_id and archived_at is null) then raise exception 'Price update contains an invalid holding or price.'; end if;
    insert into public.investment_prices(holding_id, user_id, price, priced_at)
    values(v_holding_id, v_user_id, v_price, p_priced_at)
    on conflict(holding_id, priced_at) do update set price = excluded.price, updated_at = now();
    v_count := v_count + 1;
  end loop;
  perform public.refresh_snapshot_for_user(v_user_id);
  return v_count;
end;
$$;

create or replace function public.upsert_manual_fx_rate(p_from_currency text, p_rate numeric, p_rate_date date)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare v_user_id uuid := auth.uid(); v_base_currency text; v_id uuid;
begin
  if v_user_id is null then raise exception 'Authentication required.'; end if;
  select base_currency into v_base_currency from public.profiles where id = v_user_id;
  if upper(coalesce(p_from_currency, '')) !~ '^[A-Z]{3}$' or upper(p_from_currency) = v_base_currency then raise exception 'FX source currency must differ from your base currency.'; end if;
  perform public.validate_investment_numeric(p_rate::text, 12);
  if p_rate is null or p_rate <= 0 then raise exception 'FX rate must be greater than zero.'; end if;
  if p_rate_date is null then raise exception 'FX rate date is required.'; end if;
  insert into public.manual_fx_rates(user_id, from_currency, to_currency, rate, rate_date)
  values(v_user_id, upper(p_from_currency), v_base_currency, p_rate, p_rate_date)
  on conflict(user_id, from_currency, to_currency, rate_date) do update set rate = excluded.rate, updated_at = now()
  returning id into v_id;
  perform public.refresh_snapshot_for_user(v_user_id);
  return v_id;
end;
$$;

-- CREATE OR REPLACE preserves existing RPC/trigger grants. Keep the fact layer internal.
revoke all on function public.get_eligible_expense_facts(date, date) from public, anon, authenticated;

commit;
