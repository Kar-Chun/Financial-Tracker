begin;

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

  select
    coalesce(sum(entry.amount_minor) filter (where transaction_record.transaction_type = 'income'), 0)::bigint,
    coalesce(sum(-entry.amount_minor) filter (where transaction_record.transaction_type = 'expense'), 0)::bigint
  into v_income_minor, v_expense_minor
  from public.transactions transaction_record
  join public.transaction_entries entry on entry.transaction_id = transaction_record.id
  join public.accounts account on account.id = entry.account_id
    and account.user_id = v_user_id
    and account.currency_code = v_profile.base_currency
  where transaction_record.user_id = v_user_id
    and transaction_record.deleted_at is null
    and transaction_record.transaction_date between v_month_start and v_today
    and transaction_record.transaction_type in ('income', 'expense');

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

create or replace function public.search_ai_transactions(
  p_query text default null,
  p_start_date date default null,
  p_end_date date default null,
  p_limit integer default 20,
  p_order text default 'recent'
)
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
  v_start_date date;
  v_end_date date;
  v_query text := nullif(btrim(coalesce(p_query, '')), '');
  v_limit integer := least(greatest(coalesce(p_limit, 20), 1), 20);
  v_result jsonb;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication is required.';
  end if;
  select * into v_profile from public.profiles where id = v_user_id;
  if v_profile.id is null then raise exception 'Profile not found.'; end if;

  v_today := (current_timestamp at time zone v_profile.timezone)::date;
  v_end_date := coalesce(p_end_date, v_today);
  v_start_date := coalesce(p_start_date, greatest(v_end_date - 365, date '2000-01-01'));

  if v_end_date < v_start_date or (v_end_date - v_start_date) > 3660 then
    raise exception using errcode = '22023', message = 'Transaction search date range is invalid.';
  end if;
  if p_order not in ('recent', 'largest') then
    raise exception using errcode = '22023', message = 'Transaction search order is invalid.';
  end if;

  with candidates as (
    select
      transaction_record.id,
      transaction_record.transaction_date,
      transaction_record.transaction_type,
      transaction_record.description as note,
      coalesce(parent.name || ' › ' || category.name, category.name) as category,
      account_data.account_label,
      account_data.currency_code,
      account_data.amount_minor
    from public.transactions transaction_record
    left join public.categories category on category.id = transaction_record.category_id
      and category.user_id = v_user_id
    left join public.categories parent on parent.id = category.parent_id
      and parent.user_id = v_user_id
    join lateral (
      select
        case
          when transaction_record.transaction_type = 'transfer' then
            coalesce(max(account.name) filter (where entry.amount_minor < 0), 'Account')
            || ' → ' || coalesce(max(account.name) filter (where entry.amount_minor > 0), 'Account')
          else max(account.name)
        end as account_label,
        case when count(distinct account.currency_code) = 1 then max(account.currency_code) else null end as currency_code,
        max(abs(entry.amount_minor))::bigint as amount_minor,
        string_agg(account.name, ' ') as searchable_accounts
      from public.transaction_entries entry
      join public.accounts account on account.id = entry.account_id and account.user_id = v_user_id
      where entry.transaction_id = transaction_record.id
    ) account_data on true
    where transaction_record.user_id = v_user_id
      and transaction_record.deleted_at is null
      and transaction_record.transaction_date between v_start_date and v_end_date
      and transaction_record.transaction_type in ('expense', 'income', 'transfer')
      and (
        v_query is null
        or transaction_record.description ilike '%' || v_query || '%'
        or category.name ilike '%' || v_query || '%'
        or parent.name ilike '%' || v_query || '%'
        or account_data.searchable_accounts ilike '%' || v_query || '%'
      )
  ), limited as (
    select * from candidates
    order by
      case when p_order = 'largest' then amount_minor end desc nulls last,
      transaction_date desc,
      id desc
    limit v_limit
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'date', transaction_date,
    'amount_minor', amount_minor,
    'type', transaction_type,
    'category', category,
    'account', account_label,
    'currency_code', currency_code,
    'note', note
  ) order by
    case when p_order = 'largest' then amount_minor end desc nulls last,
    transaction_date desc
  ), '[]'::jsonb)
  into v_result from limited;

  return jsonb_build_object(
    'start_date', v_start_date,
    'end_date', v_end_date,
    'result_limit', v_limit,
    'transactions', v_result
  );
end;
$$;

revoke all on function public.get_ai_financial_overview() from public, anon;
revoke all on function public.search_ai_transactions(text, date, date, integer, text) from public, anon;
grant execute on function public.get_ai_financial_overview() to authenticated;
grant execute on function public.search_ai_transactions(text, date, date, integer, text) to authenticated;

commit;
