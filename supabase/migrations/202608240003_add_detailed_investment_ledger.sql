begin;

alter table public.accounts
  add column investment_tracking_mode text not null default 'simple',
  add column detailed_started_on date,
  add column detailed_started_at timestamptz,
  add constraint accounts_investment_tracking_mode_check
    check (investment_tracking_mode in ('simple', 'detailed')),
  add constraint accounts_detailed_mode_type_check
    check (investment_tracking_mode = 'simple' or account_type = 'investment'),
  add constraint accounts_detailed_boundary_check
    check (
      (investment_tracking_mode = 'simple' and detailed_started_on is null and detailed_started_at is null)
      or
      (investment_tracking_mode = 'detailed' and detailed_started_on is not null and detailed_started_at is not null)
    );

create table public.manual_fx_rates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  from_currency text not null,
  to_currency text not null,
  rate numeric(30, 12) not null,
  rate_date date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint manual_fx_rates_from_currency_check check (from_currency ~ '^[A-Z]{3}$'),
  constraint manual_fx_rates_to_currency_check check (to_currency ~ '^[A-Z]{3}$'),
  constraint manual_fx_rates_distinct_pair_check check (from_currency <> to_currency),
  constraint manual_fx_rates_positive_rate_check check (rate > 0),
  constraint manual_fx_rates_user_pair_date_unique unique (user_id, from_currency, to_currency, rate_date)
);

create table public.investment_holdings (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  symbol text not null,
  name text not null,
  asset_type text not null,
  currency_code text not null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint investment_holdings_symbol_check check (symbol = upper(btrim(symbol)) and char_length(symbol) between 1 and 20),
  constraint investment_holdings_name_check check (name = btrim(name) and char_length(name) between 1 and 120),
  constraint investment_holdings_asset_type_check check (asset_type in ('stock', 'etf', 'fund', 'other')),
  constraint investment_holdings_currency_check check (currency_code ~ '^[A-Z]{3}$')
);

create unique index investment_holdings_active_symbol_unique
on public.investment_holdings(account_id, lower(symbol))
where archived_at is null;

create index investment_holdings_user_account_idx
on public.investment_holdings(user_id, account_id, archived_at);

create table public.investment_trades (
  id uuid primary key default gen_random_uuid(),
  holding_id uuid not null references public.investment_holdings(id),
  account_id uuid not null references public.accounts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  trade_type text not null,
  quantity numeric(30, 10) not null,
  unit_price numeric(30, 10) not null,
  fee_minor bigint not null default 0,
  cash_effect_minor bigint not null,
  cost_basis_effect_minor bigint not null,
  realized_gain_minor bigint not null default 0,
  trade_date date not null,
  note text,
  created_at timestamptz not null default now(),
  constraint investment_trades_type_check check (trade_type in ('opening_position', 'buy', 'sell')),
  constraint investment_trades_quantity_check check (quantity > 0),
  constraint investment_trades_price_check check (unit_price >= 0),
  constraint investment_trades_fee_check check (fee_minor >= 0),
  constraint investment_trades_note_check check (note is null or char_length(note) <= 300)
);

create index investment_trades_holding_date_idx
on public.investment_trades(holding_id, trade_date, created_at);

create index investment_trades_account_date_idx
on public.investment_trades(account_id, trade_date, created_at);

