begin;

alter table public.investment_valuations
  add column updated_at timestamptz;

update public.investment_valuations
set updated_at = created_at
where updated_at is null;

alter table public.investment_valuations
  alter column updated_at set default now(),
  alter column updated_at set not null;

create trigger investment_valuations_set_updated_at
before update on public.investment_valuations
for each row execute function public.set_updated_at();

create or replace function public.refresh_snapshot_for_user(p_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_base_currency text;
  v_timezone text;
  v_snapshot_date date;
  v_bank_value bigint := 0;
  v_cash_value bigint := 0;
  v_investment_value bigint := 0;
  v_snapshot_id uuid;
begin
  select profile.base_currency, profile.timezone
  into v_base_currency, v_timezone
  from public.profiles profile
  where profile.id = p_user_id;

  if not found then
    raise exception using errcode = 'P0001', message = 'A user profile is required.';
  end if;

  v_snapshot_date := (clock_timestamp() at time zone v_timezone)::date;

  with balances as (
    select
      account.account_type,
      account.opening_balance_minor
        + coalesce(sum(entry.amount_minor) filter (where transaction_record.id is not null), 0)::bigint
        as balance_minor
    from public.accounts account
    left join public.transaction_entries entry on entry.account_id = account.id
    left join public.transactions transaction_record
      on transaction_record.id = entry.transaction_id
      and transaction_record.deleted_at is null
      and transaction_record.transaction_date <= v_snapshot_date
    where account.user_id = p_user_id
      and account.archived_at is null
      and account.currency_code = v_base_currency
      and account.account_type in ('bank', 'cash')
    group by account.id, account.account_type, account.opening_balance_minor
  )
  select
    coalesce(sum(balance_minor) filter (where account_type = 'bank'), 0)::bigint,
    coalesce(sum(balance_minor) filter (where account_type = 'cash'), 0)::bigint
  into v_bank_value, v_cash_value
  from balances;

  select coalesce(sum(
    coalesce(latest.base_value_minor, 0)
      + case
          when account.currency_code = v_base_currency
          then coalesce(later_transfers.amount_minor, 0)
          else 0
        end
  ), 0)::bigint
  into v_investment_value
  from public.accounts account
  left join lateral (
    select
      valuation.base_value_minor,
      valuation.valued_at,
      valuation.updated_at
    from public.investment_valuations valuation
    where valuation.account_id = account.id
      and valuation.user_id = p_user_id
      and valuation.valued_at <= v_snapshot_date
    order by valuation.valued_at desc, valuation.updated_at desc
    limit 1
  ) latest on true
  left join lateral (
    select coalesce(sum(entry.amount_minor), 0)::bigint as amount_minor
    from public.transaction_entries entry
    join public.transactions transaction_record
      on transaction_record.id = entry.transaction_id
    where entry.account_id = account.id
      and transaction_record.transaction_type = 'transfer'
      and transaction_record.deleted_at is null
      and transaction_record.transaction_date <= v_snapshot_date
      and (
        latest.valued_at is null
        or transaction_record.transaction_date > latest.valued_at
        or (
          transaction_record.transaction_date = latest.valued_at
          and transaction_record.created_at > latest.updated_at
        )
      )
  ) later_transfers on true
  where account.user_id = p_user_id
    and account.account_type = 'investment'
    and account.archived_at is null;

  insert into public.net_worth_snapshots (
    user_id,
    snapshot_date,
    bank_value_base_minor,
    cash_value_base_minor,
    investment_value_base_minor,
    total_value_base_minor
  )
  values (
    p_user_id,
    v_snapshot_date,
    v_bank_value,
    v_cash_value,
    v_investment_value,
    v_bank_value + v_cash_value + v_investment_value
  )
  on conflict (user_id, snapshot_date)
  do update set
    bank_value_base_minor = excluded.bank_value_base_minor,
    cash_value_base_minor = excluded.cash_value_base_minor,
    investment_value_base_minor = excluded.investment_value_base_minor,
    total_value_base_minor = excluded.total_value_base_minor,
    updated_at = now()
  returning id into v_snapshot_id;

  return v_snapshot_id;
end;
$$;

create or replace function public.get_account_summaries()
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
  updated_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  with context as (
    select
      profile.base_currency,
      (current_timestamp at time zone profile.timezone)::date as local_date
    from public.profiles profile
    where profile.id = auth.uid()
  )
  select
    account.id,
    account.name,
    account.account_type,
    account.institution,
    account.currency_code,
    account.opening_balance_minor,
    case
      when account.account_type in ('bank', 'cash')
      then account.opening_balance_minor + all_movement.activity_minor
      else null
    end as current_balance_minor,
    case
      when account.account_type = 'investment'
      then coalesce(latest.native_value_minor, 0) + later_transfers.amount_minor
      else null
    end as native_value_minor,
    case
      when account.account_type = 'investment'
      then coalesce(latest.base_value_minor, 0)
        + case
            when account.currency_code = context.base_currency
            then later_transfers.amount_minor
            else 0
          end
      else null
    end as base_value_minor,
    latest.valued_at,
    case
      when account.account_type = 'investment' then true
      else account.currency_code = context.base_currency
    end as included_in_net_worth,
    account.created_at,
    account.updated_at
  from public.accounts account
  cross join context
  left join lateral (
    select coalesce(sum(entry.amount_minor), 0)::bigint as activity_minor
    from public.transaction_entries entry
    join public.transactions transaction_record on transaction_record.id = entry.transaction_id
    where entry.account_id = account.id
      and transaction_record.deleted_at is null
      and transaction_record.transaction_date <= context.local_date
  ) all_movement on true
  left join lateral (
    select
      valuation.native_value_minor,
      valuation.base_value_minor,
      valuation.valued_at,
      valuation.updated_at
    from public.investment_valuations valuation
    where valuation.account_id = account.id
      and valuation.user_id = auth.uid()
      and valuation.valued_at <= context.local_date
    order by valuation.valued_at desc, valuation.updated_at desc
    limit 1
  ) latest on account.account_type = 'investment'
  left join lateral (
    select coalesce(sum(entry.amount_minor), 0)::bigint as amount_minor
    from public.transaction_entries entry
    join public.transactions transaction_record on transaction_record.id = entry.transaction_id
    where entry.account_id = account.id
      and transaction_record.transaction_type = 'transfer'
      and transaction_record.deleted_at is null
      and transaction_record.transaction_date <= context.local_date
      and (
        latest.valued_at is null
        or transaction_record.transaction_date > latest.valued_at
        or (
          transaction_record.transaction_date = latest.valued_at
          and transaction_record.created_at > latest.updated_at
        )
      )
  ) later_transfers on account.account_type = 'investment'
  where account.user_id = auth.uid()
    and account.archived_at is null
  order by account.account_type, lower(account.name);
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
  v_base_currency text;
  v_local_date date;
  v_current_value bigint;
  v_native_value bigint := 0;
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

  select
    profile.base_currency,
    (clock_timestamp() at time zone profile.timezone)::date
  into v_base_currency, v_local_date
  from public.profiles profile
  where profile.id = v_user_id;

  if exists (
    select 1
    from public.transaction_entries entry
    join public.transactions transaction_record on transaction_record.id = entry.transaction_id
    where entry.account_id = p_account_id
      and transaction_record.deleted_at is null
      and transaction_record.transaction_date > v_local_date
  ) then
    raise exception using
      errcode = '22023',
      message = 'An account with future transactions cannot be archived.';
  end if;

  if v_account.account_type in ('bank', 'cash') then
    select v_account.opening_balance_minor + coalesce(sum(entry.amount_minor), 0)::bigint
    into v_current_value
    from public.transaction_entries entry
    join public.transactions transaction_record on transaction_record.id = entry.transaction_id
    where entry.account_id = p_account_id
      and transaction_record.deleted_at is null
      and transaction_record.transaction_date <= v_local_date;
  else
    select
      coalesce(latest.base_value_minor, 0)
        + case
            when v_account.currency_code = v_base_currency
            then later_transfers.amount_minor
            else 0
          end,
      coalesce(latest.native_value_minor, 0) + later_transfers.amount_minor
    into v_current_value, v_native_value
    from (select 1) seed
    left join lateral (
      select
        valuation.native_value_minor,
        valuation.base_value_minor,
        valuation.valued_at,
        valuation.updated_at
      from public.investment_valuations valuation
      where valuation.account_id = p_account_id
        and valuation.valued_at <= v_local_date
      order by valuation.valued_at desc, valuation.updated_at desc
      limit 1
    ) latest on true
    left join lateral (
      select coalesce(sum(entry.amount_minor), 0)::bigint as amount_minor
      from public.transaction_entries entry
      join public.transactions transaction_record on transaction_record.id = entry.transaction_id
      where entry.account_id = p_account_id
        and transaction_record.transaction_type = 'transfer'
        and transaction_record.deleted_at is null
        and transaction_record.transaction_date <= v_local_date
        and (
          latest.valued_at is null
          or transaction_record.transaction_date > latest.valued_at
          or (
            transaction_record.transaction_date = latest.valued_at
            and transaction_record.created_at > latest.updated_at
          )
        )
    ) later_transfers on true;
  end if;

  if coalesce(v_current_value, 0) <> 0 or coalesce(v_native_value, 0) <> 0 then
    raise exception using
      errcode = '22023',
      message = 'Set the account value to zero before archiving it.';
  end if;

  update public.accounts
  set archived_at = now()
  where id = p_account_id;

  perform public.refresh_snapshot_for_user(v_user_id);
end;
$$;

do $$
declare
  profile_record record;
begin
  for profile_record in select id from public.profiles loop
    perform public.refresh_snapshot_for_user(profile_record.id);
  end loop;
end;
$$;

commit;
