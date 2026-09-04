begin;

-- Internal fact layer for ordinary base-currency spending. It is deliberately
-- not executable by browser roles; authenticated read RPCs aggregate it.
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

revoke all on function public.get_eligible_expense_facts(date, date)
  from public, anon, authenticated;

create or replace function public.get_spending_analytics(
  p_start_date date,
  p_end_date date,
  p_previous_start_date date,
  p_previous_end_date date,
  p_trend_granularity text default 'day'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_base_currency text;
  v_result jsonb;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication is required.';
  end if;

  if p_start_date is null
    or p_end_date is null
    or p_previous_start_date is null
    or p_previous_end_date is null
  then
    raise exception using errcode = '22023', message = 'Analytics date ranges are required.';
  end if;

  if p_end_date < p_start_date
    or p_previous_end_date < p_previous_start_date
    or p_previous_end_date >= p_start_date
  then
    raise exception using errcode = '22023', message = 'Analytics date ranges are invalid.';
  end if;

  if (p_end_date - p_start_date) > 3660
    or (p_previous_end_date - p_previous_start_date) > 3660
  then
    raise exception using errcode = '22023', message = 'Analytics ranges cannot exceed ten years.';
  end if;

  if p_trend_granularity not in ('day', 'month') then
    raise exception using errcode = '22023', message = 'Analytics trend granularity is invalid.';
  end if;

  select profile.base_currency
  into v_base_currency
  from public.profiles profile
  where profile.id = v_user_id;

  if not found then
    raise exception using errcode = 'P0001', message = 'A user profile is required.';
  end if;

  with expense_facts as materialized (
    select fact.*
    from public.get_eligible_expense_facts(p_start_date, p_end_date) fact
    union all
    select fact.*
    from public.get_eligible_expense_facts(p_previous_start_date, p_previous_end_date) fact
  ),
  current_facts as (
    select *
    from expense_facts
    where transaction_date between p_start_date and p_end_date
  ),
  previous_facts as (
    select *
    from expense_facts
    where transaction_date between p_previous_start_date and p_previous_end_date
  ),
  current_summary as (
    select
      coalesce(sum(amount_minor), 0)::bigint as total_spent_minor,
      count(*)::integer as expense_count
    from current_facts
  ),
  previous_summary as (
    select
      coalesce(sum(amount_minor), 0)::bigint as total_spent_minor,
      count(*)::integer as expense_count
    from previous_facts
  ),
  current_categories as (
    select
      root_category_id,
      coalesce(root_category_name, 'Uncategorised') as name,
      sum(amount_minor)::bigint as amount_minor,
      sum(amount_minor) filter (where category_parent_id is null)::bigint as direct_amount_minor
    from current_facts
    group by root_category_id, root_category_name
  ),
  previous_categories as (
    select
      root_category_id,
      sum(amount_minor)::bigint as amount_minor
    from previous_facts
    group by root_category_id
  ),
  current_subcategories as (
    select
      root_category_id,
      category_id,
      category_name as name,
      sum(amount_minor)::bigint as amount_minor
    from current_facts
    where category_parent_id is not null
    group by root_category_id, category_id, category_name
  ),
  trend_totals as (
    select
      case
        when p_trend_granularity = 'month'
        then date_trunc('month', transaction_date)::date
        else transaction_date
      end as bucket_date,
      sum(amount_minor)::bigint as amount_minor
    from current_facts
    group by 1
  ),
  trend_series as (
    select series_date::date as bucket_date
    from pg_catalog.generate_series(
      case
        when p_trend_granularity = 'month' then date_trunc('month', p_start_date)::date
        else p_start_date
      end,
      case
        when p_trend_granularity = 'month' then date_trunc('month', p_end_date)::date
        else p_end_date
      end,
      case
        when p_trend_granularity = 'month' then interval '1 month'
        else interval '1 day'
      end
    ) as series(series_date)
  ),
  excluded_foreign as (
    select count(distinct transaction_record.id)::integer as expense_count
    from public.transactions transaction_record
    join public.transaction_entries entry on entry.transaction_id = transaction_record.id
    join public.accounts account
      on account.id = entry.account_id
      and account.user_id = v_user_id
    where transaction_record.user_id = v_user_id
      and transaction_record.transaction_type = 'expense'
      and transaction_record.deleted_at is null
      and transaction_record.transaction_date between p_start_date and p_end_date
      and account.currency_code <> v_base_currency
  )
  select jsonb_build_object(
    'period', jsonb_build_object(
      'start_date', p_start_date,
      'end_date', p_end_date,
      'previous_start_date', p_previous_start_date,
      'previous_end_date', p_previous_end_date,
      'trend_granularity', p_trend_granularity
    ),
    'summary', jsonb_build_object(
      'total_spent_minor', current_summary.total_spent_minor,
      'average_daily_spend_minor', round(
        current_summary.total_spent_minor::numeric / greatest((p_end_date - p_start_date) + 1, 1)
      )::bigint,
      'expense_count', current_summary.expense_count,
      'largest_category_name', (
        select category.name
        from current_categories category
        order by category.amount_minor desc, category.name
        limit 1
      )
    ),
    'previous_summary', jsonb_build_object(
      'total_spent_minor', previous_summary.total_spent_minor,
      'expense_count', previous_summary.expense_count
    ),
    'categories', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'category_id', category.root_category_id,
          'name', category.name,
          'amount_minor', category.amount_minor,
          'previous_amount_minor', coalesce(previous.amount_minor, 0),
          'direct_amount_minor', coalesce(category.direct_amount_minor, 0),
          'subcategories', coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'category_id', subcategory.category_id,
                'name', subcategory.name,
                'amount_minor', subcategory.amount_minor
              )
              order by subcategory.amount_minor desc, subcategory.name
            )
            from current_subcategories subcategory
            where subcategory.root_category_id is not distinct from category.root_category_id
          ), '[]'::jsonb)
        )
        order by category.amount_minor desc, category.name
      )
      from current_categories category
      left join previous_categories previous
        on previous.root_category_id is not distinct from category.root_category_id
    ), '[]'::jsonb),
    'trend', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'bucket_date', series.bucket_date,
          'amount_minor', coalesce(total.amount_minor, 0)
        )
        order by series.bucket_date
      )
      from trend_series series
      left join trend_totals total on total.bucket_date = series.bucket_date
    ), '[]'::jsonb),
    'excluded_foreign_expense_count', excluded_foreign.expense_count
  )
  into v_result
  from current_summary, previous_summary, excluded_foreign;

  return v_result;
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
      fact.amount_minor,
      fact.root_category_id as parent_category_id
    from public.get_eligible_expense_facts(p_month_start, v_month_end) fact
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

