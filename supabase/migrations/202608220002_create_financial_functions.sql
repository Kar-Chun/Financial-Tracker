begin;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger accounts_set_updated_at
before update on public.accounts
for each row execute function public.set_updated_at();

create trigger transactions_set_updated_at
before update on public.transactions
for each row execute function public.set_updated_at();

create trigger net_worth_snapshots_set_updated_at
before update on public.net_worth_snapshots
for each row execute function public.set_updated_at();

create or replace function public.validate_profile_timezone()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_timezone_names
    where name = new.timezone
  ) then
    raise exception using
      errcode = '22023',
      message = 'The selected timezone is not valid.';
  end if;

  return new;
end;
$$;

create trigger profiles_validate_timezone
before insert or update of timezone on public.profiles
for each row execute function public.validate_profile_timezone();

create or replace function public.validate_category_parent()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_parent_parent_id uuid;
  v_parent_type text;
  v_parent_archived_at timestamptz;
begin
  if new.parent_id is not null then
    if exists (
      select 1
      from public.categories child
      where child.parent_id = new.id
    ) then
      raise exception using
        errcode = '23514',
        message = 'V1 categories support only one parent level.';
    end if;

    select parent_id, category_type, archived_at
    into v_parent_parent_id, v_parent_type, v_parent_archived_at
    from public.categories
    where id = new.parent_id
      and user_id = new.user_id;

    if not found then
      raise exception using
        errcode = '23503',
        message = 'The parent category does not belong to this user.';
    end if;

    if v_parent_parent_id is not null then
      raise exception using
        errcode = '23514',
        message = 'V1 categories support only one parent level.';
    end if;

    if v_parent_type <> new.category_type then
      raise exception using
        errcode = '23514',
        message = 'A subcategory must have the same type as its parent.';
    end if;

    if v_parent_archived_at is not null then
      raise exception using
        errcode = '23514',
        message = 'An archived category cannot be used as a parent.';
    end if;
  elsif tg_op = 'UPDATE'
    and new.category_type <> old.category_type
    and exists (select 1 from public.categories child where child.parent_id = new.id)
  then
    raise exception using
      errcode = '23514',
      message = 'A parent category type cannot change while it has subcategories.';
  end if;

  return new;
end;
$$;

create trigger categories_validate_parent
before insert or update of parent_id, category_type, user_id on public.categories
for each row execute function public.validate_category_parent();

create or replace function public.validate_transaction_entry_ownership()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_transaction_user_id uuid;
  v_account_user_id uuid;
  v_account_archived_at timestamptz;
begin
  select user_id
  into v_transaction_user_id
  from public.transactions
  where id = new.transaction_id;

  select user_id, archived_at
  into v_account_user_id, v_account_archived_at
  from public.accounts
  where id = new.account_id;

  if v_transaction_user_id is null or v_account_user_id is null then
    raise exception using
      errcode = '23503',
      message = 'The transaction entry references an invalid record.';
  end if;

  if v_transaction_user_id <> v_account_user_id then
    raise exception using
      errcode = '42501',
      message = 'The transaction and account must have the same owner.';
  end if;

  if v_account_archived_at is not null then
    raise exception using
      errcode = '23514',
      message = 'Archived accounts cannot receive new transaction entries.';
  end if;

  return new;
end;
$$;

create trigger transaction_entries_validate_ownership
before insert or update of transaction_id, account_id on public.transaction_entries
for each row execute function public.validate_transaction_entry_ownership();

create or replace function public.validate_investment_valuation_account()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_account_type text;
  v_archived_at timestamptz;
begin
  select account_type, archived_at
  into v_account_type, v_archived_at
  from public.accounts
  where id = new.account_id
    and user_id = new.user_id;

  if not found then
    raise exception using
      errcode = '23503',
      message = 'The investment account does not belong to this user.';
  end if;

  if v_account_type <> 'investment' then
    raise exception using
      errcode = '23514',
      message = 'Valuations can only be recorded for investment accounts.';
  end if;

  if v_archived_at is not null then
    raise exception using
      errcode = '23514',
      message = 'Archived investment accounts cannot be valued.';
  end if;

  return new;
end;
$$;

create trigger investment_valuations_validate_account
before insert or update of account_id, user_id on public.investment_valuations
for each row execute function public.validate_investment_valuation_account();

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

create constraint trigger transactions_validate_integrity
after insert or update of transaction_type, category_id, deleted_at
on public.transactions
deferrable initially deferred
for each row execute function public.validate_transaction_integrity();

