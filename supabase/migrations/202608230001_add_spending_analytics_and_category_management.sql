begin;

create index transactions_active_expense_user_date_idx
  on public.transactions (user_id, transaction_date, category_id)
  where deleted_at is null and transaction_type = 'expense';

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

  with expense_facts as (
    select
      transaction_record.id,
      transaction_record.transaction_date,
      (-entry.amount_minor)::bigint as amount_minor,
      category.id as category_id,
      category.name as category_name,
      category.parent_id,
      coalesce(parent.id, category.id) as root_category_id,
      coalesce(parent.name, category.name) as root_category_name
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
      and (
        transaction_record.transaction_date between p_start_date and p_end_date
        or transaction_record.transaction_date between p_previous_start_date and p_previous_end_date
      )
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
      sum(amount_minor) filter (where parent_id is null)::bigint as direct_amount_minor
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
    where parent_id is not null
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

create or replace function public.upsert_category(
  p_name text,
  p_category_type text,
  p_parent_id uuid default null,
  p_category_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_name text := btrim(p_name);
  v_category public.categories%rowtype;
  v_parent public.categories%rowtype;
  v_category_id uuid;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication is required.';
  end if;

  if v_name is null or char_length(v_name) not between 1 and 100 then
    raise exception using errcode = '22023', message = 'Category name is required and must be at most 100 characters.';
  end if;

  if p_category_type not in ('expense', 'income') then
    raise exception using errcode = '22023', message = 'Category type is invalid.';
  end if;

  if p_parent_id is not null then
    select parent.*
    into v_parent
    from public.categories parent
    where parent.id = p_parent_id
      and parent.user_id = v_user_id
    for update;

    if not found then
      raise exception using errcode = '42501', message = 'Parent category not found.';
    end if;

    if v_parent.parent_id is not null then
      raise exception using errcode = '22023', message = 'V1.1 categories support only one parent level.';
    end if;

    if v_parent.category_type <> p_category_type then
      raise exception using errcode = '22023', message = 'A subcategory must have the same type as its parent.';
    end if;

    if v_parent.archived_at is not null then
      raise exception using errcode = '22023', message = 'Archived parents cannot receive new subcategories.';
    end if;
  end if;

  if p_category_id is null then
    insert into public.categories (user_id, name, parent_id, category_type)
    values (v_user_id, v_name, p_parent_id, p_category_type)
    returning id into v_category_id;
  else
    select category.*
    into v_category
    from public.categories category
    where category.id = p_category_id
      and category.user_id = v_user_id
    for update;

    if not found then
      raise exception using errcode = '42501', message = 'Category not found.';
    end if;

    if v_category.category_type <> p_category_type
      or v_category.parent_id is distinct from p_parent_id
    then
      raise exception using errcode = '22023', message = 'Category type and parent cannot be changed.';
    end if;

    update public.categories
    set name = v_name
    where id = v_category.id;

    v_category_id := v_category.id;
  end if;

  return v_category_id;
exception
  when unique_violation then
    raise exception using
      errcode = '23505',
      message = 'An active category with this name already exists in this location.';
end;
$$;

create or replace function public.set_category_archived(
  p_category_id uuid,
  p_archived boolean
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_category public.categories%rowtype;
  v_parent public.categories%rowtype;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication is required.';
  end if;

  if p_archived is null then
    raise exception using errcode = '22023', message = 'Archive state is required.';
  end if;

  select category.*
  into v_category
  from public.categories category
  where category.id = p_category_id
    and category.user_id = v_user_id
  for update;

  if not found then
    raise exception using errcode = '42501', message = 'Category not found.';
  end if;

  if p_archived then
    if v_category.archived_at is not null then
      return v_category.id;
    end if;

    if v_category.parent_id is null and exists (
      select 1
      from public.categories child
      where child.parent_id = v_category.id
        and child.user_id = v_user_id
        and child.archived_at is null
    ) then
      raise exception using errcode = '22023', message = 'Archive its subcategories first.';
    end if;

    update public.categories
    set archived_at = now()
    where id = v_category.id;
  else
    if v_category.archived_at is null then
      return v_category.id;
    end if;

    if v_category.parent_id is not null then
      select parent.*
      into v_parent
      from public.categories parent
      where parent.id = v_category.parent_id
        and parent.user_id = v_user_id;

      if not found or v_parent.archived_at is not null then
        raise exception using errcode = '22023', message = 'Restore the parent category first.';
      end if;
    end if;

    if exists (
      select 1
      from public.categories existing
      where existing.user_id = v_user_id
        and existing.id <> v_category.id
        and existing.category_type = v_category.category_type
        and existing.parent_id is not distinct from v_category.parent_id
        and lower(existing.name) = lower(v_category.name)
        and existing.archived_at is null
    ) then
      raise exception using
        errcode = '23505',
        message = 'An active category with this name already exists in this location.';
    end if;

    update public.categories
    set archived_at = null
    where id = v_category.id;
  end if;

  return v_category.id;
end;
$$;

revoke execute on function public.get_spending_analytics(date, date, date, date, text) from public, anon;
revoke execute on function public.upsert_category(text, text, uuid, uuid) from public, anon;
revoke execute on function public.set_category_archived(uuid, boolean) from public, anon;

grant execute on function public.get_spending_analytics(date, date, date, date, text) to authenticated;
grant execute on function public.upsert_category(text, text, uuid, uuid) to authenticated;
grant execute on function public.set_category_archived(uuid, boolean) to authenticated;

commit;
