-- Run after all migrations on a disposable/local Supabase database as postgres.
-- No extensions required. Every fixture/change is rolled back.
begin;

create function pg_temp.check_true(ok boolean, explanation text) returns void
language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'Verification failed: %', explanation; end if;
end;
$$;

do $$
declare
  a uuid := gen_random_uuid(); b uuid := gen_random_uuid();
  bank uuid; other_bank uuid; foreign_cash uuid; investment uuid; archived uuid; disposable uuid;
  category uuid; income_category uuid; activity_account uuid; ordinary_tx uuid; adjustment uuid;
  today date; month_start date; r jsonb; before_dashboard jsonb; after_dashboard jsonb;
  before_analytics jsonb; before_budget jsonb; before_snapshot bigint; before_count bigint;
begin
  insert into auth.users(id, email, raw_user_meta_data) values
    (a, a::text || '@example.invalid', '{}'::jsonb),
    (b, b::text || '@example.invalid', '{}'::jsonb);
  -- Exercise RPCs and direct reads as the browser role, not as the table owner.
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', b::text, true);
  other_bank := public.upsert_account('Other user', 'bank', 'SGD', 500000);
  perform set_config('request.jwt.claim.sub', a::text, true);
  update public.profiles set timezone = 'Pacific/Kiritimati' where id = a;
  today := (current_timestamp at time zone 'Pacific/Kiritimati')::date;
  month_start := date_trunc('month', today)::date;
  bank := public.upsert_account('Reconciliation bank', 'bank', 'SGD', 100000);
  foreign_cash := public.upsert_account('Native USD cash', 'cash', 'USD', 12040);
  investment := public.upsert_account('Simple investment', 'investment', 'SGD', 0);
  archived := public.upsert_account('Archived cash', 'cash', 'SGD', 0);
  perform public.archive_account(archived);
  perform public.upsert_monthly_budget(month_start, 100000);
  select id into category from public.categories where user_id = a and category_type = 'expense' and parent_id is null limit 1;
  select id into income_category from public.categories where user_id = a and category_type = 'income' and parent_id is null limit 1;
  activity_account := public.upsert_account('Unrelated ordinary history', 'cash', 'SGD', 0);
  perform public.upsert_financial_transaction('income', 20000, activity_account, today, income_category, null, 'Salary fixture');
  perform public.upsert_financial_transaction('expense', 5000, activity_account, today, category, null, 'Expense fixture');

  before_dashboard := public.get_dashboard_data();
  before_analytics := public.get_spending_analytics(month_start, today, (month_start - interval '1 month')::date, month_start - 1, 'day');
  before_budget := public.get_monthly_budget_summary(month_start);
  select total_value_base_minor into before_snapshot from public.net_worth_snapshots where user_id = a and snapshot_date = today;
  select count(*) into before_count from public.transactions;
  r := public.reconcile_account_balance(bank, 100000, 95000, 'SGD', '  Reconcile fixture note  ');
  adjustment := (r->>'transaction_id')::uuid;
  perform pg_temp.check_true((r->>'adjustment_minor')::bigint = -5000 and (r->>'balance_minor')::bigint = 95000, 'negative adjustment result');
  perform pg_temp.check_true((select current_balance_minor = 95000 from public.get_account_summaries() where id = bank), 'authoritative bank balance');
  perform pg_temp.check_true((select total_value_base_minor = before_snapshot - 5000 from public.net_worth_snapshots where user_id = a and snapshot_date = today), 'snapshot delta');
  perform pg_temp.check_true((select count(*) = 1 from public.net_worth_snapshots where user_id = a and snapshot_date = today), 'one snapshot per local day');
  perform pg_temp.check_true((select transaction_date = today and description = 'Reconcile fixture note' and category_id is null and transaction_type = 'adjustment' from public.transactions where id = adjustment), 'local date, trimmed Note, adjustment type');
  perform pg_temp.check_true((select count(*) = 1 and sum(amount_minor) = -5000 from public.transaction_entries where transaction_id = adjustment), 'one signed entry');

  after_dashboard := public.get_dashboard_data();
  perform pg_temp.check_true(after_dashboard->'monthly' = before_dashboard->'monthly', 'monthly income/spent/cashflow unchanged');
  perform pg_temp.check_true(after_dashboard->'daily_spending' = before_dashboard->'daily_spending', 'today and 7-day spending unchanged');
  perform pg_temp.check_true(after_dashboard->'spending_groups' = before_dashboard->'spending_groups', 'category groups unchanged');
  perform pg_temp.check_true(public.get_spending_analytics(month_start, today, (month_start - interval '1 month')::date, month_start - 1, 'day') = before_analytics, 'Analytics unchanged');
  perform pg_temp.check_true(public.get_monthly_budget_summary(month_start) = before_budget, 'Budget actual spending and pace unchanged');
  perform pg_temp.check_true(not exists (select 1 from public.get_transaction_note_suggestions('Reconcile fixture', 'expense', 3)), 'no Expense note suggestions');
  perform pg_temp.check_true(not exists (select 1 from public.get_transaction_note_suggestions('Reconcile fixture', 'income', 3)), 'no Income note suggestions');
  perform pg_temp.check_true(exists (select 1 from jsonb_array_elements(public.get_transactions_page()->'items') item where item->>'id' = adjustment::text), 'All history includes adjustment');
  perform pg_temp.check_true(not exists (select 1 from jsonb_array_elements(public.get_transactions_page(p_transaction_type => 'expense')->'items') item where item->>'id' = adjustment::text), 'Expense filter excludes adjustment');

  -- Reusing the stale preview must not apply twice.
  begin
    perform public.reconcile_account_balance(bank, 100000, 95000, 'SGD', null);
    raise exception 'Expected stale conflict';
  exception when serialization_failure then null;
  end;
  perform pg_temp.check_true((select count(*) = before_count + 1 from public.transactions), 'stale request created nothing');
  r := public.reconcile_account_balance(bank, 95000, 95000, 'SGD', null);
  perform pg_temp.check_true(r->>'transaction_id' is null and (r->>'adjustment_minor')::bigint = 0, 'matching balances are a no-op');
  perform pg_temp.check_true((select count(*) = before_count + 1 from public.transactions), 'no zero history');
  r := public.reconcile_account_balance(bank, 95000, 100000, 'SGD', null);
  perform pg_temp.check_true((r->>'adjustment_minor')::bigint = 5000, 'positive adjustment');
  after_dashboard := public.get_dashboard_data();
  perform pg_temp.check_true(after_dashboard->'monthly' = before_dashboard->'monthly', 'positive adjustment is not income');
  perform pg_temp.check_true(after_dashboard->'daily_spending' = before_dashboard->'daily_spending', 'positive adjustment leaves daily metrics unchanged');
  perform public.reconcile_account_balance(bank, 100000, -525, 'SGD', null);
  perform pg_temp.check_true((select current_balance_minor = -525 from public.get_account_summaries() where id = bank), 'negative actual balances allowed');

  select total_value_base_minor into before_snapshot from public.net_worth_snapshots where user_id = a and snapshot_date = today;
  r := public.reconcile_account_balance(foreign_cash, 12040, 11520, 'USD', null);
  perform pg_temp.check_true((r->>'adjustment_minor')::bigint = -520, 'native foreign cash adjusted');
  perform pg_temp.check_true((select current_balance_minor = 11520 and not included_in_net_worth from public.get_account_summaries() where id = foreign_cash), 'foreign representation unchanged');
  perform pg_temp.check_true((select total_value_base_minor = before_snapshot from public.net_worth_snapshots where user_id = a and snapshot_date = today), 'no invented FX or base Net Worth');

  begin
    perform public.reconcile_account_balance(other_bank, 500000, 1, 'SGD', null);
    raise exception 'Expected ownership rejection';
  exception when insufficient_privilege then null;
  end;
  perform pg_temp.check_true(not exists (select 1 from public.accounts where id = other_bank), 'cross-user RLS read denied');
  begin
    delete from public.accounts where id = bank;
    raise exception 'Expected direct delete permission rejection';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.reconcile_account_balance(investment, 0, 100, 'SGD', null);
    raise exception 'Expected investment rejection';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.reconcile_account_balance(archived, 0, 100, 'SGD', null);
    raise exception 'Expected archived rejection';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.reconcile_account_balance(bank, -525, 100, 'USD', null);
    raise exception 'Expected changed currency rejection';
  exception when serialization_failure then null;
  end;
  begin
    perform public.soft_delete_transaction(adjustment);
    raise exception 'Expected adjustment delete rejection';
  exception when check_violation then null;
  end;
  begin
    perform public.upsert_financial_transaction('expense', 50, bank, today, category, null, 'Attempted edit', adjustment);
    raise exception 'Expected adjustment edit rejection';
  exception when check_violation then null;
  end;

  -- Ordinary history must block cleanup even with reconciliations present.
  ordinary_tx := public.upsert_financial_transaction('expense', 50, bank, today, category);
  begin
    perform public.delete_account_permanently(bank);
    raise exception 'Expected active ordinary history rejection';
  exception when foreign_key_violation then null;
  end;
  perform pg_temp.check_true(exists (select 1 from public.transactions where id = ordinary_tx), 'blocked delete preserved ordinary history');
  perform public.soft_delete_transaction(ordinary_tx);
  r := public.delete_account_permanently(bank);
  perform pg_temp.check_true((r->>'reconciliations_purged')::integer = 3, 'only marked reconciliation history purged');
  perform pg_temp.check_true((r->>'soft_deleted_transactions_purged')::integer = 1, 'complete soft-deleted history purged');
  perform pg_temp.check_true(not exists (select 1 from public.accounts where id = bank), 'eligible account removed');
  perform pg_temp.check_true(not exists (select 1 from public.transaction_entries where account_id = bank), 'no orphan entries');
  perform pg_temp.check_true((select current_balance_minor = 11520 from public.get_account_summaries() where id = foreign_cash), 'unrelated account untouched');
  perform pg_temp.check_true((select current_balance_minor = 15000 from public.get_account_summaries() where id = activity_account), 'unrelated ordinary income/expense history untouched');
  disposable := public.upsert_account('Zero after reconciliation', 'cash', 'SGD', 100);
  begin
    perform public.archive_account(disposable);
    raise exception 'Expected nonzero archive rejection';
  exception when check_violation then null;
  end;
  perform public.reconcile_account_balance(disposable, 100, 0, 'SGD', null);
  perform public.archive_account(disposable);
  perform public.restore_account(disposable);
  perform pg_temp.check_true((select current_balance_minor = 0 from public.get_account_summaries() where id = disposable), 'archive/restore retained history');

  perform set_config('request.jwt.claim.sub', b::text, true);
  perform pg_temp.check_true((select current_balance_minor = 500000 from public.get_account_summaries() where id = other_bank), 'other user balance unchanged');
  perform pg_temp.check_true(not exists (select 1 from public.transactions where user_id = a), 'other user cannot read adjustment history');
  perform set_config('request.jwt.claim.sub', '', true);
  begin
    perform public.reconcile_account_balance(other_bank, 500000, 1, 'SGD', null);
    raise exception 'Expected unauthenticated rejection';
  exception when insufficient_privilege then null;
  end;
  reset role;
end;
$$;
-- Force deferred ledger integrity checks even though this test rolls back.
set constraints all immediate;
rollback;
