begin;

-- Read one MVCC snapshot, including retained archives/deletions. No financial helpers.
create or replace function public.export_user_data_v1()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
set timezone = 'UTC'
as $$
declare
  v_user_id uuid := auth.uid();
  v_data jsonb;
  v_counts jsonb;
  v_result jsonb;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication is required.';
  end if;

  select jsonb_build_object(
    'profiles', (select coalesce(jsonb_agg(to_jsonb(export_row) order by export_row.id), '[]'::jsonb)
      from (select
        r.id,
        r.display_name,
        r.base_currency,
        r.timezone,
        r.created_at,
        r.updated_at
        from public.profiles r
        where r.id = v_user_id
      ) export_row),
    'accounts', (select coalesce(jsonb_agg(to_jsonb(export_row) order by export_row.id), '[]'::jsonb)
      from (select
        r.id,
        r.user_id,
        r.name,
        r.account_type,
        r.institution,
        r.currency_code,
        r.opening_balance_minor::text as opening_balance_minor,
        r.created_at,
        r.updated_at,
        r.archived_at,
        r.investment_tracking_mode,
        r.detailed_started_on,
        r.detailed_started_at
        from public.accounts r
        where r.user_id = v_user_id
      ) export_row),
    'categories', (select coalesce(jsonb_agg(to_jsonb(export_row) order by export_row.id), '[]'::jsonb)
      from (select
        r.id,
        r.user_id,
        r.name,
        r.parent_id,
        r.category_type,
        r.created_at,
        r.archived_at
        from public.categories r
        where r.user_id = v_user_id
      ) export_row),
    'transactions', (select coalesce(jsonb_agg(to_jsonb(export_row) order by export_row.id), '[]'::jsonb)
      from (select
        r.id,
        r.user_id,
        r.transaction_type,
        r.category_id,
        r.description,
        r.transaction_date,
        r.created_at,
        r.updated_at,
        r.deleted_at,
        r.is_reconciliation
        from public.transactions r
        where r.user_id = v_user_id
      ) export_row),
    'transaction_entries', (select coalesce(jsonb_agg(to_jsonb(export_row) order by export_row.id), '[]'::jsonb)
      from (select
        r.id,
        r.transaction_id,
        r.account_id,
        r.amount_minor::text as amount_minor,
        r.created_at
        from public.transaction_entries r
        where exists (select 1 from public.transactions t join public.accounts a on a.id = r.account_id where t.id = r.transaction_id and t.user_id = v_user_id and a.user_id = v_user_id)
      ) export_row),
    'investment_valuations', (select coalesce(jsonb_agg(to_jsonb(export_row) order by export_row.id), '[]'::jsonb)
      from (select
        r.id,
        r.user_id,
        r.account_id,
        r.native_value_minor::text as native_value_minor,
        r.base_value_minor::text as base_value_minor,
        r.valued_at,
        r.created_at,
        r.updated_at
        from public.investment_valuations r
        where r.user_id = v_user_id
      ) export_row),
    'monthly_budgets', (select coalesce(jsonb_agg(to_jsonb(export_row) order by export_row.id), '[]'::jsonb)
      from (select
        r.id,
        r.user_id,
        r.month_start,
        r.currency_code,
        r.amount_minor::text as amount_minor,
        r.created_at,
        r.updated_at
        from public.monthly_budgets r
        where r.user_id = v_user_id
      ) export_row),
    'category_budgets', (select coalesce(jsonb_agg(to_jsonb(export_row) order by export_row.id), '[]'::jsonb)
      from (select
        r.id,
        r.monthly_budget_id,
        r.category_id,
        r.amount_minor::text as amount_minor,
        r.created_at,
        r.updated_at
        from public.category_budgets r
        where exists (select 1 from public.monthly_budgets b join public.categories c on c.id = r.category_id where b.id = r.monthly_budget_id and b.user_id = v_user_id and c.user_id = v_user_id)
      ) export_row),
    'savings_goals', (select coalesce(jsonb_agg(to_jsonb(export_row) order by export_row.id), '[]'::jsonb)
      from (select
        r.id,
        r.user_id,
        r.name,
        r.target_amount_minor::text as target_amount_minor,
        r.currency_code,
        r.target_date,
        r.note,
        r.archived_at,
        r.created_at,
        r.updated_at
        from public.savings_goals r
        where r.user_id = v_user_id
      ) export_row),
    'goal_allocations', (select coalesce(jsonb_agg(to_jsonb(export_row) order by export_row.id), '[]'::jsonb)
      from (select
        r.id,
        r.goal_id,
        r.amount_minor::text as amount_minor,
        r.allocation_date,
        r.note,
        r.created_at
        from public.goal_allocations r
        where exists (select 1 from public.savings_goals g where g.id = r.goal_id and g.user_id = v_user_id)
      ) export_row),
    'net_worth_snapshots', (select coalesce(jsonb_agg(to_jsonb(export_row) order by export_row.id), '[]'::jsonb)
      from (select
        r.id,
        r.user_id,
        r.snapshot_date,
        r.bank_value_base_minor::text as bank_value_base_minor,
        r.cash_value_base_minor::text as cash_value_base_minor,
        r.investment_value_base_minor::text as investment_value_base_minor,
        r.total_value_base_minor::text as total_value_base_minor,
        r.created_at,
        r.updated_at
        from public.net_worth_snapshots r
        where r.user_id = v_user_id
      ) export_row),
    'manual_fx_rates', (select coalesce(jsonb_agg(to_jsonb(export_row) order by export_row.id), '[]'::jsonb)
      from (select
        r.id,
        r.user_id,
        r.from_currency,
        r.to_currency,
        r.rate::text as rate,
        r.rate_date,
        r.created_at,
        r.updated_at
        from public.manual_fx_rates r
        where r.user_id = v_user_id
      ) export_row),
    'investment_holdings', (select coalesce(jsonb_agg(to_jsonb(export_row) order by export_row.id), '[]'::jsonb)
      from (select
        r.id,
        r.account_id,
        r.user_id,
        r.symbol,
        r.name,
        r.asset_type,
        r.currency_code,
        r.archived_at,
        r.created_at,
        r.updated_at
        from public.investment_holdings r
        where r.user_id = v_user_id
      ) export_row),
    'investment_trades', (select coalesce(jsonb_agg(to_jsonb(export_row) order by export_row.id), '[]'::jsonb)
      from (select
        r.id,
        r.holding_id,
        r.account_id,
        r.user_id,
        r.trade_type,
        r.quantity::text as quantity,
        r.unit_price::text as unit_price,
        r.fee_minor::text as fee_minor,
        r.cash_effect_minor::text as cash_effect_minor,
        r.cost_basis_effect_minor::text as cost_basis_effect_minor,
        r.realized_gain_minor::text as realized_gain_minor,
        r.trade_date,
        r.note,
        r.created_at
        from public.investment_trades r
        where r.user_id = v_user_id
      ) export_row),
    'investment_prices', (select coalesce(jsonb_agg(to_jsonb(export_row) order by export_row.id), '[]'::jsonb)
      from (select
        r.id,
        r.holding_id,
        r.user_id,
        r.price::text as price,
        r.priced_at,
        r.created_at,
        r.updated_at
        from public.investment_prices r
        where r.user_id = v_user_id
      ) export_row),
    'investment_cash_events', (select coalesce(jsonb_agg(to_jsonb(export_row) order by export_row.id), '[]'::jsonb)
      from (select
        r.id,
        r.account_id,
        r.holding_id,
        r.user_id,
        r.event_type,
        r.amount_minor::text as amount_minor,
        r.event_date,
        r.note,
        r.created_at
        from public.investment_cash_events r
        where r.user_id = v_user_id
      ) export_row),
    'notification_preferences', (select coalesce(jsonb_agg(to_jsonb(export_row) order by export_row.user_id), '[]'::jsonb)
      from (select
        r.user_id,
        r.daily_reminder_enabled,
        r.created_at,
        r.updated_at
        from public.notification_preferences r
        where r.user_id = v_user_id
      ) export_row)
  ) into v_data;

  if jsonb_array_length(v_data->'profiles') <> 1 then
    raise exception using errcode = '22023', message = 'Export profile is unavailable.';
  end if;
  select jsonb_object_agg(key, jsonb_array_length(value)) into v_counts
  from jsonb_each(v_data);
  v_result := jsonb_build_object(
    'format', 'ledgerly-backup', 'version', 1,
    'exported_at', statement_timestamp(),
    'app', jsonb_build_object('name', 'Ledgerly'),
    'data', v_data, 'record_counts', v_counts
  );
  -- Fail as a whole, never silently truncate an archive to a row limit.
  if octet_length(v_result::text) > 33554432 then
    raise exception using errcode = '54000', message = 'Export exceeds the V1 size limit.';
  end if;
  return v_result;
end;
$$;

revoke all on function public.export_user_data_v1() from public, anon;
grant execute on function public.export_user_data_v1() to authenticated;

commit;