create constraint trigger transaction_entries_validate_integrity
after insert or update or delete on public.transaction_entries
deferrable initially deferred
for each row execute function public.validate_transaction_integrity();

create or replace function public.seed_default_categories(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.categories (user_id, name, category_type)
  select p_user_id, defaults.name, 'expense'
  from (
    values
      ('Food'),
      ('Transport'),
      ('Shopping'),
      ('Entertainment'),
      ('Bills'),
      ('Education'),
      ('Health'),
      ('Travel'),
      ('Other')
  ) as defaults(name)
  where not exists (
    select 1
    from public.categories existing
    where existing.user_id = p_user_id
      and existing.parent_id is null
      and existing.category_type = 'expense'
      and lower(existing.name) = lower(defaults.name)
      and existing.archived_at is null
  );

  insert into public.categories (user_id, name, parent_id, category_type)
  select p_user_id, children.child_name, parent.id, 'expense'
  from (
    values
      ('Food', 'Eating Out'),
      ('Food', 'Groceries'),
      ('Food', 'Drinks'),
      ('Transport', 'Public Transport'),
      ('Transport', 'Ride Hailing'),
      ('Shopping', 'Clothing'),
      ('Shopping', 'Electronics'),
      ('Entertainment', 'Games'),
      ('Entertainment', 'Movies')
  ) as children(parent_name, child_name)
  join public.categories parent
    on parent.user_id = p_user_id
    and parent.parent_id is null
    and parent.category_type = 'expense'
    and parent.name = children.parent_name
    and parent.archived_at is null
  where not exists (
    select 1
    from public.categories existing
    where existing.user_id = p_user_id
      and existing.parent_id = parent.id
      and lower(existing.name) = lower(children.child_name)
      and existing.archived_at is null
  );

  insert into public.categories (user_id, name, category_type)
  select p_user_id, defaults.name, 'income'
  from (
    values
      ('Salary'),
      ('Allowance'),
      ('Interest'),
      ('Investment Income'),
      ('Other Income')
  ) as defaults(name)
  where not exists (
    select 1
    from public.categories existing
    where existing.user_id = p_user_id
      and existing.parent_id is null
      and existing.category_type = 'income'
      and lower(existing.name) = lower(defaults.name)
      and existing.archived_at is null
  );
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    left(nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''), 100)
  );

  perform public.seed_default_categories(new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

insert into public.profiles (id, display_name)
select
  auth_user.id,
  left(nullif(btrim(auth_user.raw_user_meta_data ->> 'display_name'), ''), 100)
from auth.users auth_user
on conflict (id) do nothing;

do $$
declare
  auth_user record;
begin
  for auth_user in select id from auth.users loop
    perform public.seed_default_categories(auth_user.id);
  end loop;
end;
$$;

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

  select coalesce(sum(latest.base_value_minor), 0)::bigint
  into v_investment_value
  from public.accounts account
  join lateral (
    select valuation.base_value_minor
    from public.investment_valuations valuation
    where valuation.account_id = account.id
      and valuation.user_id = p_user_id
      and valuation.valued_at <= v_snapshot_date
    order by valuation.valued_at desc, valuation.created_at desc
    limit 1
  ) latest on true
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

create or replace function public.refresh_net_worth_snapshot()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication is required.';
  end if;

  return public.refresh_snapshot_for_user(v_user_id);
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
      then account.opening_balance_minor + movement.activity_minor
      else null
    end as current_balance_minor,
    latest.native_value_minor,
    latest.base_value_minor,
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
  ) movement on true
  left join lateral (
    select
      valuation.native_value_minor,
      valuation.base_value_minor,
      valuation.valued_at
    from public.investment_valuations valuation
    where valuation.account_id = account.id
      and valuation.user_id = auth.uid()
      and valuation.valued_at <= context.local_date
    order by valuation.valued_at desc, valuation.created_at desc
    limit 1
  ) latest on account.account_type = 'investment'
  where account.user_id = auth.uid()
    and account.archived_at is null
  order by account.account_type, lower(account.name);
$$;

