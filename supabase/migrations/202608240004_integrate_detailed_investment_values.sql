begin;

drop function public.get_account_summaries();

create function public.get_account_summaries()
returns table (
  id uuid,
  name text,
  account_type text,
  institution text,
  currency_code text,
  opening_balance_minor bigint,
  current_balance_minor bigint,
  native_value_minor bigint,
  base_value_minor bigint,
  valued_at date,
  included_in_net_worth boolean,
  created_at timestamptz,
  updated_at timestamptz,
  investment_tracking_mode text,
  base_value_available boolean,
  broker_cash_minor bigint,
  holdings_value_minor bigint,
  cost_basis_minor bigint,
  unrealized_gain_minor bigint,
  realized_gain_minor bigint,
  dividends_minor bigint,
  missing_price_count integer
)
language sql
stable
security definer
set search_path = ''
as $$
  with context as (
    select profile.base_currency,
      (current_timestamp at time zone profile.timezone)::date as local_date
    from public.profiles profile
    where profile.id = auth.uid()
  )
  select account.id, account.name, account.account_type, account.institution,
    account.currency_code, account.opening_balance_minor,
    case when account.account_type in ('bank', 'cash')
      then account.opening_balance_minor + all_movement.activity_minor else null end,
    case when account.account_type <> 'investment' then null
      when account.investment_tracking_mode = 'detailed' then detailed.native_value_minor
      else coalesce(latest.native_value_minor, 0) + later_transfers.amount_minor end,
    case when account.account_type <> 'investment' then null
      when account.investment_tracking_mode = 'detailed' then detailed.base_value_minor
      else coalesce(latest.base_value_minor, 0)
        + case when account.currency_code = context.base_currency then later_transfers.amount_minor else 0 end end,
    case when account.investment_tracking_mode = 'detailed' then detailed.latest_price_date else latest.valued_at end,
    case when account.account_type <> 'investment' then account.currency_code = context.base_currency
      when account.investment_tracking_mode = 'detailed' then coalesce(detailed.base_value_available, false)
      else true end,
    account.created_at, account.updated_at,
    account.investment_tracking_mode,
    case when account.account_type <> 'investment' then account.currency_code = context.base_currency
      when account.investment_tracking_mode = 'detailed' then coalesce(detailed.base_value_available, false)
      else true end,
    case when account.investment_tracking_mode = 'detailed' then detailed.broker_cash_minor else null end,
    case when account.investment_tracking_mode = 'detailed' then detailed.holdings_value_minor else null end,
    case when account.investment_tracking_mode = 'detailed' then detailed.cost_basis_minor else null end,
    case when account.investment_tracking_mode = 'detailed' then detailed.unrealized_gain_minor else null end,
    case when account.investment_tracking_mode = 'detailed' then detailed.realized_gain_minor else null end,
    case when account.investment_tracking_mode = 'detailed' then detailed.dividends_minor else null end,
    case when account.investment_tracking_mode = 'detailed' then detailed.missing_price_count else 0 end
  from public.accounts account
  cross join context
  left join lateral (
    select coalesce(sum(entry.amount_minor), 0)::bigint as activity_minor
    from public.transaction_entries entry
    join public.transactions transaction_record on transaction_record.id = entry.transaction_id
    where entry.account_id = account.id and transaction_record.deleted_at is null
      and transaction_record.transaction_date <= context.local_date
  ) all_movement on true
  left join lateral (
    select valuation.native_value_minor, valuation.base_value_minor, valuation.valued_at, valuation.updated_at
    from public.investment_valuations valuation
    where valuation.account_id = account.id and valuation.user_id = auth.uid()
      and valuation.valued_at <= context.local_date
    order by valuation.valued_at desc, valuation.updated_at desc limit 1
  ) latest on account.account_type = 'investment' and account.investment_tracking_mode = 'simple'
  left join lateral (
    select coalesce(sum(entry.amount_minor), 0)::bigint as amount_minor
    from public.transaction_entries entry
    join public.transactions transaction_record on transaction_record.id = entry.transaction_id
    where entry.account_id = account.id and transaction_record.transaction_type = 'transfer'
      and transaction_record.deleted_at is null and transaction_record.transaction_date <= context.local_date
      and (latest.valued_at is null or transaction_record.transaction_date > latest.valued_at
        or (transaction_record.transaction_date = latest.valued_at and transaction_record.created_at > latest.updated_at))
  ) later_transfers on account.account_type = 'investment' and account.investment_tracking_mode = 'simple'
  left join lateral public.get_detailed_investment_value(account.id, context.local_date) detailed
    on account.account_type = 'investment' and account.investment_tracking_mode = 'detailed'
  where account.user_id = auth.uid() and account.archived_at is null
  order by account.account_type, lower(account.name);
