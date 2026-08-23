begin;

create or replace function public.get_frequent_expense_categories(
  p_limit integer default 5,
  p_days integer default 90
)
returns table (
  category_id uuid,
  usage_count bigint,
  last_used_on date
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_today date;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication is required.';
  end if;

  if p_limit is null or p_limit not between 1 and 5 then
    raise exception using errcode = '22023', message = 'Frequent category limit must be between 1 and 5.';
  end if;

  if p_days is null or p_days not between 1 and 365 then
    raise exception using errcode = '22023', message = 'Frequent category range must be between 1 and 365 days.';
  end if;

  select (pg_catalog.now() at time zone profile.timezone)::date
  into v_today
  from public.profiles profile
  where profile.id = v_user_id;

  if not found then
    raise exception using errcode = 'P0001', message = 'A user profile is required.';
  end if;

  return query
  select
    category.id as category_id,
    count(*)::bigint as usage_count,
    max(transaction_record.transaction_date)::date as last_used_on
  from public.transactions transaction_record
  join public.categories category
    on category.id = transaction_record.category_id
    and category.user_id = v_user_id
    and category.category_type = 'expense'
    and category.archived_at is null
  where transaction_record.user_id = v_user_id
    and transaction_record.transaction_type = 'expense'
    and transaction_record.deleted_at is null
    and transaction_record.transaction_date between (v_today - (p_days - 1)) and v_today
  group by category.id, category.name
  order by count(*) desc, max(transaction_record.transaction_date) desc, lower(category.name)
  limit p_limit;
end;
$$;

revoke execute on function public.get_frequent_expense_categories(integer, integer) from public, anon;
grant execute on function public.get_frequent_expense_categories(integer, integer) to authenticated;

commit;