create or replace function public.upsert_account(
  p_name text,
  p_account_type text,
  p_currency_code text,
  p_opening_balance_minor bigint default 0,
  p_institution text default null,
  p_account_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_account_id uuid;
  v_existing public.accounts%rowtype;
  v_has_activity boolean;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication is required.';
  end if;

  if p_name is null or char_length(btrim(p_name)) not between 1 and 100 then
    raise exception using errcode = '22023', message = 'Account name is required.';
  end if;

  if p_account_type not in ('bank', 'cash', 'investment') then
    raise exception using errcode = '22023', message = 'Account type is invalid.';
  end if;

  if p_currency_code is null or upper(p_currency_code) !~ '^[A-Z]{3}$' then
    raise exception using errcode = '22023', message = 'Currency must be a three-letter code.';
  end if;

  if p_account_type = 'investment' and p_opening_balance_minor <> 0 then
    raise exception using
      errcode = '22023',
      message = 'Investment values must be recorded with a manual valuation.';
  end if;

  if p_account_id is null then
    insert into public.accounts (
      user_id,
      name,
      account_type,
      institution,
      currency_code,
      opening_balance_minor
    )
    values (
      v_user_id,
      btrim(p_name),
      p_account_type,
      nullif(btrim(p_institution), ''),
      upper(p_currency_code),
      p_opening_balance_minor
    )
    returning id into v_account_id;
  else
    select *
    into v_existing
    from public.accounts
    where id = p_account_id
      and user_id = v_user_id
    for update;

    if not found then
      raise exception using errcode = '42501', message = 'Account not found.';
    end if;

    if v_existing.archived_at is not null then
      raise exception using errcode = '22023', message = 'Archived accounts cannot be edited.';
    end if;

    select exists (
      select 1 from public.transaction_entries entry where entry.account_id = p_account_id
      union all
      select 1 from public.investment_valuations valuation where valuation.account_id = p_account_id
    ) into v_has_activity;

    if v_has_activity
      and (v_existing.account_type <> p_account_type or v_existing.currency_code <> upper(p_currency_code))
    then
      raise exception using
        errcode = '22023',
        message = 'Type and currency cannot change after financial activity exists.';
    end if;

    update public.accounts
    set
      name = btrim(p_name),
      account_type = p_account_type,
      institution = nullif(btrim(p_institution), ''),
      currency_code = upper(p_currency_code),
      opening_balance_minor = p_opening_balance_minor
    where id = p_account_id;

    v_account_id := p_account_id;
  end if;

  perform public.refresh_snapshot_for_user(v_user_id);
  return v_account_id;
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

  select (clock_timestamp() at time zone profile.timezone)::date
  into v_local_date
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
      coalesce(valuation.base_value_minor, 0),
      coalesce(valuation.native_value_minor, 0)
    into v_current_value, v_native_value
    from (select 1) seed
    left join lateral (
      select item.base_value_minor, item.native_value_minor
      from public.investment_valuations item
      where item.account_id = p_account_id
        and item.valued_at <= v_local_date
      order by item.valued_at desc, item.created_at desc
      limit 1
    ) valuation on true;
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
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication is required.';
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

create or replace function public.upsert_investment_valuation(
  p_account_id uuid,
  p_native_value_minor bigint,
  p_base_value_minor bigint,
  p_valued_at date
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_account public.accounts%rowtype;
  v_valuation_id uuid;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication is required.';
  end if;

  if p_native_value_minor is null or p_native_value_minor < 0
    or p_base_value_minor is null or p_base_value_minor < 0
  then
    raise exception using errcode = '22023', message = 'Investment values cannot be negative.';
  end if;

  if p_valued_at is null then
    raise exception using errcode = '22023', message = 'Valuation date is required.';
  end if;

  select account.*
  into v_account
  from public.accounts account
  where account.id = p_account_id
    and account.user_id = v_user_id
  for update;

  if not found then
    raise exception using errcode = '42501', message = 'Investment account not found.';
  end if;

  if v_account.account_type <> 'investment' then
    raise exception using errcode = '22023', message = 'The account is not an investment account.';
  end if;

  if v_account.archived_at is not null then
    raise exception using errcode = '22023', message = 'Archived accounts cannot be valued.';
  end if;

  insert into public.investment_valuations (
    user_id,
    account_id,
    native_value_minor,
    base_value_minor,
    valued_at
  )
  values (
    v_user_id,
    p_account_id,
    p_native_value_minor,
    p_base_value_minor,
    p_valued_at
  )
  on conflict (account_id, valued_at)
  do update set
    native_value_minor = excluded.native_value_minor,
    base_value_minor = excluded.base_value_minor
  returning id into v_valuation_id;

  perform public.refresh_snapshot_for_user(v_user_id);
  return v_valuation_id;
end;
$$;

commit;