$$;

create or replace function public.refresh_snapshot_for_user(p_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_base_currency text; v_timezone text; v_snapshot_date date;
  v_bank_value bigint := 0; v_cash_value bigint := 0; v_investment_value bigint := 0;
  v_snapshot_id uuid; v_account record; v_value bigint;
begin
  select base_currency, timezone into v_base_currency, v_timezone
  from public.profiles where id = p_user_id;
  if not found then raise exception 'A user profile is required.'; end if;
  v_snapshot_date := (clock_timestamp() at time zone v_timezone)::date;

  with balances as (
    select account.account_type,
      account.opening_balance_minor + coalesce(sum(entry.amount_minor) filter (where transaction_record.id is not null), 0)::bigint as balance_minor
    from public.accounts account
    left join public.transaction_entries entry on entry.account_id = account.id
    left join public.transactions transaction_record on transaction_record.id = entry.transaction_id
      and transaction_record.deleted_at is null and transaction_record.transaction_date <= v_snapshot_date
    where account.user_id = p_user_id and account.archived_at is null
      and account.currency_code = v_base_currency and account.account_type in ('bank', 'cash')
    group by account.id, account.account_type, account.opening_balance_minor
  )
  select coalesce(sum(balance_minor) filter (where account_type = 'bank'), 0)::bigint,
    coalesce(sum(balance_minor) filter (where account_type = 'cash'), 0)::bigint
  into v_bank_value, v_cash_value from balances;

  for v_account in
    select * from public.accounts where user_id = p_user_id and account_type = 'investment' and archived_at is null
  loop
    if v_account.investment_tracking_mode = 'detailed' then
      select case when value.base_value_available then value.base_value_minor else 0 end
      into v_value from public.get_detailed_investment_value(v_account.id, v_snapshot_date) value;
    else
      select coalesce(latest.base_value_minor, 0)
        + case when v_account.currency_code = v_base_currency then later.amount_minor else 0 end
      into v_value
      from (select 1) seed
      left join lateral (
        select valuation.base_value_minor, valuation.valued_at, valuation.updated_at
        from public.investment_valuations valuation
        where valuation.account_id = v_account.id and valuation.user_id = p_user_id
          and valuation.valued_at <= v_snapshot_date
        order by valuation.valued_at desc, valuation.updated_at desc limit 1
      ) latest on true
      left join lateral (
        select coalesce(sum(entry.amount_minor), 0)::bigint amount_minor
        from public.transaction_entries entry
        join public.transactions transaction_record on transaction_record.id = entry.transaction_id
        where entry.account_id = v_account.id and transaction_record.transaction_type = 'transfer'
          and transaction_record.deleted_at is null and transaction_record.transaction_date <= v_snapshot_date
          and (latest.valued_at is null or transaction_record.transaction_date > latest.valued_at
            or (transaction_record.transaction_date = latest.valued_at and transaction_record.created_at > latest.updated_at))
      ) later on true;
    end if;
    v_investment_value := v_investment_value + coalesce(v_value, 0);
  end loop;

  insert into public.net_worth_snapshots(user_id, snapshot_date, bank_value_base_minor, cash_value_base_minor, investment_value_base_minor, total_value_base_minor)
  values(p_user_id, v_snapshot_date, v_bank_value, v_cash_value, v_investment_value, v_bank_value + v_cash_value + v_investment_value)
  on conflict(user_id, snapshot_date) do update set
    bank_value_base_minor = excluded.bank_value_base_minor,
    cash_value_base_minor = excluded.cash_value_base_minor,
    investment_value_base_minor = excluded.investment_value_base_minor,
    total_value_base_minor = excluded.total_value_base_minor,
    updated_at = now()
  returning id into v_snapshot_id;
  return v_snapshot_id;
end;
$$;

create or replace function public.upsert_investment_valuation(p_account_id uuid, p_native_value_minor bigint, p_base_value_minor bigint, p_valued_at date)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare v_user_id uuid := auth.uid(); v_account public.accounts%rowtype; v_id uuid;
begin
  if v_user_id is null then raise exception 'Authentication is required.'; end if;
  if p_native_value_minor is null or p_native_value_minor < 0 or p_base_value_minor is null or p_base_value_minor < 0 then raise exception 'Investment values cannot be negative.'; end if;
  if p_valued_at is null then raise exception 'Valuation date is required.'; end if;
  select * into v_account from public.accounts where id = p_account_id and user_id = v_user_id for update;
  if v_account.id is null then raise exception 'Investment account not found.'; end if;
  if v_account.account_type <> 'investment' then raise exception 'The account is not an investment account.'; end if;
  if v_account.archived_at is not null then raise exception 'Archived accounts cannot be valued.'; end if;
  if v_account.investment_tracking_mode <> 'simple' then raise exception 'Detailed accounts are valued from broker cash and holdings, not manual total valuations.'; end if;
  insert into public.investment_valuations(user_id, account_id, native_value_minor, base_value_minor, valued_at)
  values(v_user_id, p_account_id, p_native_value_minor, p_base_value_minor, p_valued_at)
  on conflict(account_id, valued_at) do update set native_value_minor = excluded.native_value_minor, base_value_minor = excluded.base_value_minor
  returning id into v_id;
  perform public.refresh_snapshot_for_user(v_user_id);
  return v_id;
end;
$$;

create or replace function public.upsert_account(
  p_name text, p_account_type text, p_currency_code text, p_opening_balance_minor bigint default 0,
  p_institution text default null, p_account_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare v_user_id uuid := auth.uid(); v_id uuid; v_existing public.accounts%rowtype; v_has_activity boolean;
begin
  if v_user_id is null then raise exception 'Authentication is required.'; end if;
  if p_name is null or char_length(btrim(p_name)) not between 1 and 100 then raise exception 'Account name is required.'; end if;
  if p_account_type not in ('bank', 'cash', 'investment') then raise exception 'Account type is invalid.'; end if;
  if p_currency_code is null or upper(p_currency_code) !~ '^[A-Z]{3}$' then raise exception 'Currency must be a three-letter code.'; end if;
  if p_account_type = 'investment' and p_opening_balance_minor <> 0 then raise exception 'Investment values are managed through the selected tracking mode.'; end if;
  if p_account_id is null then
    insert into public.accounts(user_id, name, account_type, institution, currency_code, opening_balance_minor)
    values(v_user_id, btrim(p_name), p_account_type, nullif(btrim(p_institution), ''), upper(p_currency_code), p_opening_balance_minor)
    returning id into v_id;
  else
    select * into v_existing from public.accounts where id = p_account_id and user_id = v_user_id for update;
    if v_existing.id is null then raise exception 'Account not found.'; end if;
    if v_existing.archived_at is not null then raise exception 'Archived accounts cannot be edited.'; end if;
    if v_existing.investment_tracking_mode = 'detailed'
      and (p_account_type <> 'investment' or upper(p_currency_code) <> v_existing.currency_code or p_opening_balance_minor <> 0)
    then raise exception 'A Detailed investment account cannot change type, currency, or opening balance.'; end if;
    select exists(
      select 1 from public.transaction_entries where account_id = p_account_id
      union all select 1 from public.investment_valuations where account_id = p_account_id
      union all select 1 from public.investment_holdings where account_id = p_account_id
      union all select 1 from public.investment_cash_events where account_id = p_account_id
    ) into v_has_activity;
    if v_has_activity and (v_existing.account_type <> p_account_type or v_existing.currency_code <> upper(p_currency_code)) then
      raise exception 'Type and currency cannot change after financial activity exists.';
    end if;
    update public.accounts set name=btrim(p_name), account_type=p_account_type,
      institution=nullif(btrim(p_institution), ''), currency_code=upper(p_currency_code), opening_balance_minor=p_opening_balance_minor
    where id=p_account_id;
    v_id := p_account_id;
  end if;
  perform public.refresh_snapshot_for_user(v_user_id);
  return v_id;
end;
$$;

create or replace function public.archive_account(p_account_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_user_id uuid := auth.uid(); v_account public.accounts%rowtype; v_local_date date; v_current bigint; v_native bigint := 0;
begin
  if v_user_id is null then raise exception 'Authentication is required.'; end if;
  select * into v_account from public.accounts where id=p_account_id and user_id=v_user_id for update;
  if v_account.id is null then raise exception 'Account not found.'; end if;
  if v_account.archived_at is not null then return; end if;
  select (clock_timestamp() at time zone timezone)::date into v_local_date from public.profiles where id=v_user_id;
  if exists(select 1 from public.transaction_entries entry join public.transactions transaction_record on transaction_record.id=entry.transaction_id
    where entry.account_id=p_account_id and transaction_record.deleted_at is null and transaction_record.transaction_date > v_local_date)
  then raise exception 'An account with future transactions cannot be archived.'; end if;
  if v_account.account_type in ('bank','cash') then
    select v_account.opening_balance_minor + coalesce(sum(entry.amount_minor),0)::bigint into v_current
    from public.transaction_entries entry join public.transactions transaction_record on transaction_record.id=entry.transaction_id
    where entry.account_id=p_account_id and transaction_record.deleted_at is null and transaction_record.transaction_date <= v_local_date;
  elsif v_account.investment_tracking_mode='detailed' then
    select broker_cash_minor, broker_cash_minor into v_current, v_native from public.get_detailed_investment_value(p_account_id,v_local_date);
    if exists(
      select 1 from public.investment_holdings holding
      join lateral (
        select coalesce(sum(case when trade_type='sell' then -quantity else quantity end),0)::numeric quantity
        from public.investment_trades where holding_id=holding.id
      ) position on true
      where holding.account_id=p_account_id and position.quantity<>0
    ) then raise exception 'Sell all holdings before archiving this Detailed account.'; end if;
  else
    select native_value_minor, base_value_minor into v_native, v_current from public.get_account_summaries() where id=p_account_id;
  end if;
  if coalesce(v_current,0)<>0 or coalesce(v_native,0)<>0 then raise exception 'Set the account value to zero before archiving it.'; end if;
  update public.accounts set archived_at=now() where id=p_account_id;
  perform public.refresh_snapshot_for_user(v_user_id);
end;
$$;

create or replace function public.get_investment_portfolio_summary()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v_user_id uuid := auth.uid(); v_base text; v_local_date date; v_accounts jsonb; v_total bigint; v_unrealized bigint; v_excluded integer;
begin
  if v_user_id is null then raise exception 'Authentication is required.'; end if;
  select base_currency,(current_timestamp at time zone timezone)::date into v_base,v_local_date from public.profiles where id=v_user_id;
  select coalesce(jsonb_agg(to_jsonb(summary) order by lower(summary.name)),'[]'::jsonb),
    coalesce(sum(summary.base_value_minor) filter(where summary.included_in_net_worth),0)::bigint,
    count(*) filter(where not summary.included_in_net_worth)::integer
  into v_accounts,v_total,v_excluded
  from public.get_account_summaries() summary where summary.account_type='investment';
  select coalesce(sum(
    case when value.base_value_available and value.unrealized_gain_minor is not null then
      case when account.currency_code=v_base then value.unrealized_gain_minor
      else round(value.unrealized_gain_minor::numeric/public.investment_currency_scale(account.currency_code)
        * value.fx_rate * public.investment_currency_scale(v_base))::bigint end
    else 0 end
  ),0)::bigint into v_unrealized
  from public.accounts account
  join lateral public.get_detailed_investment_value(account.id,v_local_date) value on true
  where account.user_id=v_user_id and account.account_type='investment' and account.investment_tracking_mode='detailed' and account.archived_at is null;
  return jsonb_build_object('currency_code',v_base,'portfolio_value_base_minor',v_total,
    'unrealized_gain_base_minor',v_unrealized,'excluded_account_count',v_excluded,'accounts',v_accounts);
end;
$$;

create or replace function public.get_detailed_investment_account(p_account_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v_user_id uuid := auth.uid(); v_account public.accounts%rowtype; v_local_date date; v_value record; v_holdings jsonb; v_trades jsonb; v_events jsonb; v_prices jsonb;
begin
  if v_user_id is null then raise exception 'Authentication is required.'; end if;
  select account.* into v_account from public.accounts account where account.id=p_account_id and account.user_id=v_user_id
    and account.account_type='investment' and account.investment_tracking_mode='detailed';
  if v_account.id is null then raise exception 'Detailed investment account not found.'; end if;
  select (current_timestamp at time zone timezone)::date into v_local_date from public.profiles where id=v_user_id;
  select * into v_value from public.get_detailed_investment_value(v_account.id,v_local_date);
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',holding.id,'symbol',holding.symbol,'name',holding.name,'asset_type',holding.asset_type,'currency_code',holding.currency_code,
    'archived_at',holding.archived_at,'quantity',position.quantity,'cost_basis_minor',position.basis,
    'average_cost_minor',case when position.quantity>0 then round(position.basis::numeric/position.quantity)::bigint else null end,
    'latest_price',price.price,'latest_price_date',price.priced_at,
    'market_value_minor',case when position.quantity>0 and price.price is not null then round(position.quantity*price.price*public.investment_currency_scale(v_account.currency_code))::bigint else null end,
    'unrealized_gain_minor',case when position.quantity>0 and price.price is not null then round(position.quantity*price.price*public.investment_currency_scale(v_account.currency_code))::bigint-position.basis else null end
  ) order by lower(holding.symbol)),'[]'::jsonb) into v_holdings
  from public.investment_holdings holding
  left join lateral(select coalesce(sum(case when trade_type='sell' then -quantity else quantity end),0)::numeric quantity,
    coalesce(sum(cost_basis_effect_minor),0)::bigint basis from public.investment_trades where holding_id=holding.id and trade_date<=v_local_date) position on true
  left join lateral(select item.price,item.priced_at from public.investment_prices item where item.holding_id=holding.id and item.priced_at<=v_local_date order by item.priced_at desc,item.updated_at desc limit 1) price on true
  where holding.account_id=v_account.id;
  select coalesce(jsonb_agg(to_jsonb(item) order by item.trade_date desc,item.created_at desc),'[]'::jsonb) into v_trades
    from public.investment_trades item where item.account_id=v_account.id;
  select coalesce(jsonb_agg(to_jsonb(item) order by item.event_date desc,item.created_at desc),'[]'::jsonb) into v_events
    from public.investment_cash_events item where item.account_id=v_account.id;
  select coalesce(jsonb_agg(jsonb_build_object('id',item.id,'holding_id',item.holding_id,'price',item.price,'priced_at',item.priced_at,'created_at',item.created_at)
    order by item.priced_at desc,item.created_at desc),'[]'::jsonb) into v_prices
    from public.investment_prices item join public.investment_holdings holding on holding.id=item.holding_id where holding.account_id=v_account.id;
  return jsonb_build_object('account',to_jsonb(v_account),'value',to_jsonb(v_value),'holdings',v_holdings,'trades',v_trades,'cash_events',v_events,'prices',v_prices);
end;
$$;

revoke all on function public.get_account_summaries(), public.get_investment_portfolio_summary(), public.get_detailed_investment_account(uuid),
  public.upsert_investment_valuation(uuid,bigint,bigint,date), public.upsert_account(text,text,text,bigint,text,uuid), public.archive_account(uuid) from public, anon;
grant execute on function public.get_account_summaries(), public.get_investment_portfolio_summary(), public.get_detailed_investment_account(uuid),
  public.upsert_investment_valuation(uuid,bigint,bigint,date), public.upsert_account(text,text,text,bigint,text,uuid), public.archive_account(uuid) to authenticated;
revoke all on function public.refresh_snapshot_for_user(uuid) from public, anon, authenticated;

commit;
