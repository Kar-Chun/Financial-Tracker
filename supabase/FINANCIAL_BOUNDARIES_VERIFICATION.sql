-- Run as postgres on a disposable/local Supabase database after all migrations.
-- Uses fresh users; exercises browser RPCs under authenticated, then rolls back.
-- Stop on any error. No external services are contacted. No payloads are printed.
begin;

create function pg_temp.check_true(ok boolean, explanation text) returns void
language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'Verification failed: %', explanation; end if;
end;
$$;

-- Compare complete caller-owned financial rows, including snapshots and timestamps,
-- so a failed call cannot quietly leave an account conversion or a partial ledger.
create function pg_temp.financial_state() returns jsonb
language sql stable as $$
  select jsonb_build_object(
    'accounts', (select jsonb_agg(to_jsonb(r) order by r.id) from public.accounts r where user_id = auth.uid()),
    'transactions', (select jsonb_agg(to_jsonb(r) order by r.id) from public.transactions r where user_id = auth.uid()),
    'entries', (select jsonb_agg(to_jsonb(r) order by r.id) from public.transaction_entries r
      where exists(select 1 from public.transactions t where t.id = r.transaction_id and t.user_id = auth.uid())),
    'holdings', (select jsonb_agg(to_jsonb(r) order by r.id) from public.investment_holdings r where user_id = auth.uid()),
    'trades', (select jsonb_agg(to_jsonb(r) order by r.id) from public.investment_trades r where user_id = auth.uid()),
    'prices', (select jsonb_agg(to_jsonb(r) order by r.id) from public.investment_prices r where user_id = auth.uid()),
    'fx', (select jsonb_agg(to_jsonb(r) order by r.id) from public.manual_fx_rates r where user_id = auth.uid()),
    'cash', (select jsonb_agg(to_jsonb(r) order by r.id) from public.investment_cash_events r where user_id = auth.uid()),
    'snapshots', (select jsonb_agg(to_jsonb(r) order by r.snapshot_date) from public.net_worth_snapshots r where user_id = auth.uid())
  );
$$;

do $$
declare
  a uuid := gen_random_uuid(); b uuid := gen_random_uuid();
  bank uuid; cash uuid; simple uuid; detailed uuid; other_bank uuid; archived uuid;
  fx_cash uuid; setup_account uuid; holding uuid; tx uuid; edited_tx uuid; target_account uuid;
  category uuid; income_category uuid; legacy_account uuid; legacy_tx uuid;
  today date := (current_timestamp at time zone 'Asia/Singapore')::date;
  month_start date := date_trunc('month', today)::date;
  kind text; bad text; field text; opening jsonb; invalid_opening jsonb;
  before_state jsonb; dashboard jsonb; analytics jsonb; budget jsonb; result jsonb;
  before_total bigint; before_balance bigint; before_value bigint; before_count bigint;