create table public.investment_prices (
  id uuid primary key default gen_random_uuid(),
  holding_id uuid not null references public.investment_holdings(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  price numeric(30, 10) not null,
  priced_at date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint investment_prices_positive_price_check check (price > 0),
  constraint investment_prices_holding_date_unique unique (holding_id, priced_at)
);

create index investment_prices_holding_latest_idx
on public.investment_prices(holding_id, priced_at desc, updated_at desc);

create table public.investment_cash_events (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  holding_id uuid references public.investment_holdings(id),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null,
  amount_minor bigint not null,
  event_date date not null,
  note text,
  created_at timestamptz not null default now(),
  constraint investment_cash_events_type_check check (event_type in ('opening_cash', 'dividend', 'cash_adjustment')),
  constraint investment_cash_events_amount_check check (
    (event_type = 'opening_cash' and amount_minor >= 0)
    or (event_type = 'dividend' and amount_minor > 0)
    or (event_type = 'cash_adjustment' and amount_minor <> 0)
  ),
  constraint investment_cash_events_note_check check (note is null or char_length(note) <= 300)
);

create unique index investment_cash_events_one_opening_idx
on public.investment_cash_events(account_id)
where event_type = 'opening_cash';

create index investment_cash_events_account_date_idx
on public.investment_cash_events(account_id, event_date, created_at);

create trigger manual_fx_rates_set_updated_at before update on public.manual_fx_rates
for each row execute function public.set_updated_at();
create trigger investment_holdings_set_updated_at before update on public.investment_holdings
for each row execute function public.set_updated_at();
create trigger investment_prices_set_updated_at before update on public.investment_prices
for each row execute function public.set_updated_at();

create or replace function public.investment_currency_scale(p_currency text)
returns numeric
language sql
immutable
set search_path = ''
as $$
  select case upper(p_currency)
    when 'BHD' then 1000::numeric when 'IQD' then 1000::numeric when 'JOD' then 1000::numeric
    when 'KWD' then 1000::numeric when 'OMR' then 1000::numeric when 'TND' then 1000::numeric
    when 'CLP' then 1::numeric when 'JPY' then 1::numeric when 'KRW' then 1::numeric
    else 100::numeric
  end;
$$;

create or replace function public.validate_investment_holding()
returns trigger
language plpgsql
set search_path = ''
as $$
declare v_account public.accounts%rowtype;
begin
  select * into v_account from public.accounts where id = new.account_id;
  if v_account.id is null or v_account.user_id <> new.user_id then raise exception 'Holding ownership does not match its account.'; end if;
  if v_account.account_type <> 'investment' or v_account.investment_tracking_mode <> 'detailed' then raise exception 'Holdings require a detailed investment account.'; end if;
  if v_account.archived_at is not null then raise exception 'Archived accounts cannot contain active holdings.'; end if;
  if new.currency_code <> v_account.currency_code then raise exception 'Holding currency must match the investment account currency.'; end if;
  return new;
end;
$$;

create trigger investment_holdings_validate
before insert or update of account_id, user_id, currency_code on public.investment_holdings
for each row execute function public.validate_investment_holding();

create or replace function public.prevent_investment_ledger_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Investment ledger entries are immutable. Record a controlled correction instead.';
end;
$$;

create trigger investment_trades_immutable before update or delete on public.investment_trades
for each row execute function public.prevent_investment_ledger_mutation();
create trigger investment_cash_events_immutable before update or delete on public.investment_cash_events
for each row execute function public.prevent_investment_ledger_mutation();

alter table public.manual_fx_rates enable row level security;
alter table public.investment_holdings enable row level security;
alter table public.investment_trades enable row level security;
alter table public.investment_prices enable row level security;
alter table public.investment_cash_events enable row level security;

create policy manual_fx_rates_select_own on public.manual_fx_rates for select using (user_id = auth.uid());
create policy investment_holdings_select_own on public.investment_holdings for select using (user_id = auth.uid());
create policy investment_trades_select_own on public.investment_trades for select using (user_id = auth.uid());
create policy investment_prices_select_own on public.investment_prices for select using (user_id = auth.uid());
create policy investment_cash_events_select_own on public.investment_cash_events for select using (user_id = auth.uid());

create or replace function public.get_detailed_investment_value(p_account_id uuid, p_as_of_date date)
returns table (
  native_value_minor bigint,
  base_value_minor bigint,
  base_value_available boolean,
  broker_cash_minor bigint,
  holdings_value_minor bigint,
  cost_basis_minor bigint,
  unrealized_gain_minor bigint,
  realized_gain_minor bigint,
  dividends_minor bigint,
  missing_price_count integer,
  fx_rate numeric,
  fx_rate_date date,
  latest_price_date date
)
language sql
stable
security definer
set search_path = ''
as $$
  with context as (
    select account.*, profile.base_currency
    from public.accounts account
    join public.profiles profile on profile.id = account.user_id
    where account.id = p_account_id
      and account.account_type = 'investment'
      and account.investment_tracking_mode = 'detailed'
  ), transfer_cash as (
    select coalesce(sum(entry.amount_minor), 0)::bigint as amount_minor
    from context
    join public.transaction_entries entry on entry.account_id = context.id
    join public.transactions transaction_record on transaction_record.id = entry.transaction_id
    where transaction_record.transaction_type = 'transfer'
      and transaction_record.deleted_at is null
      and transaction_record.transaction_date <= p_as_of_date
      and (
        transaction_record.transaction_date > context.detailed_started_on
        or (transaction_record.transaction_date = context.detailed_started_on and transaction_record.created_at > context.detailed_started_at)
      )
  ), ledger_cash as (
    select coalesce(sum(amount_minor), 0)::bigint as amount_minor
    from public.investment_cash_events event join context on context.id = event.account_id
    where event.event_date <= p_as_of_date
  ), trade_cash as (
    select coalesce(sum(cash_effect_minor), 0)::bigint as amount_minor,
      coalesce(sum(realized_gain_minor), 0)::bigint as realized_minor
    from public.investment_trades trade join context on context.id = trade.account_id
    where trade.trade_date <= p_as_of_date
  ), positions as (
    select holding.id,
      coalesce(sum(case when trade.trade_type = 'sell' then -trade.quantity else trade.quantity end), 0)::numeric as quantity,
      coalesce(sum(trade.cost_basis_effect_minor), 0)::bigint as cost_basis_minor
    from public.investment_holdings holding
    join context on context.id = holding.account_id
    left join public.investment_trades trade on trade.holding_id = holding.id and trade.trade_date <= p_as_of_date
    group by holding.id
  ), priced_positions as (
    select positions.*,
      latest.price,
      latest.priced_at,
      case when positions.quantity <> 0 and latest.price is not null
        then round(positions.quantity * latest.price * public.investment_currency_scale(context.currency_code))::bigint
        else 0::bigint end as market_value_minor
    from positions
    cross join context
    left join lateral (
      select price, priced_at from public.investment_prices
      where holding_id = positions.id and priced_at <= p_as_of_date
      order by priced_at desc, updated_at desc limit 1
    ) latest on true
  ), holding_totals as (
    select coalesce(sum(market_value_minor), 0)::bigint as market_minor,
      coalesce(sum(cost_basis_minor), 0)::bigint as basis_minor,
      count(*) filter (where quantity <> 0 and price is null)::integer as missing_count,
      max(priced_at) as latest_price_date
    from priced_positions
  ), selected_fx as (
    select rate, rate_date from context
    join public.manual_fx_rates fx on fx.user_id = context.user_id
      and fx.from_currency = context.currency_code
      and fx.to_currency = context.base_currency
      and fx.rate_date <= p_as_of_date
    order by fx.rate_date desc, fx.updated_at desc limit 1
  ), totals as (
    select context.*,
      ledger_cash.amount_minor + transfer_cash.amount_minor + trade_cash.amount_minor as broker_minor,
      holding_totals.*,
      trade_cash.realized_minor,
      (select coalesce(sum(amount_minor), 0)::bigint from public.investment_cash_events event where event.account_id = context.id and event.event_type = 'dividend' and event.event_date <= p_as_of_date) as dividend_minor,
      selected_fx.rate, selected_fx.rate_date
    from context cross join transfer_cash cross join ledger_cash cross join trade_cash cross join holding_totals
    left join selected_fx on true
  )
  select
    case when missing_count > 0 then null else (broker_minor + market_minor)::bigint end,
    case
      when missing_count > 0 then null
      when currency_code = base_currency then (broker_minor + market_minor)::bigint
      when rate is not null then round(
        (broker_minor + market_minor)::numeric / public.investment_currency_scale(currency_code)
        * rate * public.investment_currency_scale(base_currency)
      )::bigint
      else null
    end,
    missing_count = 0 and (currency_code = base_currency or rate is not null),
    broker_minor::bigint,
    market_minor::bigint,
    basis_minor::bigint,
    case when missing_count > 0 then null else (market_minor - basis_minor)::bigint end,
    realized_minor::bigint,
    dividend_minor::bigint,
    missing_count,
    case when currency_code = base_currency then 1::numeric else rate end,
    case when currency_code = base_currency then null else rate_date end,
    latest_price_date
  from totals;
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

create or replace function public.upsert_investment_holding(
  p_account_id uuid, p_symbol text, p_name text, p_asset_type text, p_holding_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare v_user_id uuid := auth.uid(); v_account public.accounts%rowtype; v_holding public.investment_holdings%rowtype; v_id uuid;
begin
  if v_user_id is null then raise exception 'Authentication required.'; end if;
  select * into v_account from public.accounts where id = p_account_id and user_id = v_user_id and account_type = 'investment' and investment_tracking_mode = 'detailed' and archived_at is null;
  if v_account.id is null then raise exception 'Detailed investment account not found.'; end if;
  if char_length(btrim(coalesce(p_symbol, ''))) not between 1 and 20 or char_length(btrim(coalesce(p_name, ''))) not between 1 and 120 then raise exception 'Holding symbol and name are required.'; end if;
  if p_asset_type not in ('stock', 'etf', 'fund', 'other') then raise exception 'Holding asset type is invalid.'; end if;
  if p_holding_id is null then
    insert into public.investment_holdings(account_id, user_id, symbol, name, asset_type, currency_code)
    values(v_account.id, v_user_id, upper(btrim(p_symbol)), btrim(p_name), p_asset_type, v_account.currency_code) returning id into v_id;
  else
    select * into v_holding from public.investment_holdings where id = p_holding_id and account_id = v_account.id and user_id = v_user_id for update;
    if v_holding.id is null then raise exception 'Holding not found.'; end if;
    update public.investment_holdings set symbol = upper(btrim(p_symbol)), name = btrim(p_name), asset_type = p_asset_type where id = v_holding.id returning id into v_id;
  end if;
  return v_id;
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

create or replace function public.record_investment_cash_event(
  p_account_id uuid, p_holding_id uuid, p_event_type text, p_amount_minor bigint, p_event_date date, p_note text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare v_user_id uuid := auth.uid(); v_account public.accounts%rowtype; v_today date; v_cash bigint; v_id uuid;
begin
  if v_user_id is null then raise exception 'Authentication required.'; end if;
  if p_event_type not in ('dividend', 'cash_adjustment') then raise exception 'Cash event type is invalid.'; end if;
  if (p_event_type = 'dividend' and (p_amount_minor is null or p_amount_minor <= 0)) or (p_event_type = 'cash_adjustment' and coalesce(p_amount_minor, 0) = 0) then raise exception 'Cash event amount is invalid.'; end if;
  if char_length(btrim(coalesce(p_note, ''))) < 1 or char_length(btrim(p_note)) > 300 then raise exception 'A short reason is required.'; end if;
  select * into v_account from public.accounts where id = p_account_id and user_id = v_user_id and account_type = 'investment' and investment_tracking_mode = 'detailed' and archived_at is null for update;
  if v_account.id is null then raise exception 'Detailed investment account not found.'; end if;
  select (now() at time zone timezone)::date into v_today from public.profiles where id = v_user_id;
  if p_event_date is null or p_event_date < v_account.detailed_started_on or p_event_date > v_today then raise exception 'Cash event date is outside the detailed tracking period.'; end if;
  if p_event_type = 'dividend' and (p_holding_id is null or not exists(select 1 from public.investment_holdings where id = p_holding_id and account_id = v_account.id and user_id = v_user_id)) then raise exception 'Dividend holding does not belong to this account.'; end if;
  if p_event_type = 'cash_adjustment' and p_holding_id is not null then raise exception 'Cash adjustments do not use a holding.'; end if;
  select broker_cash_minor into v_cash from public.get_detailed_investment_value(v_account.id, v_today);
  if v_cash + p_amount_minor < 0 then raise exception 'Cash adjustment would make broker cash negative.'; end if;
  insert into public.investment_cash_events(account_id, holding_id, user_id, event_type, amount_minor, event_date, note)
  values(v_account.id, p_holding_id, v_user_id, p_event_type, p_amount_minor, p_event_date, btrim(p_note)) returning id into v_id;
  perform public.refresh_snapshot_for_user(v_user_id);
  return v_id;
end;
$$;

revoke all on table public.manual_fx_rates, public.investment_holdings, public.investment_trades, public.investment_prices, public.investment_cash_events from anon, authenticated;
grant select on table public.manual_fx_rates, public.investment_holdings, public.investment_trades, public.investment_prices, public.investment_cash_events to authenticated;

revoke all on function public.investment_currency_scale(text), public.validate_investment_holding(), public.prevent_investment_ledger_mutation(), public.get_detailed_investment_value(uuid, date) from public, anon, authenticated;
revoke all on function public.preview_detailed_investment_conversion(uuid, bigint, jsonb), public.enable_detailed_investment_tracking(uuid, date, bigint, jsonb), public.upsert_investment_holding(uuid, text, text, text, uuid), public.record_investment_trade(uuid, uuid, text, numeric, numeric, bigint, date, text), public.update_investment_prices(uuid, date, jsonb), public.upsert_manual_fx_rate(text, numeric, date), public.record_investment_cash_event(uuid, uuid, text, bigint, date, text) from public, anon;
grant execute on function public.preview_detailed_investment_conversion(uuid, bigint, jsonb), public.enable_detailed_investment_tracking(uuid, date, bigint, jsonb), public.upsert_investment_holding(uuid, text, text, text, uuid), public.record_investment_trade(uuid, uuid, text, numeric, numeric, bigint, date, text), public.update_investment_prices(uuid, date, jsonb), public.upsert_manual_fx_rate(text, numeric, date), public.record_investment_cash_event(uuid, uuid, text, bigint, date, text) to authenticated;

commit;
