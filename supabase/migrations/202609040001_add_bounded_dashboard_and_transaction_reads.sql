begin;

create or replace function public.get_transactions_page(
  p_start_date date default null,
  p_end_date date default null,
  p_transaction_type text default null,
  p_account_id uuid default null,
  p_category_id uuid default null,
  p_limit integer default 40,
  p_cursor_transaction_date date default null,
  p_cursor_created_at timestamptz default null,
  p_cursor_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_limit integer := least(greatest(coalesce(p_limit, 40), 1), 100);
  v_result jsonb;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication is required.';
  end if;

  if p_start_date is not null and p_end_date is not null and p_end_date < p_start_date then
    raise exception using errcode = '22023', message = 'Transaction date range is invalid.';
  end if;

  if p_transaction_type is not null
    and p_transaction_type not in ('expense', 'income', 'transfer', 'refund', 'adjustment')
  then
    raise exception using errcode = '22023', message = 'Transaction type filter is invalid.';
  end if;

  if (
    (p_cursor_transaction_date is null and (p_cursor_created_at is not null or p_cursor_id is not null))
    or (p_cursor_created_at is null and (p_cursor_transaction_date is not null or p_cursor_id is not null))
    or (p_cursor_id is null and (p_cursor_transaction_date is not null or p_cursor_created_at is not null))
  ) then
    raise exception using errcode = '22023', message = 'Transaction cursor is incomplete.';
  end if;

  if p_account_id is not null and not exists (
    select 1
    from public.accounts account
    where account.id = p_account_id
      and account.user_id = v_user_id
  ) then
    raise exception using errcode = '42501', message = 'Account filter is unavailable.';
  end if;

  if p_category_id is not null and not exists (
    select 1
    from public.categories category
    where category.id = p_category_id
      and category.user_id = v_user_id
  ) then
    raise exception using errcode = '42501', message = 'Category filter is unavailable.';
  end if;

  with candidates as materialized (
    select transaction_record.*
    from public.transactions transaction_record
    where transaction_record.user_id = v_user_id
      and transaction_record.deleted_at is null
      and (p_start_date is null or transaction_record.transaction_date >= p_start_date)
      and (p_end_date is null or transaction_record.transaction_date <= p_end_date)
      and (p_transaction_type is null or transaction_record.transaction_type = p_transaction_type)
      and (p_category_id is null or transaction_record.category_id = p_category_id)
      and (
        p_account_id is null
        or exists (
          select 1
          from public.transaction_entries filtered_entry
          join public.accounts filtered_account
            on filtered_account.id = filtered_entry.account_id
            and filtered_account.user_id = v_user_id
          where filtered_entry.transaction_id = transaction_record.id
            and filtered_entry.account_id = p_account_id
        )
      )
      and (
        p_cursor_transaction_date is null
        or (transaction_record.transaction_date, transaction_record.created_at, transaction_record.id)
          < (p_cursor_transaction_date, p_cursor_created_at, p_cursor_id)
      )
    order by transaction_record.transaction_date desc, transaction_record.created_at desc, transaction_record.id desc
    limit v_limit + 1
  ), page_rows as (
    select candidate.*
    from candidates candidate
    order by candidate.transaction_date desc, candidate.created_at desc, candidate.id desc
    limit v_limit
  ), serialized as (
    select
      page_row.transaction_date,
      page_row.created_at,
      page_row.id,
      jsonb_build_object(
        'id', page_row.id,
        'transaction_type', page_row.transaction_type,
        'category_id', page_row.category_id,
        'description', page_row.description,
        'transaction_date', page_row.transaction_date,
        'created_at', page_row.created_at,
        'category', case
          when category.id is null then null
          else jsonb_build_object(
            'id', category.id,
            'name', category.name,
            'parent_id', category.parent_id,
            'category_type', category.category_type
          )
        end,
        'entries', coalesce((
          select jsonb_agg(
            jsonb_build_object(
              'id', entry.id,
              'account_id', entry.account_id,
              'amount_minor', entry.amount_minor,
              'account', jsonb_build_object(
                'id', account.id,
                'name', account.name,
                'currency_code', account.currency_code,
                'account_type', account.account_type
              )
            )
            order by entry.created_at, entry.id
          )
          from public.transaction_entries entry
          join public.accounts account
            on account.id = entry.account_id
            and account.user_id = v_user_id
          where entry.transaction_id = page_row.id
        ), '[]'::jsonb)
      ) as payload
    from page_rows page_row
    left join public.categories category
      on category.id = page_row.category_id
      and category.user_id = v_user_id
  )
  select jsonb_build_object(
    'items', coalesce((
      select jsonb_agg(
        serialized.payload
        order by serialized.transaction_date desc, serialized.created_at desc, serialized.id desc
      )
      from serialized
    ), '[]'::jsonb),
    'has_more', (select count(*) > v_limit from candidates),
    'next_cursor', case
      when (select count(*) > v_limit from candidates) then (
        select jsonb_build_object(
          'transaction_date', page_row.transaction_date,
          'created_at', page_row.created_at,
          'id', page_row.id
        )
        from page_rows page_row
        order by page_row.transaction_date desc, page_row.created_at desc, page_row.id desc
        offset v_limit - 1
        limit 1
      )
      else null
    end
  )
  into v_result;

  return v_result;
end;
$$;

create or replace function public.get_dashboard_data()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_today date;
  v_month_start date;
  v_month_end date;
  v_previous_month_start date;
  v_previous_period_end date;
  v_income_minor bigint := 0;
  v_expense_minor bigint := 0;
  v_analytics jsonb;
  v_accounts jsonb;
  v_recent_transactions jsonb;
  v_snapshots jsonb;
  v_spending_groups jsonb;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication is required.';
  end if;

  select profile.*
  into v_profile
  from public.profiles profile
  where profile.id = v_user_id;

  if v_profile.id is null then
    raise exception using errcode = 'P0001', message = 'A user profile is required.';
  end if;

  v_today := (current_timestamp at time zone v_profile.timezone)::date;
  v_month_start := date_trunc('month', v_today)::date;
  v_month_end := (v_month_start + interval '1 month' - interval '1 day')::date;
  v_previous_month_start := (v_month_start - interval '1 month')::date;
  v_previous_period_end := (v_month_start - 1);

  perform public.refresh_snapshot_for_user(v_user_id);

  v_analytics := public.get_spending_analytics(
    v_month_start,
    v_month_end,
    v_previous_month_start,
    v_previous_period_end,
    'day'
  );
  v_expense_minor := coalesce((v_analytics #>> '{summary,total_spent_minor}')::bigint, 0);

  select coalesce(sum(entry.amount_minor), 0)::bigint
  into v_income_minor
  from public.transactions transaction_record
  join public.transaction_entries entry
    on entry.transaction_id = transaction_record.id
  join public.accounts account
    on account.id = entry.account_id
    and account.user_id = v_user_id
    and account.currency_code = v_profile.base_currency
  where transaction_record.user_id = v_user_id
    and transaction_record.transaction_type = 'income'
    and transaction_record.deleted_at is null
    and transaction_record.transaction_date between v_month_start and v_month_end;

  select coalesce(jsonb_agg(to_jsonb(summary) order by summary.account_type, lower(summary.name)), '[]'::jsonb)
  into v_accounts
  from public.get_account_summaries() summary;

  v_recent_transactions := public.get_transactions_page(
    p_limit => 6
  ) -> 'items';

  select coalesce(jsonb_agg(to_jsonb(snapshot) order by snapshot.snapshot_date desc), '[]'::jsonb)
  into v_snapshots
  from (
    select snapshot.*
    from public.net_worth_snapshots snapshot
    where snapshot.user_id = v_user_id
      and snapshot.snapshot_date between (v_today - 89) and v_today
    order by snapshot.snapshot_date desc
    limit 90
  ) snapshot;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'label', category_item ->> 'name',
      'amount_minor', (category_item ->> 'amount_minor')::bigint
    )
    order by (category_item ->> 'amount_minor')::bigint desc, category_item ->> 'name'
  ), '[]'::jsonb)
  into v_spending_groups
  from jsonb_array_elements(coalesce(v_analytics -> 'categories', '[]'::jsonb)) category_item;

  return jsonb_build_object(
    'accounts', v_accounts,
    'monthly', jsonb_build_object(
      'income_minor', v_income_minor,
      'expenses_minor', v_expense_minor,
      'net_cash_flow_minor', v_income_minor - v_expense_minor
    ),
    'spending_groups', v_spending_groups,
    'recent_transactions', coalesce(v_recent_transactions, '[]'::jsonb),
    'snapshots', v_snapshots
  );
end;
$$;

revoke all on function public.get_transactions_page(date, date, text, uuid, uuid, integer, date, timestamptz, uuid)
  from public, anon;
grant execute on function public.get_transactions_page(date, date, text, uuid, uuid, integer, date, timestamptz, uuid)
  to authenticated;

revoke all on function public.get_dashboard_data() from public, anon;
grant execute on function public.get_dashboard_data() to authenticated;

commit;
