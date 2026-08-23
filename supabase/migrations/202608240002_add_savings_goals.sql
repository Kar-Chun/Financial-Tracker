create table public.savings_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  target_amount_minor bigint not null,
  currency_code text not null,
  target_date date,
  note text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint savings_goals_name_trimmed check (name = btrim(name) and char_length(name) between 1 and 100),
  constraint savings_goals_positive_target check (target_amount_minor > 0),
  constraint savings_goals_currency_code check (currency_code ~ '^[A-Z]{3}$'),
  constraint savings_goals_note_length check (note is null or char_length(note) <= 500)
);

create table public.goal_allocations (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.savings_goals(id) on delete cascade,
  amount_minor bigint not null,
  allocation_date date not null,
  note text,
  created_at timestamptz not null default now(),
  constraint goal_allocations_nonzero_amount check (amount_minor <> 0),
  constraint goal_allocations_note_length check (note is null or char_length(note) <= 300)
);

create index savings_goals_user_active_idx
on public.savings_goals(user_id, archived_at, created_at);

create index goal_allocations_goal_date_idx
on public.goal_allocations(goal_id, allocation_date desc, created_at desc);

create trigger savings_goals_set_updated_at
before update on public.savings_goals
for each row execute function public.set_updated_at();

create or replace function public.validate_savings_goal_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.user_id <> old.user_id then raise exception 'Goal ownership cannot be changed.'; end if;
  if new.currency_code <> old.currency_code then raise exception 'Goal currency cannot be changed.'; end if;
  return new;
end;
$$;

create trigger savings_goals_validate_update
before update on public.savings_goals
for each row execute function public.validate_savings_goal_update();

create or replace function public.validate_goal_allocation_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
declare v_current_allocated bigint;
begin
  perform 1 from public.savings_goals where id = new.goal_id for update;
  if not found then raise exception 'Savings goal not found.'; end if;

  select coalesce(sum(amount_minor), 0)::bigint into v_current_allocated
  from public.goal_allocations where goal_id = new.goal_id;

  if v_current_allocated + new.amount_minor < 0 then
    raise exception 'Allocation cannot be reduced below zero.';
  end if;
  return new;
end;
$$;

create trigger goal_allocations_validate_insert
before insert on public.goal_allocations
for each row execute function public.validate_goal_allocation_insert();

alter table public.savings_goals enable row level security;
alter table public.goal_allocations enable row level security;

create policy "Users can view own savings goals"
on public.savings_goals for select
using (auth.uid() = user_id);

create policy "Users can view own goal allocations"
on public.goal_allocations for select
using (
  exists (
    select 1 from public.savings_goals goal
    where goal.id = goal_id and goal.user_id = auth.uid()
  )
);

