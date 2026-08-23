create table public.monthly_budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  month_start date not null,
  currency_code text not null,
  amount_minor bigint not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint monthly_budgets_month_first_day check (month_start = date_trunc('month', month_start)::date),
  constraint monthly_budgets_currency_code check (currency_code ~ '^[A-Z]{3}$'),
  constraint monthly_budgets_positive_amount check (amount_minor > 0),
  constraint monthly_budgets_user_month_unique unique (user_id, month_start)
);

create table public.category_budgets (
  id uuid primary key default gen_random_uuid(),
  monthly_budget_id uuid not null references public.monthly_budgets(id) on delete cascade,
  category_id uuid not null references public.categories(id),
  amount_minor bigint not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint category_budgets_positive_amount check (amount_minor > 0),
  constraint category_budgets_month_category_unique unique (monthly_budget_id, category_id)
);

create index category_budgets_category_id_idx on public.category_budgets(category_id);

create trigger monthly_budgets_set_updated_at
before update on public.monthly_budgets
for each row execute function public.set_updated_at();

create trigger category_budgets_set_updated_at
before update on public.category_budgets
for each row execute function public.set_updated_at();

create or replace function public.validate_category_budget()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_budget_user_id uuid;
  v_category public.categories%rowtype;
begin
  select user_id into v_budget_user_id
  from public.monthly_budgets
  where id = new.monthly_budget_id;

  if v_budget_user_id is null then
    raise exception 'Monthly budget not found.';
  end if;

  select * into v_category
  from public.categories
  where id = new.category_id;

  if v_category.id is null or v_category.user_id <> v_budget_user_id then
    raise exception 'Category does not belong to this budget.';
  end if;
  if v_category.category_type <> 'expense' or v_category.parent_id is not null then
    raise exception 'Category budgets require a parent expense category.';
  end if;
  if v_category.archived_at is not null then
    raise exception 'Archived categories cannot receive a category budget.';
  end if;

  return new;
end;
$$;

create trigger category_budgets_validate
before insert or update on public.category_budgets
for each row execute function public.validate_category_budget();

alter table public.monthly_budgets enable row level security;
alter table public.category_budgets enable row level security;

create policy "Users can view own monthly budgets"
on public.monthly_budgets for select
using (auth.uid() = user_id);

create policy "Users can view own category budgets"
on public.category_budgets for select
using (
  exists (
    select 1 from public.monthly_budgets mb
    where mb.id = monthly_budget_id and mb.user_id = auth.uid()
  )
);