create or replace function public.get_ai_financial_overview()
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
  v_month_start date;
  v_bank_cash_minor bigint := 0;
  v_investment_minor bigint := 0;
  v_income_minor bigint := 0;
  v_expense_minor bigint := 0;
  v_excluded_foreign_count integer := 0;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication is required.';
  end if;

  select * into v_profile from public.profiles where id = v_user_id;
  if v_profile.id is null then raise exception 'Profile not found.'; end if;

  v_today := (current_timestamp at time zone v_profile.timezone)::date;
  v_month_start := date_trunc('month', v_today)::date;

  select
    coalesce(sum(summary.current_balance_minor) filter (
      where summary.account_type in ('bank', 'cash') and summary.included_in_net_worth
    ), 0)::bigint,
    coalesce(sum(summary.base_value_minor) filter (
      where summary.account_type = 'investment' and summary.included_in_net_worth
    ), 0)::bigint
  into v_bank_cash_minor, v_investment_minor
  from public.get_account_summaries() summary;

  select coalesce(sum(entry.amount_minor), 0)::bigint
  into v_income_minor
  from public.transactions transaction_record
  join public.transaction_entries entry on entry.transaction_id = transaction_record.id
  join public.accounts account on account.id = entry.account_id
    and account.user_id = v_user_id
    and account.currency_code = v_profile.base_currency
  where transaction_record.user_id = v_user_id
    and transaction_record.deleted_at is null
    and transaction_record.transaction_date between v_month_start and v_today
    and transaction_record.transaction_type = 'income';

  select coalesce(sum(fact.amount_minor), 0)::bigint
  into v_expense_minor
  from public.get_eligible_expense_facts(v_month_start, v_today) fact;

  select count(distinct transaction_record.id)::integer
  into v_excluded_foreign_count
  from public.transactions transaction_record
  join public.transaction_entries entry on entry.transaction_id = transaction_record.id
  join public.accounts account on account.id = entry.account_id and account.user_id = v_user_id
  where transaction_record.user_id = v_user_id
    and transaction_record.deleted_at is null
    and transaction_record.transaction_date between v_month_start and v_today
    and transaction_record.transaction_type in ('income', 'expense')
    and account.currency_code <> v_profile.base_currency;

  return jsonb_build_object(
    'base_currency', v_profile.base_currency,
    'timezone', v_profile.timezone,
    'local_date', v_today,
    'month_start', v_month_start,
    'net_worth_minor', v_bank_cash_minor + v_investment_minor,
    'bank_cash_minor', v_bank_cash_minor,
    'investments_minor', v_investment_minor,
    'monthly_income_minor', v_income_minor,
    'monthly_expenses_minor', v_expense_minor,
    'monthly_net_cash_flow_minor', v_income_minor - v_expense_minor,
    'excluded_foreign_transaction_count', v_excluded_foreign_count
  );
end;
$$;

revoke all on function public.get_spending_analytics(date, date, date, date, text)
  from public, anon;
revoke all on function public.get_monthly_budget_summary(date)
  from public, anon;
revoke all on function public.get_ai_financial_overview()
  from public, anon;

grant execute on function public.get_spending_analytics(date, date, date, date, text)
  to authenticated;
grant execute on function public.get_monthly_budget_summary(date)
  to authenticated;
grant execute on function public.get_ai_financial_overview()
  to authenticated;

commit;