begin
  insert into auth.users(id, email, raw_user_meta_data) values
    (a, a::text || '@example.invalid', '{}'::jsonb),
    (b, b::text || '@example.invalid', '{}'::jsonb);
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', b::text, true);
  other_bank := public.upsert_account('Other fixture', 'bank', 'SGD', 100000);
  perform set_config('request.jwt.claim.sub', a::text, true);
  update public.profiles set timezone = 'Asia/Singapore' where id = a;
  bank := public.upsert_account('Bank fixture', 'bank', 'SGD', 1000000);
  cash := public.upsert_account('Cash fixture', 'cash', 'SGD', 1000000);
  simple := public.upsert_account('Simple fixture', 'investment', 'SGD', 0);
  detailed := public.upsert_account('Detailed fixture', 'investment', 'SGD', 0);
  setup_account := public.upsert_account('Setup fixture', 'investment', 'SGD', 0);
  fx_cash := public.upsert_account('Foreign fixture', 'cash', 'USD', 10000);
  archived := public.upsert_account('Archived fixture', 'cash', 'SGD', 0);
  perform public.archive_account(archived);
  perform public.upsert_investment_valuation(simple, 10000, 10000, today - 1);
  opening := jsonb_build_array(jsonb_build_object('symbol', 'FIX', 'name', 'Fixture', 'asset_type', 'stock',
    'quantity', '1.0000000000', 'average_cost', '1.0000000000', 'current_price', '2.0000000000'));
  perform public.enable_detailed_investment_tracking(detailed, today - 1, 100000, opening);
  select id into holding from public.investment_holdings where account_id = detailed;
  select id into category from public.categories where user_id = a and category_type = 'expense' and parent_id is null limit 1;
  select id into income_category from public.categories where user_id = a and category_type = 'income' and parent_id is null limit 1;
  perform public.upsert_monthly_budget(month_start, 10000);

  -- All four ordinary Bank/Cash combinations are accepted.
  foreach kind in array array['expense', 'income'] loop
    foreach target_account in array array[bank, cash] loop
      tx := public.upsert_financial_transaction(kind, 100, target_account, today,
        case when kind = 'expense' then category else income_category end);
      set constraints all immediate;
      perform pg_temp.check_true((select count(*) = 1 from public.transaction_entries where transaction_id = tx), 'ordinary entry accepted');
      if kind = 'expense' and target_account = bank then edited_tx := tx; end if;
    end loop;
  end loop;
  set constraints all deferred;

  -- All four Investment combinations reject both inserts and edits atomically.
  foreach kind in array array['expense', 'income'] loop
    foreach target_account in array array[simple, detailed] loop
      before_state := pg_temp.financial_state();
      begin
        perform public.upsert_financial_transaction(kind, 100, target_account, today,
          case when kind = 'expense' then category else income_category end);
        raise exception 'Expected investment ordinary transaction rejection';
      exception when invalid_parameter_value then null;
      end;
      perform pg_temp.check_true(pg_temp.financial_state() = before_state, 'rejected insert creates no transaction, entry, or snapshot change');
      begin
        perform public.upsert_financial_transaction(kind, 100, target_account, today,
          case when kind = 'expense' then category else income_category end, p_transaction_id => edited_tx);
        raise exception 'Expected investment ordinary edit rejection';
      exception when invalid_parameter_value then null;
      end;
      perform pg_temp.check_true(pg_temp.financial_state() = before_state, 'rejected edit preserves original transaction and entries');
    end loop;
  end loop;

  before_state := pg_temp.financial_state();
  begin
    perform public.upsert_financial_transaction('expense', 100, other_bank, today, category);
    raise exception 'Expected cross-user rejection';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.upsert_financial_transaction('income', 100, archived, today, income_category);
    raise exception 'Expected archive rejection';
  exception when invalid_parameter_value then null;
  end;
  perform pg_temp.check_true(pg_temp.financial_state() = before_state, 'ownership and archive failures are atomic');
  perform pg_temp.check_true(not exists(select 1 from public.accounts where id = other_bank), 'User B remains invisible');
  begin
    insert into public.transactions(user_id, transaction_type, category_id, transaction_date)
      values(a, 'expense', category, today);
    raise exception 'Expected direct table write denial';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.validate_investment_numeric('1', 10);
    raise exception 'Expected internal helper execution denial';
  exception when insufficient_privilege then null;
  end;

  -- Transfers to/from both investment modes stay neutral and affect their value.
  dashboard := public.get_dashboard_data();
  select total_value_base_minor into before_total from public.net_worth_snapshots where user_id = a and snapshot_date = today;
  foreach target_account in array array[simple, detailed] loop
    select native_value_minor into before_value from public.get_account_summaries() where id = target_account;
    perform public.upsert_financial_transaction('transfer', 500, bank, today, p_destination_account_id => target_account);
    set constraints all immediate;
    perform pg_temp.check_true((select native_value_minor = before_value + 500 from public.get_account_summaries() where id = target_account), 'investment transfer funding');
    perform public.upsert_financial_transaction('transfer', 500, target_account, today, p_destination_account_id => bank);
    perform pg_temp.check_true((select native_value_minor = before_value from public.get_account_summaries() where id = target_account), 'investment transfer withdrawal');
    perform pg_temp.check_true((select total_value_base_minor = before_total from public.net_worth_snapshots where user_id = a and snapshot_date = today), 'transfer Net Worth neutrality');
  end loop;
  set constraints all deferred;
  result := public.get_dashboard_data();
  perform pg_temp.check_true(result->'monthly' = dashboard->'monthly' and result->'daily_spending' = dashboard->'daily_spending', 'transfers excluded from income and spending');

  analytics := public.get_spending_analytics(month_start, today, month_start - 1, month_start - 1, 'day');
  budget := public.get_monthly_budget_summary(month_start);
  perform pg_temp.check_true((analytics #>> '{summary,total_spent_minor}')::bigint = 200, 'Analytics ordinary spending');
  perform pg_temp.check_true((budget->>'spent_minor')::bigint = 200, 'budget spending');
  perform pg_temp.check_true((result #>> '{daily_spending,today_minor}')::bigint = 200, 'Today spending');

  -- Reconciliation remains a signed adjustment, never ordinary spending/income.
  select current_balance_minor into before_balance from public.get_account_summaries() where id = bank;
  result := public.reconcile_account_balance(bank, before_balance, before_balance + 100, 'SGD', null);
  set constraints all immediate;
  perform pg_temp.check_true((result->>'adjustment_minor')::bigint = 100, 'reconciliation preserved');
  perform pg_temp.check_true((select current_balance_minor = before_balance + 100 from public.get_account_summaries() where id = bank), 'reconciled balance');
  perform pg_temp.check_true((select total_value_base_minor = before_total + 100 from public.net_worth_snapshots where user_id = a and snapshot_date = today), 'reconciliation snapshot delta');
  perform pg_temp.check_true(public.get_spending_analytics(month_start, today, month_start - 1, month_start - 1, 'day') = analytics, 'reconciliation leaves Analytics unchanged');
  perform pg_temp.check_true(public.get_monthly_budget_summary(month_start) = budget, 'reconciliation leaves budgets unchanged');
  result := public.get_dashboard_data();
  perform pg_temp.check_true(result->'monthly' = dashboard->'monthly' and result->'daily_spending' = dashboard->'daily_spending', 'reconciliation leaves Dashboard spending unchanged');
  set constraints all deferred;

  -- NUMERIC(30,10): quantity, unit price, current/manual price, opening average cost.
  -- Test each external entry point, including the second item of a batch.
  foreach bad in array array['NaN', 'Infinity', '-Infinity', '0', '-1', '0.12345678901', '100000000000000000000'] loop
    before_state := pg_temp.financial_state();
    begin
      perform public.record_investment_trade(detailed, holding, 'buy', bad::numeric, 1, 0, today);
      raise exception 'Expected invalid trade quantity';
    exception when invalid_parameter_value then null;
    end;
    perform pg_temp.check_true(pg_temp.financial_state() = before_state, 'invalid quantity leaves no financial state');
    begin
      perform public.record_investment_trade(detailed, holding, 'buy', 1, bad::numeric, 0, today);
      raise exception 'Expected invalid trade unit price';
    exception when invalid_parameter_value then null;
    end;
    perform pg_temp.check_true(pg_temp.financial_state() = before_state, 'invalid unit price leaves no financial state');
    begin
      perform public.update_investment_prices(detailed, today, jsonb_build_array(
        jsonb_build_object('holding_id', holding, 'price', '3'),
        jsonb_build_object('holding_id', holding, 'price', bad)));
      raise exception 'Expected invalid batch price';
    exception when invalid_parameter_value then null;
    end;
    perform pg_temp.check_true(pg_temp.financial_state() = before_state, 'invalid price batch leaves no first price');
    foreach field in array array['quantity', 'average_cost', 'current_price'] loop
      if field = 'average_cost' and bad = '0' then continue; end if;
      invalid_opening := opening || jsonb_build_array(jsonb_set(opening->0, array[field], to_jsonb(bad)) || '{"symbol":"SECOND"}'::jsonb);
      begin
        perform public.preview_detailed_investment_conversion(setup_account, 1000, invalid_opening);
        raise exception 'Expected invalid conversion preview';
      exception when invalid_parameter_value then null;
      end;
      begin
        perform public.enable_detailed_investment_tracking(setup_account, today - 1, 1000, invalid_opening);
        raise exception 'Expected invalid opening batch';
      exception when invalid_parameter_value then null;
      end;
      perform pg_temp.check_true(pg_temp.financial_state() = before_state, 'invalid opening leaves Simple mode, cash, holdings, trades and prices unchanged');
    end loop;
  end loop;

  -- NUMERIC(30,12): FX has 18 integer digits and 12 fractional digits.
  foreach bad in array array['NaN', 'Infinity', '-Infinity', '0', '-1', '0.1234567890123', '1000000000000000000'] loop
    before_state := pg_temp.financial_state();
    begin
      perform public.upsert_manual_fx_rate('USD', bad::numeric, today);
      raise exception 'Expected invalid FX rate';
    exception when invalid_parameter_value then null;
    end;
    perform pg_temp.check_true(pg_temp.financial_state() = before_state, 'invalid FX leaves no row or snapshot change');
  end loop;

  -- Canonical maximum-scale values remain exact through real RPCs and storage.
  tx := public.record_investment_trade(detailed, holding, 'buy', '0.1234567890', '0.1234567890', 0, today);
  perform pg_temp.check_true((select quantity::text = '0.1234567890' and unit_price::text = '0.1234567890'
    and cash_effect_minor = -2 and cost_basis_effect_minor = 2 from public.investment_trades where id = tx), 'exact buy quantity, price and cash');
  perform public.update_investment_prices(detailed, today, jsonb_build_array(jsonb_build_object('holding_id', holding, 'price', '0.1234567890')));
  perform pg_temp.check_true((select price::text = '0.1234567890' from public.investment_prices where holding_id = holding and priced_at = today), 'exact manual price');
  perform public.upsert_manual_fx_rate('USD', '0.123456789012', today);
  perform pg_temp.check_true((select rate::text = '0.123456789012' from public.manual_fx_rates where user_id = a and from_currency = 'USD'), 'exact manual FX');
  opening := jsonb_build_array(jsonb_build_object('symbol', 'EXACT', 'name', 'Exact fixture', 'asset_type', 'stock',
    'quantity', '0.1234567890', 'average_cost', '0.1234567890', 'current_price', '0.1234567890'),
    jsonb_build_object('symbol', 'ZERO', 'name', 'Zero cost fixture', 'asset_type', 'stock',
    'quantity', '1', 'average_cost', '0', 'current_price', '1'));
  perform public.preview_detailed_investment_conversion(setup_account, 1000, opening);
  perform public.enable_detailed_investment_tracking(setup_account, today - 1, 1000, opening);
  perform pg_temp.check_true((select quantity::text = '0.1234567890' and unit_price::text = '0.1234567890'
    from public.investment_trades where holding_id = (select id from public.investment_holdings where account_id = setup_account and symbol = 'EXACT')), 'exact opening quantity and average cost');
  perform pg_temp.check_true((select unit_price = 0 from public.investment_trades
    where holding_id = (select id from public.investment_holdings where account_id = setup_account and symbol = 'ZERO')), 'zero opening average cost preserved');
  perform pg_temp.check_true(public.get_monthly_budget_summary(month_start) = budget, 'investment activity leaves budgets unchanged');
  result := public.get_dashboard_data();
  perform pg_temp.check_true(result->'monthly' = dashboard->'monthly' and result->'daily_spending' = dashboard->'daily_spending', 'investment activity leaves income/spending unchanged');

  -- Existing account lifecycle protections and user isolation remain authoritative.
  begin
    perform public.delete_account_permanently(bank);
    raise exception 'Expected active transaction reference rejection';
  exception when foreign_key_violation then
    if sqlerrm not like 'Account is used by %' then raise; end if;
  end;
  perform public.restore_account(archived);
  perform public.archive_account(archived);
  perform set_config('request.jwt.claim.sub', b::text, true);
  perform pg_temp.check_true(not exists(select 1 from public.accounts where id = bank), 'A accounts hidden from B');
  perform pg_temp.check_true(not exists(select 1 from public.investment_trades where account_id = detailed), 'A investments hidden from B');
  perform set_config('request.jwt.claim.sub', a::text, true);

  -- Exercise the deferred trigger independently of the RPC, as a privileged test
  -- fixture writer. Browser clients still have no direct INSERT permission.
  reset role;
  before_state := pg_temp.financial_state();
  begin
    insert into public.transactions(user_id, transaction_type, category_id, transaction_date)
      values(a, 'expense', category, today) returning id into tx;
    insert into public.transaction_entries(transaction_id, account_id, amount_minor) values(tx, simple, -100);
    set constraints all immediate;
    raise exception 'Expected integrity trigger rejection';
  exception when check_violation then null;
  end;
  perform pg_temp.check_true(pg_temp.financial_state() = before_state, 'trigger rejection leaves no partial record');

  -- Represent a legacy invalid expense without disabling triggers or rewriting
  -- any real history: create a Bank fixture, then change only its fixture type.
  set local role authenticated;
  legacy_account := public.upsert_account('Legacy fixture', 'bank', 'SGD', 0);
  legacy_tx := public.upsert_financial_transaction('expense', 700, legacy_account, today, category);
  set constraints all immediate;
  reset role;
  update public.accounts set account_type = 'investment' where id = legacy_account;
  perform pg_temp.check_true(not exists(select 1 from public.get_eligible_expense_facts(month_start, today) where transaction_id = legacy_tx), 'legacy investment expense excluded from facts');
  set local role authenticated;
  perform pg_temp.check_true(exists(select 1 from public.transactions where id = legacy_tx), 'legacy history preserved');
  perform pg_temp.check_true(public.get_monthly_budget_summary(month_start) = budget, 'legacy invalid expense excluded from budgets');
  perform pg_temp.check_true(public.get_spending_analytics(month_start, today, month_start - 1, month_start - 1, 'day') = analytics, 'legacy invalid expense excluded from Analytics');
  result := public.get_dashboard_data();
  perform pg_temp.check_true(result->'daily_spending' = dashboard->'daily_spending', 'legacy invalid expense excluded from Today spending');

  -- Foreign and deleted ordinary expenses retain their established exclusions.
  perform public.upsert_financial_transaction('expense', 500, fx_cash, today, category);
  tx := public.upsert_financial_transaction('expense', 300, cash, today, category);
  perform public.soft_delete_transaction(tx);
  perform pg_temp.check_true((public.get_spending_analytics(month_start, today, month_start - 1, month_start - 1, 'day') #>> '{summary,total_spent_minor}')::bigint = 200, 'foreign and deleted expenses excluded');
  select count(*) into before_count from public.net_worth_snapshots where user_id = a and snapshot_date = today;
  perform pg_temp.check_true(before_count = 1, 'one current snapshot per user/day');
end;
$$;

reset role;

-- Exact domain extremes are checked without performing monetary arithmetic
-- that would legitimately exceed BIGINT. Helpers remain unavailable to browsers.
select pg_temp.check_true(public.validate_investment_numeric('99999999999999999999.9999999999', 10)::text = '99999999999999999999.9999999999', 'maximum numeric(30,10)');
select pg_temp.check_true(public.validate_investment_numeric('999999999999999999.999999999999', 12)::text = '999999999999999999.999999999999', 'maximum numeric(30,12)');
select pg_temp.check_true(public.validate_investment_numeric('0.12345678900', 10) = 0.1234567890, 'extra trailing zeros are exactly representable');

rollback;