create or replace function public.upsert_monthly_budget(
  p_month_start date,
  p_amount_minor bigint
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_currency_code text;
  v_existing_currency text;
  v_budget_id uuid;
begin
  if v_user_id is null then raise exception 'Authentication required.'; end if;
  if p_month_start is null or p_month_start <> date_trunc('month', p_month_start)::date then
    raise exception 'Budget month must be the first day of a month.';
  end if;
  if p_amount_minor is null or p_amount_minor <= 0 then
    raise exception 'Budget amount must be greater than zero.';
  end if;

  select base_currency into v_currency_code from public.profiles where id = v_user_id;
  if v_currency_code is null then raise exception 'Profile not found.'; end if;

  select currency_code into v_existing_currency
  from public.monthly_budgets
  where user_id = v_user_id and month_start = p_month_start;
  if v_existing_currency is not null and v_existing_currency <> v_currency_code then
    raise exception 'The saved budget currency no longer matches your base currency.';
  end if;

  insert into public.monthly_budgets (user_id, month_start, currency_code, amount_minor)
  values (v_user_id, p_month_start, v_currency_code, p_amount_minor)
  on conflict (user_id, month_start) do update
    set amount_minor = excluded.amount_minor, updated_at = now()
  returning id into v_budget_id;
  return v_budget_id;
end;
$$;

create or replace function public.upsert_category_budget(
  p_month_start date,
  p_category_id uuid,
  p_amount_minor bigint
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_monthly_budget_id uuid;
  v_category public.categories%rowtype;
  v_category_budget_id uuid;
begin
  if v_user_id is null then raise exception 'Authentication required.'; end if;
  if p_month_start is null or p_month_start <> date_trunc('month', p_month_start)::date then
    raise exception 'Budget month must be the first day of a month.';
  end if;
  if p_amount_minor is null or p_amount_minor <= 0 then
    raise exception 'Category budget amount must be greater than zero.';
  end if;

  select id into v_monthly_budget_id from public.monthly_budgets
  where user_id = v_user_id and month_start = p_month_start;
  if v_monthly_budget_id is null then raise exception 'Set the monthly budget first.'; end if;

  select * into v_category from public.categories
  where id = p_category_id and user_id = v_user_id;
  if v_category.id is null then raise exception 'Category not found.'; end if;
  if v_category.category_type <> 'expense' or v_category.parent_id is not null then
    raise exception 'Choose an expense parent category.';
  end if;
  if v_category.archived_at is not null then raise exception 'Archived categories cannot be budgeted.'; end if;

  insert into public.category_budgets (monthly_budget_id, category_id, amount_minor)
  values (v_monthly_budget_id, p_category_id, p_amount_minor)
  on conflict (monthly_budget_id, category_id) do update
    set amount_minor = excluded.amount_minor, updated_at = now()
  returning id into v_category_budget_id;
  return v_category_budget_id;
end;
$$;

create or replace function public.remove_category_budget(p_month_start date, p_category_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_user_id uuid := auth.uid();
begin
  if v_user_id is null then raise exception 'Authentication required.'; end if;
  delete from public.category_budgets cb
  using public.monthly_budgets mb
  where cb.monthly_budget_id = mb.id
    and mb.user_id = v_user_id
    and mb.month_start = p_month_start
    and cb.category_id = p_category_id;
  if not found then raise exception 'Category budget not found.'; end if;
end;
$$;

create or replace function public.copy_monthly_budget(
  p_source_month_start date,
  p_destination_month_start date
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_source public.monthly_budgets%rowtype;
  v_destination_id uuid;
  v_current_currency text;
  v_total_categories integer;
  v_copied_categories integer;
begin
  if v_user_id is null then raise exception 'Authentication required.'; end if;
  if p_source_month_start is null or p_source_month_start <> date_trunc('month', p_source_month_start)::date
     or p_destination_month_start is null or p_destination_month_start <> date_trunc('month', p_destination_month_start)::date then
    raise exception 'Budget months must be the first day of their month.';
  end if;
  if p_source_month_start <> (p_destination_month_start - interval '1 month')::date then
    raise exception 'Only the immediately previous month can be copied.';
  end if;

  select * into v_source from public.monthly_budgets
  where user_id = v_user_id and month_start = p_source_month_start;
  if v_source.id is null then raise exception 'Previous month budget not found.'; end if;
  if exists (select 1 from public.monthly_budgets where user_id = v_user_id and month_start = p_destination_month_start) then
    raise exception 'A budget already exists for the destination month.';
  end if;
  select base_currency into v_current_currency from public.profiles where id = v_user_id;
  if v_current_currency <> v_source.currency_code then
    raise exception 'The previous budget currency no longer matches your base currency.';
  end if;

  insert into public.monthly_budgets (user_id, month_start, currency_code, amount_minor)
  values (v_user_id, p_destination_month_start, v_source.currency_code, v_source.amount_minor)
  returning id into v_destination_id;

  select count(*) into v_total_categories
  from public.category_budgets where monthly_budget_id = v_source.id;

  insert into public.category_budgets (monthly_budget_id, category_id, amount_minor)
  select v_destination_id, cb.category_id, cb.amount_minor
  from public.category_budgets cb
  join public.categories c on c.id = cb.category_id
  where cb.monthly_budget_id = v_source.id
    and c.user_id = v_user_id
    and c.category_type = 'expense'
    and c.parent_id is null
    and c.archived_at is null;
  get diagnostics v_copied_categories = row_count;

  return jsonb_build_object(
    'monthly_budget_id', v_destination_id,
    'copied_category_count', v_copied_categories,
    'skipped_category_count', v_total_categories - v_copied_categories
  );
end;
$$;

create or replace function public.get_monthly_budget_summary(p_month_start date)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_budget public.monthly_budgets%rowtype;
  v_today date;
  v_current_month date;
  v_month_end date;
  v_days_in_month integer;
  v_elapsed_days integer;
  v_remaining_days integer;
  v_period_status text;
  v_spent_minor bigint := 0;
  v_remaining_minor bigint;
  v_over_budget_minor bigint;
  v_safe_daily_minor bigint;
  v_expected_minor bigint;
  v_pace_status text;
  v_category_budgets jsonb := '[]'::jsonb;
  v_excluded_foreign_count integer := 0;
  v_previous_exists boolean;
begin
  if v_user_id is null then raise exception 'Authentication required.'; end if;
  if p_month_start is null or p_month_start <> date_trunc('month', p_month_start)::date then
    raise exception 'Budget month must be the first day of a month.';
  end if;

  select * into v_profile from public.profiles where id = v_user_id;
  if v_profile.id is null then raise exception 'Profile not found.'; end if;
  v_today := (now() at time zone v_profile.timezone)::date;
  v_current_month := date_trunc('month', v_today)::date;
  v_month_end := (p_month_start + interval '1 month - 1 day')::date;
  v_days_in_month := v_month_end - p_month_start + 1;

  if p_month_start < v_current_month then
    v_period_status := 'past'; v_elapsed_days := v_days_in_month; v_remaining_days := 0;
  elsif p_month_start > v_current_month then
    v_period_status := 'future'; v_elapsed_days := 0; v_remaining_days := v_days_in_month;
  else
    v_period_status := 'current';
    v_elapsed_days := v_today - p_month_start + 1;
    v_remaining_days := v_month_end - v_today + 1;
  end if;

  select * into v_budget from public.monthly_budgets
  where user_id = v_user_id and month_start = p_month_start;
  select exists (
    select 1 from public.monthly_budgets
    where user_id = v_user_id and month_start = (p_month_start - interval '1 month')::date
  ) into v_previous_exists;

  with expense_facts as (
    select
      (-e.amount_minor)::bigint as amount_minor,
      coalesce(parent.id, c.id) as parent_category_id
    from public.transactions t
    join public.transaction_entries e on e.transaction_id = t.id
    join public.accounts a on a.id = e.account_id
      and a.user_id = v_user_id
      and a.currency_code = v_profile.base_currency
    left join public.categories c on c.id = t.category_id and c.user_id = v_user_id
    left join public.categories parent on parent.id = c.parent_id and parent.user_id = v_user_id
    where t.user_id = v_user_id
      and t.transaction_type = 'expense'
      and t.deleted_at is null
      and t.transaction_date between p_month_start and v_month_end
  ),
  category_spending as (
    select parent_category_id, coalesce(sum(amount_minor), 0)::bigint as spent_minor
    from expense_facts group by parent_category_id
  )
  select
    coalesce((select sum(amount_minor) from expense_facts), 0)::bigint,
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', cb.id,
        'category_id', c.id,
        'category_name', c.name,
        'category_archived', c.archived_at is not null,
        'budget_minor', cb.amount_minor,
        'spent_minor', coalesce(cs.spent_minor, 0),
        'remaining_minor', cb.amount_minor - coalesce(cs.spent_minor, 0)
      ) order by c.name)
      from public.category_budgets cb
      join public.categories c on c.id = cb.category_id
      left join category_spending cs on cs.parent_category_id = c.id
      where cb.monthly_budget_id = v_budget.id
    ), '[]'::jsonb)
  into v_spent_minor, v_category_budgets;

  select count(distinct t.id) into v_excluded_foreign_count
  from public.transactions t
  join public.transaction_entries e on e.transaction_id = t.id
  join public.accounts a on a.id = e.account_id and a.user_id = v_user_id
  where t.user_id = v_user_id
    and t.transaction_type = 'expense'
    and t.deleted_at is null
    and t.transaction_date between p_month_start and v_month_end
    and a.currency_code <> v_profile.base_currency;

  if v_budget.id is not null then
    v_remaining_minor := v_budget.amount_minor - v_spent_minor;
    v_over_budget_minor := greatest(v_spent_minor - v_budget.amount_minor, 0);
    if v_period_status = 'current' then
      v_safe_daily_minor := round(greatest(v_remaining_minor, 0)::numeric / v_remaining_days)::bigint;
      v_expected_minor := round(v_budget.amount_minor::numeric * v_elapsed_days / v_days_in_month)::bigint;
      if v_spent_minor > v_budget.amount_minor then v_pace_status := 'over_budget';
      elsif v_spent_minor <= v_expected_minor then v_pace_status := 'on_track';
      else v_pace_status := 'ahead_of_pace'; end if;
    elsif v_period_status = 'past' then
      v_pace_status := case when v_spent_minor > v_budget.amount_minor then 'over_budget' else 'within_budget' end;
    else
      v_pace_status := 'not_started';
    end if;
  else
    v_pace_status := 'no_budget';
  end if;

  return jsonb_build_object(
    'month_start', p_month_start,
    'month_end', v_month_end,
    'period_status', v_period_status,
    'budget_exists', v_budget.id is not null,
    'previous_budget_exists', v_previous_exists,
    'budget_id', v_budget.id,
    'currency_code', coalesce(v_budget.currency_code, v_profile.base_currency),
    'currency_mismatch', v_budget.id is not null and v_budget.currency_code <> v_profile.base_currency,
    'overall_budget_minor', v_budget.amount_minor,
    'spent_minor', v_spent_minor,
    'remaining_minor', v_remaining_minor,
    'over_budget_minor', v_over_budget_minor,
    'days_in_month', v_days_in_month,
    'elapsed_days', v_elapsed_days,
    'remaining_days_including_today', v_remaining_days,
    'safe_daily_spend_minor', v_safe_daily_minor,
    'expected_spend_minor', v_expected_minor,
    'pace_status', v_pace_status,
    'category_budgets', v_category_budgets,
    'excluded_foreign_expense_count', v_excluded_foreign_count
  );
end;
$$;

revoke all on table public.monthly_budgets from anon, authenticated;
revoke all on table public.category_budgets from anon, authenticated;
grant select on table public.monthly_budgets to authenticated;
grant select on table public.category_budgets to authenticated;

revoke all on function public.validate_category_budget() from public, anon, authenticated;
revoke all on function public.upsert_monthly_budget(date, bigint) from public, anon;
revoke all on function public.upsert_category_budget(date, uuid, bigint) from public, anon;
revoke all on function public.remove_category_budget(date, uuid) from public, anon;
revoke all on function public.copy_monthly_budget(date, date) from public, anon;
revoke all on function public.get_monthly_budget_summary(date) from public, anon;
grant execute on function public.upsert_monthly_budget(date, bigint) to authenticated;
grant execute on function public.upsert_category_budget(date, uuid, bigint) to authenticated;
grant execute on function public.remove_category_budget(date, uuid) to authenticated;
grant execute on function public.copy_monthly_budget(date, date) to authenticated;
grant execute on function public.get_monthly_budget_summary(date) to authenticated;