create or replace function public.upsert_savings_goal(
  p_name text,
  p_target_amount_minor bigint,
  p_target_date date default null,
  p_note text default null,
  p_goal_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_name text := btrim(coalesce(p_name, ''));
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_currency_code text;
  v_goal public.savings_goals%rowtype;
  v_goal_id uuid;
begin
  if v_user_id is null then raise exception 'Authentication required.'; end if;
  if char_length(v_name) < 1 or char_length(v_name) > 100 then raise exception 'Goal name must be between 1 and 100 characters.'; end if;
  if p_target_amount_minor is null or p_target_amount_minor <= 0 then raise exception 'Goal target must be greater than zero.'; end if;
  if v_note is not null and char_length(v_note) > 500 then raise exception 'Goal note is too long.'; end if;

  if p_goal_id is null then
    select base_currency into v_currency_code from public.profiles where id = v_user_id;
    if v_currency_code is null then raise exception 'Profile not found.'; end if;
    insert into public.savings_goals (user_id, name, target_amount_minor, currency_code, target_date, note)
    values (v_user_id, v_name, p_target_amount_minor, v_currency_code, p_target_date, v_note)
    returning id into v_goal_id;
  else
    select * into v_goal from public.savings_goals where id = p_goal_id and user_id = v_user_id for update;
    if v_goal.id is null then raise exception 'Savings goal not found.'; end if;
    if v_goal.archived_at is not null then raise exception 'Restore the savings goal before editing it.'; end if;
    update public.savings_goals
    set name = v_name, target_amount_minor = p_target_amount_minor, target_date = p_target_date, note = v_note
    where id = v_goal.id
    returning id into v_goal_id;
  end if;
  return v_goal_id;
end;
$$;

create or replace function public.set_savings_goal_archived(p_goal_id uuid, p_archived boolean)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare v_user_id uuid := auth.uid(); v_goal_id uuid;
begin
  if v_user_id is null then raise exception 'Authentication required.'; end if;
  update public.savings_goals
  set archived_at = case when p_archived then coalesce(archived_at, now()) else null end
  where id = p_goal_id and user_id = v_user_id
  returning id into v_goal_id;
  if v_goal_id is null then raise exception 'Savings goal not found.'; end if;
  return v_goal_id;
end;
$$;

create or replace function public.record_goal_allocation(
  p_goal_id uuid,
  p_operation text,
  p_amount_minor bigint,
  p_allocation_date date,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_goal public.savings_goals%rowtype;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_signed_amount bigint;
  v_allocation_id uuid;
begin
  if v_user_id is null then raise exception 'Authentication required.'; end if;
  if p_operation not in ('allocate', 'reduce') then raise exception 'Allocation operation must be allocate or reduce.'; end if;
  if p_amount_minor is null or p_amount_minor <= 0 then raise exception 'Allocation amount must be greater than zero.'; end if;
  if p_allocation_date is null then raise exception 'Allocation date is required.'; end if;
  if v_note is not null and char_length(v_note) > 300 then raise exception 'Allocation note is too long.'; end if;

  select * into v_goal from public.savings_goals
  where id = p_goal_id and user_id = v_user_id for update;
  if v_goal.id is null then raise exception 'Savings goal not found.'; end if;
  if v_goal.archived_at is not null then raise exception 'Archived savings goals cannot be allocated.'; end if;

  v_signed_amount := case when p_operation = 'allocate' then p_amount_minor else -p_amount_minor end;
  insert into public.goal_allocations (goal_id, amount_minor, allocation_date, note)
  values (v_goal.id, v_signed_amount, p_allocation_date, v_note)
  returning id into v_allocation_id;
  return v_allocation_id;
end;
$$;

create or replace function public.get_savings_goals_summary(p_include_archived boolean default false)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_today date;
  v_current_month date;
  v_available_cash bigint := 0;
  v_total_allocated bigint := 0;
  v_foreign_liquid_count integer := 0;
  v_goals jsonb := '[]'::jsonb;
begin
  if v_user_id is null then raise exception 'Authentication required.'; end if;
  select * into v_profile from public.profiles where id = v_user_id;
  if v_profile.id is null then raise exception 'Profile not found.'; end if;
  v_today := (now() at time zone v_profile.timezone)::date;
  v_current_month := date_trunc('month', v_today)::date;

  select
    coalesce(sum(current_balance_minor) filter (
      where account_type in ('bank', 'cash') and included_in_net_worth
    ), 0)::bigint,
    count(*) filter (
      where account_type in ('bank', 'cash') and not included_in_net_worth
    )::integer
  into v_available_cash, v_foreign_liquid_count
  from public.get_account_summaries();

  with goal_values as (
    select
      goal.*,
      coalesce(sum(allocation.amount_minor), 0)::bigint as allocated_minor
    from public.savings_goals goal
    left join public.goal_allocations allocation on allocation.goal_id = goal.id
    where goal.user_id = v_user_id
      and (p_include_archived or goal.archived_at is null)
    group by goal.id
  ), goal_details as (
    select
      goal_values.*,
      greatest(target_amount_minor - allocated_minor, 0)::bigint as remaining_minor,
      allocated_minor >= target_amount_minor as reached,
      case
        when target_date is null or allocated_minor >= target_amount_minor then null
        when date_trunc('month', target_date)::date < v_current_month then null
        else (
          (extract(year from target_date)::integer - extract(year from v_current_month)::integer) * 12
          + extract(month from target_date)::integer - extract(month from v_current_month)::integer + 1
        )
      end as months_remaining
    from goal_values
  )
  select
    coalesce(sum(allocated_minor) filter (
      where archived_at is null and currency_code = v_profile.base_currency
    ), 0)::bigint,
    coalesce(jsonb_agg(jsonb_build_object(
      'id', id,
      'name', name,
      'target_amount_minor', target_amount_minor,
      'currency_code', currency_code,
      'target_date', target_date,
      'note', note,
      'archived_at', archived_at,
      'allocated_minor', allocated_minor,
      'remaining_minor', remaining_minor,
      'reached', reached,
      'target_date_passed', target_date is not null and date_trunc('month', target_date)::date < v_current_month and not reached,
      'months_remaining', months_remaining,
      'required_monthly_minor', case
        when months_remaining is null then null
        else (remaining_minor + months_remaining - 1) / months_remaining
      end,
      'created_at', created_at,
      'updated_at', updated_at
    ) order by (archived_at is not null), reached, target_date nulls last, created_at), '[]'::jsonb)
  into v_total_allocated, v_goals
  from goal_details;

  return jsonb_build_object(
    'currency_code', v_profile.base_currency,
    'available_cash_minor', v_available_cash,
    'total_allocated_minor', v_total_allocated,
    'unallocated_cash_minor', v_available_cash - v_total_allocated,
    'foreign_liquid_account_count', v_foreign_liquid_count,
    'goals', v_goals
  );
end;
$$;

create or replace function public.get_savings_goal_detail(p_goal_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_goal public.savings_goals%rowtype;
  v_allocated bigint;
  v_history jsonb;
begin
  if v_user_id is null then raise exception 'Authentication required.'; end if;
  select * into v_goal from public.savings_goals where id = p_goal_id and user_id = v_user_id;
  if v_goal.id is null then raise exception 'Savings goal not found.'; end if;

  select
    coalesce(sum(amount_minor), 0)::bigint,
    coalesce(jsonb_agg(jsonb_build_object(
      'id', id,
      'amount_minor', amount_minor,
      'allocation_date', allocation_date,
      'note', note,
      'created_at', created_at
    ) order by allocation_date desc, created_at desc), '[]'::jsonb)
  into v_allocated, v_history
  from public.goal_allocations where goal_id = v_goal.id;

  return jsonb_build_object(
    'id', v_goal.id,
    'name', v_goal.name,
    'target_amount_minor', v_goal.target_amount_minor,
    'currency_code', v_goal.currency_code,
    'target_date', v_goal.target_date,
    'note', v_goal.note,
    'archived_at', v_goal.archived_at,
    'allocated_minor', v_allocated,
    'remaining_minor', greatest(v_goal.target_amount_minor - v_allocated, 0),
    'reached', v_allocated >= v_goal.target_amount_minor,
    'allocations', v_history,
    'created_at', v_goal.created_at,
    'updated_at', v_goal.updated_at
  );
end;
$$;

revoke all on table public.savings_goals from anon, authenticated;
revoke all on table public.goal_allocations from anon, authenticated;
grant select on table public.savings_goals to authenticated;
grant select on table public.goal_allocations to authenticated;

revoke all on function public.validate_savings_goal_update() from public, anon, authenticated;
revoke all on function public.validate_goal_allocation_insert() from public, anon, authenticated;
revoke all on function public.upsert_savings_goal(text, bigint, date, text, uuid) from public, anon;
revoke all on function public.set_savings_goal_archived(uuid, boolean) from public, anon;
revoke all on function public.record_goal_allocation(uuid, text, bigint, date, text) from public, anon;
revoke all on function public.get_savings_goals_summary(boolean) from public, anon;
revoke all on function public.get_savings_goal_detail(uuid) from public, anon;
grant execute on function public.upsert_savings_goal(text, bigint, date, text, uuid) to authenticated;
grant execute on function public.set_savings_goal_archived(uuid, boolean) to authenticated;
grant execute on function public.record_goal_allocation(uuid, text, bigint, date, text) to authenticated;
grant execute on function public.get_savings_goals_summary(boolean) to authenticated;
grant execute on function public.get_savings_goal_detail(uuid) to authenticated;
