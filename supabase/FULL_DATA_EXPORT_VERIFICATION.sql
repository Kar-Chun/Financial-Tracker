-- Disposable/local Supabase database only, after all migrations, run as postgres.
-- Fixtures exercise the real export as authenticated/anon roles. Always rolls back.
begin;

create function pg_temp.check_true(ok boolean, explanation text) returns void
language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'Verification failed: %', explanation; end if;
end;
$$;

-- User A: complete domain fixture.
insert into auth.users(id, email, raw_user_meta_data)
values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001@example.invalid', '{}'::jsonb);
update public.profiles set display_name = 'Export fixture', timezone = 'Asia/Singapore' where id = '00000000-0000-4000-8000-000000000001';
insert into public.accounts (id, user_id, name, account_type, institution, currency_code, opening_balance_minor, created_at, updated_at, archived_at, investment_tracking_mode, detailed_started_on, detailed_started_at)
values ('00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000001', 'Cash', 'cash', null, 'SGD', '9007199254740993', '2026-09-23T12:00:00+00:00', '2026-09-23T12:00:00+00:00', null, 'simple', null, null);
insert into public.accounts (id, user_id, name, account_type, institution, currency_code, opening_balance_minor, created_at, updated_at, archived_at, investment_tracking_mode, detailed_started_on, detailed_started_at)
values ('00000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000001', 'Archived bank', 'bank', null, 'SGD', '9007199254740993', '2026-09-23T12:00:00+00:00', '2026-09-23T12:00:00+00:00', null, 'simple', null, null);
insert into public.accounts (id, user_id, name, account_type, institution, currency_code, opening_balance_minor, created_at, updated_at, archived_at, investment_tracking_mode, detailed_started_on, detailed_started_at)
values ('00000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000001', 'Detailed USD', 'investment', null, 'USD', '9007199254740993', '2026-09-23T12:00:00+00:00', '2026-09-23T12:00:00+00:00', null, 'detailed', '2026-09-23', '2026-09-23T12:00:00+00:00');
insert into public.accounts (id, user_id, name, account_type, institution, currency_code, opening_balance_minor, created_at, updated_at, archived_at, investment_tracking_mode, detailed_started_on, detailed_started_at)
values ('00000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000001', 'Simple investment', 'investment', null, 'SGD', '9007199254740993', '2026-09-23T12:00:00+00:00', '2026-09-23T12:00:00+00:00', null, 'simple', null, null);
insert into public.categories (id, user_id, name, parent_id, category_type, created_at, archived_at)
values ('00000000-0000-4000-8000-000000000006', '00000000-0000-4000-8000-000000000001', 'Export Food', null, 'expense', '2026-09-23T12:00:00+00:00', null);
insert into public.categories (id, user_id, name, parent_id, category_type, created_at, archived_at)
values ('00000000-0000-4000-8000-000000000007', '00000000-0000-4000-8000-000000000001', 'Export Lunch', '00000000-0000-4000-8000-000000000006', 'expense', '2026-09-23T12:00:00+00:00', null);
insert into public.transactions (id, user_id, transaction_type, category_id, description, transaction_date, created_at, updated_at, deleted_at, is_reconciliation)
values ('00000000-0000-4000-8000-000000000008', '00000000-0000-4000-8000-000000000001', 'transfer', null, 'Move money', '2026-09-23', '2026-09-23T12:00:00+00:00', '2026-09-23T12:00:00+00:00', null, false);
insert into public.transactions (id, user_id, transaction_type, category_id, description, transaction_date, created_at, updated_at, deleted_at, is_reconciliation)
values ('00000000-0000-4000-8000-000000000009', '00000000-0000-4000-8000-000000000001', 'adjustment', null, 'Reconcile', '2026-09-23', '2026-09-23T12:00:00+00:00', '2026-09-23T12:00:00+00:00', null, true);
insert into public.transactions (id, user_id, transaction_type, category_id, description, transaction_date, created_at, updated_at, deleted_at, is_reconciliation)
values ('00000000-0000-4000-8000-000000000010', '00000000-0000-4000-8000-000000000001', 'expense', '00000000-0000-4000-8000-000000000007', '=HYPERLINK("bad")', '2026-09-23', '2026-09-23T12:00:00+00:00', '2026-09-23T12:00:00+00:00', '2026-09-23T12:00:00+00:00', false);
insert into public.transaction_entries (id, transaction_id, account_id, amount_minor, created_at)
values ('00000000-0000-4000-8000-000000000011', '00000000-0000-4000-8000-000000000008', '00000000-0000-4000-8000-000000000002', '-550', '2026-09-23T12:00:00+00:00');
insert into public.transaction_entries (id, transaction_id, account_id, amount_minor, created_at)
values ('00000000-0000-4000-8000-000000000012', '00000000-0000-4000-8000-000000000008', '00000000-0000-4000-8000-000000000003', '550', '2026-09-23T12:00:00+00:00');
insert into public.transaction_entries (id, transaction_id, account_id, amount_minor, created_at)
values ('00000000-0000-4000-8000-000000000013', '00000000-0000-4000-8000-000000000009', '00000000-0000-4000-8000-000000000002', '-25', '2026-09-23T12:00:00+00:00');
insert into public.transaction_entries (id, transaction_id, account_id, amount_minor, created_at)
values ('00000000-0000-4000-8000-000000000014', '00000000-0000-4000-8000-000000000010', '00000000-0000-4000-8000-000000000002', '-9007199254740993', '2026-09-23T12:00:00+00:00');
insert into public.investment_valuations (id, user_id, account_id, native_value_minor, base_value_minor, valued_at, created_at, updated_at)
values ('00000000-0000-4000-8000-000000000105', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000005', '1200', '1200', '2026-09-23', '2026-09-23T12:00:00+00:00', '2026-09-23T12:00:00+00:00');
insert into public.monthly_budgets (id, user_id, month_start, currency_code, amount_minor, created_at, updated_at)
values ('00000000-0000-4000-8000-000000000015', '00000000-0000-4000-8000-000000000001', '2026-09-01', 'SGD', '1200', '2026-09-23T12:00:00+00:00', '2026-09-23T12:00:00+00:00');
insert into public.category_budgets (id, monthly_budget_id, category_id, amount_minor, created_at, updated_at)
values ('00000000-0000-4000-8000-000000000107', '00000000-0000-4000-8000-000000000015', '00000000-0000-4000-8000-000000000006', '1200', '2026-09-23T12:00:00+00:00', '2026-09-23T12:00:00+00:00');
insert into public.savings_goals (id, user_id, name, target_amount_minor, currency_code, target_date, note, archived_at, created_at, updated_at)
values ('00000000-0000-4000-8000-000000000016', '00000000-0000-4000-8000-000000000001', 'Travel', '1200', 'SGD', null, null, null, '2026-09-23T12:00:00+00:00', '2026-09-23T12:00:00+00:00');
insert into public.goal_allocations (id, goal_id, amount_minor, allocation_date, note, created_at)
values ('00000000-0000-4000-8000-000000000109', '00000000-0000-4000-8000-000000000016', '350', '2026-09-23', null, '2026-09-23T12:00:00+00:00');
insert into public.goal_allocations (id, goal_id, amount_minor, allocation_date, note, created_at)
values ('00000000-0000-4000-8000-000000000017', '00000000-0000-4000-8000-000000000016', '-100', '2026-09-23', null, '2026-09-23T12:00:00+00:00');
insert into public.net_worth_snapshots (id, user_id, snapshot_date, bank_value_base_minor, cash_value_base_minor, investment_value_base_minor, total_value_base_minor, created_at, updated_at)
values ('00000000-0000-4000-8000-000000000110', '00000000-0000-4000-8000-000000000001', '2026-09-23', '1200', '1200', '1200', '3600', '2026-09-23T12:00:00+00:00', '2026-09-23T12:00:00+00:00');
insert into public.manual_fx_rates (id, user_id, from_currency, to_currency, rate, rate_date, created_at, updated_at)
values ('00000000-0000-4000-8000-000000000111', '00000000-0000-4000-8000-000000000001', 'USD', 'SGD', '1.354712345678', '2026-09-23', '2026-09-23T12:00:00+00:00', '2026-09-23T12:00:00+00:00');
insert into public.investment_holdings (id, account_id, user_id, symbol, name, asset_type, currency_code, archived_at, created_at, updated_at)
values ('00000000-0000-4000-8000-000000000018', '00000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000001', 'TEST', 'Holding', 'stock', 'USD', null, '2026-09-23T12:00:00+00:00', '2026-09-23T12:00:00+00:00');
insert into public.investment_trades (id, holding_id, account_id, user_id, trade_type, quantity, unit_price, fee_minor, cash_effect_minor, cost_basis_effect_minor, realized_gain_minor, trade_date, note, created_at)
values ('00000000-0000-4000-8000-000000000113', '00000000-0000-4000-8000-000000000018', '00000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000001', 'opening_position', '12345678901234567890.1234567890', '231.1234567890', '1200', '1200', '1200', '1200', '2026-09-23', null, '2026-09-23T12:00:00+00:00');
insert into public.investment_prices (id, holding_id, user_id, price, priced_at, created_at, updated_at)
values ('00000000-0000-4000-8000-000000000114', '00000000-0000-4000-8000-000000000018', '00000000-0000-4000-8000-000000000001', '231.1234567890', '2026-09-23', '2026-09-23T12:00:00+00:00', '2026-09-23T12:00:00+00:00');
insert into public.investment_cash_events (id, account_id, holding_id, user_id, event_type, amount_minor, event_date, note, created_at)
values ('00000000-0000-4000-8000-000000000115', '00000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000018', '00000000-0000-4000-8000-000000000001', 'dividend', '1200', '2026-09-23', null, '2026-09-23T12:00:00+00:00');
insert into public.notification_preferences (user_id, daily_reminder_enabled, created_at, updated_at)
values ('00000000-0000-4000-8000-000000000001', true, '2026-09-23T12:00:00+00:00', '2026-09-23T12:00:00+00:00');
update public.accounts set archived_at = '2026-09-23T12:00:00+00:00' where id = '00000000-0000-4000-8000-000000000003';
update public.categories set archived_at = '2026-09-23T12:00:00+00:00' where id = '00000000-0000-4000-8000-000000000007';
update public.savings_goals set archived_at = '2026-09-23T12:00:00+00:00' where id = '00000000-0000-4000-8000-000000000016';
insert into public.push_subscriptions (user_id, endpoint, p256dh, auth)
values ('00000000-0000-4000-8000-000000000001', 'https://fcm.googleapis.com/fcm/send/export-fixture-0', repeat('p', 87), repeat('a', 22));

-- User B: complete domain fixture.
insert into auth.users(id, email, raw_user_meta_data)
values ('00000000-0000-4000-8000-000000001001', '00000000-0000-4000-8000-000000001001@example.invalid', '{}'::jsonb);
update public.profiles set display_name = 'Export fixture', timezone = 'Asia/Singapore' where id = '00000000-0000-4000-8000-000000001001';
insert into public.accounts (id, user_id, name, account_type, institution, currency_code, opening_balance_minor, created_at, updated_at, archived_at, investment_tracking_mode, detailed_started_on, detailed_started_at)
values ('00000000-0000-4000-8000-000000001002', '00000000-0000-4000-8000-000000001001', 'Cash', 'cash', null, 'SGD', '9007199254740993', '2026-09-23T12:00:00+00:00', '2026-09-23T12:00:00+00:00', null, 'simple', null, null);
insert into public.accounts (id, user_id, name, account_type, institution, currency_code, opening_balance_minor, created_at, updated_at, archived_at, investment_tracking_mode, detailed_started_on, detailed_started_at)
values ('00000000-0000-4000-8000-000000001003', '00000000-0000-4000-8000-000000001001', 'Archived bank', 'bank', null, 'SGD', '9007199254740993', '2026-09-23T12:00:00+00:00', '2026-09-23T12:00:00+00:00', null, 'simple', null, null);
insert into public.accounts (id, user_id, name, account_type, institution, currency_code, opening_balance_minor, created_at, updated_at, archived_at, investment_tracking_mode, detailed_started_on, detailed_started_at)
values ('00000000-0000-4000-8000-000000001004', '00000000-0000-4000-8000-000000001001', 'Detailed USD', 'investment', null, 'USD', '9007199254740993', '2026-09-23T12:00:00+00:00', '2026-09-23T12:00:00+00:00', null, 'detailed', '2026-09-23', '2026-09-23T12:00:00+00:00');
insert into public.accounts (id, user_id, name, account_type, institution, currency_code, opening_balance_minor, created_at, updated_at, archived_at, investment_tracking_mode, detailed_started_on, detailed_started_at)
values ('00000000-0000-4000-8000-000000001005', '00000000-0000-4000-8000-000000001001', 'Simple investment', 'investment', null, 'SGD', '9007199254740993', '2026-09-23T12:00:00+00:00', '2026-09-23T12:00:00+00:00', null, 'simple', null, null);
insert into public.categories (id, user_id, name, parent_id, category_type, created_at, archived_at)
values ('00000000-0000-4000-8000-000000001006', '00000000-0000-4000-8000-000000001001', 'Export Food', null, 'expense', '2026-09-23T12:00:00+00:00', null);
insert into public.categories (id, user_id, name, parent_id, category_type, created_at, archived_at)
values ('00000000-0000-4000-8000-000000001007', '00000000-0000-4000-8000-000000001001', 'Export Lunch', '00000000-0000-4000-8000-000000001006', 'expense', '2026-09-23T12:00:00+00:00', null);
insert into public.transactions (id, user_id, transaction_type, category_id, description, transaction_date, created_at, updated_at, deleted_at, is_reconciliation)
values ('00000000-0000-4000-8000-000000001008', '00000000-0000-4000-8000-000000001001', 'transfer', null, 'Move money', '2026-09-23', '2026-09-23T12:00:00+00:00', '2026-09-23T12:00:00+00:00', null, false);
insert into public.transactions (id, user_id, transaction_type, category_id, description, transaction_date, created_at, updated_at, deleted_at, is_reconciliation)
values ('00000000-0000-4000-8000-000000001009', '00000000-0000-4000-8000-000000001001', 'adjustment', null, 'Reconcile', '2026-09-23', '2026-09-23T12:00:00+00:00', '2026-09-23T12:00:00+00:00', null, true);
insert into public.transactions (id, user_id, transaction_type, category_id, description, transaction_date, created_at, updated_at, deleted_at, is_reconciliation)
values ('00000000-0000-4000-8000-000000001010', '00000000-0000-4000-8000-000000001001', 'expense', '00000000-0000-4000-8000-000000001007', '=HYPERLINK("bad")', '2026-09-23', '2026-09-23T12:00:00+00:00', '2026-09-23T12:00:00+00:00', '2026-09-23T12:00:00+00:00', false);
insert into public.transaction_entries (id, transaction_id, account_id, amount_minor, created_at)
values ('00000000-0000-4000-8000-000000001011', '00000000-0000-4000-8000-000000001008', '00000000-0000-4000-8000-000000001002', '-550', '2026-09-23T12:00:00+00:00');
insert into public.transaction_entries (id, transaction_id, account_id, amount_minor, created_at)
values ('00000000-0000-4000-8000-000000001012', '00000000-0000-4000-8000-000000001008', '00000000-0000-4000-8000-000000001003', '550', '2026-09-23T12:00:00+00:00');
insert into public.transaction_entries (id, transaction_id, account_id, amount_minor, created_at)
values ('00000000-0000-4000-8000-000000001013', '00000000-0000-4000-8000-000000001009', '00000000-0000-4000-8000-000000001002', '-25', '2026-09-23T12:00:00+00:00');
insert into public.transaction_entries (id, transaction_id, account_id, amount_minor, created_at)
values ('00000000-0000-4000-8000-000000001014', '00000000-0000-4000-8000-000000001010', '00000000-0000-4000-8000-000000001002', '-9007199254740993', '2026-09-23T12:00:00+00:00');
insert into public.investment_valuations (id, user_id, account_id, native_value_minor, base_value_minor, valued_at, created_at, updated_at)
values ('00000000-0000-4000-8000-000000001105', '00000000-0000-4000-8000-000000001001', '00000000-0000-4000-8000-000000001005', '1200', '1200', '2026-09-23', '2026-09-23T12:00:00+00:00', '2026-09-23T12:00:00+00:00');
insert into public.monthly_budgets (id, user_id, month_start, currency_code, amount_minor, created_at, updated_at)
values ('00000000-0000-4000-8000-000000001015', '00000000-0000-4000-8000-000000001001', '2026-09-01', 'SGD', '1200', '2026-09-23T12:00:00+00:00', '2026-09-23T12:00:00+00:00');
insert into public.category_budgets (id, monthly_budget_id, category_id, amount_minor, created_at, updated_at)
values ('00000000-0000-4000-8000-000000001107', '00000000-0000-4000-8000-000000001015', '00000000-0000-4000-8000-000000001006', '1200', '2026-09-23T12:00:00+00:00', '2026-09-23T12:00:00+00:00');
insert into public.savings_goals (id, user_id, name, target_amount_minor, currency_code, target_date, note, archived_at, created_at, updated_at)
values ('00000000-0000-4000-8000-000000001016', '00000000-0000-4000-8000-000000001001', 'Travel', '1200', 'SGD', null, null, null, '2026-09-23T12:00:00+00:00', '2026-09-23T12:00:00+00:00');
insert into public.goal_allocations (id, goal_id, amount_minor, allocation_date, note, created_at)
values ('00000000-0000-4000-8000-000000001109', '00000000-0000-4000-8000-000000001016', '350', '2026-09-23', null, '2026-09-23T12:00:00+00:00');
insert into public.goal_allocations (id, goal_id, amount_minor, allocation_date, note, created_at)
values ('00000000-0000-4000-8000-000000001017', '00000000-0000-4000-8000-000000001016', '-100', '2026-09-23', null, '2026-09-23T12:00:00+00:00');
insert into public.net_worth_snapshots (id, user_id, snapshot_date, bank_value_base_minor, cash_value_base_minor, investment_value_base_minor, total_value_base_minor, created_at, updated_at)
values ('00000000-0000-4000-8000-000000001110', '00000000-0000-4000-8000-000000001001', '2026-09-23', '1200', '1200', '1200', '3600', '2026-09-23T12:00:00+00:00', '2026-09-23T12:00:00+00:00');
insert into public.manual_fx_rates (id, user_id, from_currency, to_currency, rate, rate_date, created_at, updated_at)
values ('00000000-0000-4000-8000-000000001111', '00000000-0000-4000-8000-000000001001', 'USD', 'SGD', '1.354712345678', '2026-09-23', '2026-09-23T12:00:00+00:00', '2026-09-23T12:00:00+00:00');
insert into public.investment_holdings (id, account_id, user_id, symbol, name, asset_type, currency_code, archived_at, created_at, updated_at)
values ('00000000-0000-4000-8000-000000001018', '00000000-0000-4000-8000-000000001004', '00000000-0000-4000-8000-000000001001', 'TEST', 'Holding', 'stock', 'USD', null, '2026-09-23T12:00:00+00:00', '2026-09-23T12:00:00+00:00');
insert into public.investment_trades (id, holding_id, account_id, user_id, trade_type, quantity, unit_price, fee_minor, cash_effect_minor, cost_basis_effect_minor, realized_gain_minor, trade_date, note, created_at)
values ('00000000-0000-4000-8000-000000001113', '00000000-0000-4000-8000-000000001018', '00000000-0000-4000-8000-000000001004', '00000000-0000-4000-8000-000000001001', 'opening_position', '12345678901234567890.1234567890', '231.1234567890', '1200', '1200', '1200', '1200', '2026-09-23', null, '2026-09-23T12:00:00+00:00');
insert into public.investment_prices (id, holding_id, user_id, price, priced_at, created_at, updated_at)
values ('00000000-0000-4000-8000-000000001114', '00000000-0000-4000-8000-000000001018', '00000000-0000-4000-8000-000000001001', '231.1234567890', '2026-09-23', '2026-09-23T12:00:00+00:00', '2026-09-23T12:00:00+00:00');
insert into public.investment_cash_events (id, account_id, holding_id, user_id, event_type, amount_minor, event_date, note, created_at)
values ('00000000-0000-4000-8000-000000001115', '00000000-0000-4000-8000-000000001004', '00000000-0000-4000-8000-000000001018', '00000000-0000-4000-8000-000000001001', 'dividend', '1200', '2026-09-23', null, '2026-09-23T12:00:00+00:00');
insert into public.notification_preferences (user_id, daily_reminder_enabled, created_at, updated_at)
values ('00000000-0000-4000-8000-000000001001', true, '2026-09-23T12:00:00+00:00', '2026-09-23T12:00:00+00:00');
update public.accounts set archived_at = '2026-09-23T12:00:00+00:00' where id = '00000000-0000-4000-8000-000000001003';
update public.categories set archived_at = '2026-09-23T12:00:00+00:00' where id = '00000000-0000-4000-8000-000000001007';
update public.savings_goals set archived_at = '2026-09-23T12:00:00+00:00' where id = '00000000-0000-4000-8000-000000001016';
insert into public.push_subscriptions (user_id, endpoint, p256dh, auth)
values ('00000000-0000-4000-8000-000000001001', 'https://fcm.googleapis.com/fcm/send/export-fixture-1000', repeat('p', 87), repeat('a', 22));

set constraints all immediate;

-- Fingerprint stored domain records before the read, including snapshots.
create temp table export_before as
select 'profiles' as table_name, md5(coalesce(jsonb_agg(to_jsonb(r) order by r.id)::text, '[]')) as fingerprint from public.profiles r
union all
select 'accounts' as table_name, md5(coalesce(jsonb_agg(to_jsonb(r) order by r.id)::text, '[]')) as fingerprint from public.accounts r
union all
select 'categories' as table_name, md5(coalesce(jsonb_agg(to_jsonb(r) order by r.id)::text, '[]')) as fingerprint from public.categories r
union all
select 'transactions' as table_name, md5(coalesce(jsonb_agg(to_jsonb(r) order by r.id)::text, '[]')) as fingerprint from public.transactions r
union all
select 'transaction_entries' as table_name, md5(coalesce(jsonb_agg(to_jsonb(r) order by r.id)::text, '[]')) as fingerprint from public.transaction_entries r
union all
select 'investment_valuations' as table_name, md5(coalesce(jsonb_agg(to_jsonb(r) order by r.id)::text, '[]')) as fingerprint from public.investment_valuations r
union all
select 'monthly_budgets' as table_name, md5(coalesce(jsonb_agg(to_jsonb(r) order by r.id)::text, '[]')) as fingerprint from public.monthly_budgets r
union all
select 'category_budgets' as table_name, md5(coalesce(jsonb_agg(to_jsonb(r) order by r.id)::text, '[]')) as fingerprint from public.category_budgets r
union all
select 'savings_goals' as table_name, md5(coalesce(jsonb_agg(to_jsonb(r) order by r.id)::text, '[]')) as fingerprint from public.savings_goals r
union all
select 'goal_allocations' as table_name, md5(coalesce(jsonb_agg(to_jsonb(r) order by r.id)::text, '[]')) as fingerprint from public.goal_allocations r
union all
select 'net_worth_snapshots' as table_name, md5(coalesce(jsonb_agg(to_jsonb(r) order by r.id)::text, '[]')) as fingerprint from public.net_worth_snapshots r
union all
select 'manual_fx_rates' as table_name, md5(coalesce(jsonb_agg(to_jsonb(r) order by r.id)::text, '[]')) as fingerprint from public.manual_fx_rates r
union all
select 'investment_holdings' as table_name, md5(coalesce(jsonb_agg(to_jsonb(r) order by r.id)::text, '[]')) as fingerprint from public.investment_holdings r
union all
select 'investment_trades' as table_name, md5(coalesce(jsonb_agg(to_jsonb(r) order by r.id)::text, '[]')) as fingerprint from public.investment_trades r
union all
select 'investment_prices' as table_name, md5(coalesce(jsonb_agg(to_jsonb(r) order by r.id)::text, '[]')) as fingerprint from public.investment_prices r
union all
select 'investment_cash_events' as table_name, md5(coalesce(jsonb_agg(to_jsonb(r) order by r.id)::text, '[]')) as fingerprint from public.investment_cash_events r
union all
select 'notification_preferences' as table_name, md5(coalesce(jsonb_agg(to_jsonb(r) order by r.user_id)::text, '[]')) as fingerprint from public.notification_preferences r;

do $$
declare
  a uuid := '00000000-0000-4000-8000-000000000001';
  b uuid := '00000000-0000-4000-8000-000000001001';
  result jsonb;
  second_result jsonb;
  collection record;
  item jsonb;
  expected_count bigint;
begin
  set local role anon;
  begin
    perform public.export_user_data_v1();
    raise exception 'Anonymous export unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;
  reset role;
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', '', true);
  begin
    perform public.export_user_data_v1();
    raise exception 'Missing authenticated identity unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;
  perform set_config('request.jwt.claim.sub', a::text, true);
  result := public.export_user_data_v1();
  perform set_config('request.jwt.claim.sub', b::text, true);
  second_result := public.export_user_data_v1();
  reset role;

  perform pg_temp.check_true(result->>'format' = 'ledgerly-backup' and result->>'version' = '1', 'stable independent format version');
  perform pg_temp.check_true(result->'data'->'profiles'->0->>'id' = a::text, 'own profile');
  perform pg_temp.check_true(second_result->'data'->'profiles'->0->>'id' = b::text, 'second user receives own profile');
  for collection in select key, value from jsonb_each(result->'data') loop
    perform pg_temp.check_true(jsonb_array_length(collection.value) = (result->'record_counts'->>collection.key)::integer, 'record counts match');
    for item in select value from jsonb_array_elements(collection.value) loop
      if item ? 'user_id' then
        perform pg_temp.check_true(item->>'user_id' = a::text, 'no cross-user records in ' || collection.key);
      end if;
      perform pg_temp.check_true(not exists (
        select 1 from jsonb_array_elements(second_result->'data'->collection.key) other
        where coalesce(item->>'id', item->>'user_id') = coalesce(other->>'id', other->>'user_id')
      ), 'users have disjoint records in ' || collection.key);
    end loop;
  end loop;
  select count(*) into expected_count from public.profiles r where r.id = a;
  perform pg_temp.check_true(jsonb_array_length(result->'data'->'profiles') = expected_count, 'profiles: complete retained rows');
  select count(*) into expected_count from public.accounts r where r.user_id = a;
  perform pg_temp.check_true(jsonb_array_length(result->'data'->'accounts') = expected_count, 'accounts: complete retained rows');
  select count(*) into expected_count from public.categories r where r.user_id = a;
  perform pg_temp.check_true(jsonb_array_length(result->'data'->'categories') = expected_count, 'categories: complete retained rows');
  select count(*) into expected_count from public.transactions r where r.user_id = a;
  perform pg_temp.check_true(jsonb_array_length(result->'data'->'transactions') = expected_count, 'transactions: complete retained rows');
  select count(*) into expected_count from public.transaction_entries r where exists (select 1 from public.transactions t join public.accounts a on a.id = r.account_id where t.id = r.transaction_id and t.user_id = a and a.user_id = a);
  perform pg_temp.check_true(jsonb_array_length(result->'data'->'transaction_entries') = expected_count, 'transaction_entries: complete retained rows');
  select count(*) into expected_count from public.investment_valuations r where r.user_id = a;
  perform pg_temp.check_true(jsonb_array_length(result->'data'->'investment_valuations') = expected_count, 'investment_valuations: complete retained rows');
  select count(*) into expected_count from public.monthly_budgets r where r.user_id = a;
  perform pg_temp.check_true(jsonb_array_length(result->'data'->'monthly_budgets') = expected_count, 'monthly_budgets: complete retained rows');
  select count(*) into expected_count from public.category_budgets r where exists (select 1 from public.monthly_budgets b join public.categories c on c.id = r.category_id where b.id = r.monthly_budget_id and b.user_id = a and c.user_id = a);
  perform pg_temp.check_true(jsonb_array_length(result->'data'->'category_budgets') = expected_count, 'category_budgets: complete retained rows');
  select count(*) into expected_count from public.savings_goals r where r.user_id = a;
  perform pg_temp.check_true(jsonb_array_length(result->'data'->'savings_goals') = expected_count, 'savings_goals: complete retained rows');
  select count(*) into expected_count from public.goal_allocations r where exists (select 1 from public.savings_goals g where g.id = r.goal_id and g.user_id = a);
  perform pg_temp.check_true(jsonb_array_length(result->'data'->'goal_allocations') = expected_count, 'goal_allocations: complete retained rows');
  select count(*) into expected_count from public.net_worth_snapshots r where r.user_id = a;
  perform pg_temp.check_true(jsonb_array_length(result->'data'->'net_worth_snapshots') = expected_count, 'net_worth_snapshots: complete retained rows');
  select count(*) into expected_count from public.manual_fx_rates r where r.user_id = a;
  perform pg_temp.check_true(jsonb_array_length(result->'data'->'manual_fx_rates') = expected_count, 'manual_fx_rates: complete retained rows');
  select count(*) into expected_count from public.investment_holdings r where r.user_id = a;
  perform pg_temp.check_true(jsonb_array_length(result->'data'->'investment_holdings') = expected_count, 'investment_holdings: complete retained rows');
  select count(*) into expected_count from public.investment_trades r where r.user_id = a;
  perform pg_temp.check_true(jsonb_array_length(result->'data'->'investment_trades') = expected_count, 'investment_trades: complete retained rows');
  select count(*) into expected_count from public.investment_prices r where r.user_id = a;
  perform pg_temp.check_true(jsonb_array_length(result->'data'->'investment_prices') = expected_count, 'investment_prices: complete retained rows');
  select count(*) into expected_count from public.investment_cash_events r where r.user_id = a;
  perform pg_temp.check_true(jsonb_array_length(result->'data'->'investment_cash_events') = expected_count, 'investment_cash_events: complete retained rows');
  select count(*) into expected_count from public.notification_preferences r where r.user_id = a;
  perform pg_temp.check_true(jsonb_array_length(result->'data'->'notification_preferences') = expected_count, 'notification_preferences: complete retained rows');

  perform pg_temp.check_true(exists (select 1 from jsonb_array_elements(result->'data'->'accounts') r where r->>'archived_at' is not null), 'archived account included');
  perform pg_temp.check_true(exists (select 1 from jsonb_array_elements(result->'data'->'categories') r where r->>'parent_id' is not null), 'category hierarchy included');
  perform pg_temp.check_true(exists (select 1 from jsonb_array_elements(result->'data'->'transactions') r where r->>'deleted_at' is not null), 'retained deletion included');
  perform pg_temp.check_true(exists (select 1 from jsonb_array_elements(result->'data'->'transactions') r where r->>'transaction_type' = 'adjustment' and (r->>'is_reconciliation')::boolean), 'reconciliation remains distinct');
  perform pg_temp.check_true((select count(*) = 2 from jsonb_array_elements(result->'data'->'transaction_entries') r where r->>'transaction_id' = '00000000-0000-4000-8000-000000000008'), 'both transfer legs included');
  perform pg_temp.check_true(result->'data'->'accounts'->0->>'opening_balance_minor' = '9007199254740993', 'BIGINT exact beyond JS safe range');
  perform pg_temp.check_true(jsonb_typeof(result->'data'->'accounts'->0->'opening_balance_minor') = 'string', 'BIGINT transmitted as text');
  perform pg_temp.check_true(result->'data'->'investment_trades'->0->>'quantity' = '12345678901234567890.1234567890', 'quantity exact decimal string');
  perform pg_temp.check_true(result->'data'->'investment_trades'->0->>'unit_price' = '231.1234567890', 'unit price exact decimal string');
  perform pg_temp.check_true(result->'data'->'investment_prices'->0->>'price' = '231.1234567890', 'manual price exact decimal string');
  perform pg_temp.check_true(result->'data'->'manual_fx_rates'->0->>'rate' = '1.354712345678', 'FX exact decimal string');
  perform pg_temp.check_true(not (result->'data' ?| array['push_subscriptions', 'notification_deliveries', 'ai_request_usage', 'ai_rate_limit_config']), 'operational tables excluded');
  perform pg_temp.check_true(result::text !~ 'export-fixture-|access_token|refresh_token|encrypted_password|p256dh', 'credential fields and push endpoint absent');
  perform pg_temp.check_true((select provolatile = 's' and pronargs = 0 from pg_proc where oid = 'public.export_user_data_v1()'::regprocedure), 'stable read-only function without user parameters');
end;
$$;

create temp table export_after as
select 'profiles' as table_name, md5(coalesce(jsonb_agg(to_jsonb(r) order by r.id)::text, '[]')) as fingerprint from public.profiles r
union all
select 'accounts' as table_name, md5(coalesce(jsonb_agg(to_jsonb(r) order by r.id)::text, '[]')) as fingerprint from public.accounts r
union all
select 'categories' as table_name, md5(coalesce(jsonb_agg(to_jsonb(r) order by r.id)::text, '[]')) as fingerprint from public.categories r
union all
select 'transactions' as table_name, md5(coalesce(jsonb_agg(to_jsonb(r) order by r.id)::text, '[]')) as fingerprint from public.transactions r
union all
select 'transaction_entries' as table_name, md5(coalesce(jsonb_agg(to_jsonb(r) order by r.id)::text, '[]')) as fingerprint from public.transaction_entries r
union all
select 'investment_valuations' as table_name, md5(coalesce(jsonb_agg(to_jsonb(r) order by r.id)::text, '[]')) as fingerprint from public.investment_valuations r
union all
select 'monthly_budgets' as table_name, md5(coalesce(jsonb_agg(to_jsonb(r) order by r.id)::text, '[]')) as fingerprint from public.monthly_budgets r
union all
select 'category_budgets' as table_name, md5(coalesce(jsonb_agg(to_jsonb(r) order by r.id)::text, '[]')) as fingerprint from public.category_budgets r
union all
select 'savings_goals' as table_name, md5(coalesce(jsonb_agg(to_jsonb(r) order by r.id)::text, '[]')) as fingerprint from public.savings_goals r
union all
select 'goal_allocations' as table_name, md5(coalesce(jsonb_agg(to_jsonb(r) order by r.id)::text, '[]')) as fingerprint from public.goal_allocations r
union all
select 'net_worth_snapshots' as table_name, md5(coalesce(jsonb_agg(to_jsonb(r) order by r.id)::text, '[]')) as fingerprint from public.net_worth_snapshots r
union all
select 'manual_fx_rates' as table_name, md5(coalesce(jsonb_agg(to_jsonb(r) order by r.id)::text, '[]')) as fingerprint from public.manual_fx_rates r
union all
select 'investment_holdings' as table_name, md5(coalesce(jsonb_agg(to_jsonb(r) order by r.id)::text, '[]')) as fingerprint from public.investment_holdings r
union all
select 'investment_trades' as table_name, md5(coalesce(jsonb_agg(to_jsonb(r) order by r.id)::text, '[]')) as fingerprint from public.investment_trades r
union all
select 'investment_prices' as table_name, md5(coalesce(jsonb_agg(to_jsonb(r) order by r.id)::text, '[]')) as fingerprint from public.investment_prices r
union all
select 'investment_cash_events' as table_name, md5(coalesce(jsonb_agg(to_jsonb(r) order by r.id)::text, '[]')) as fingerprint from public.investment_cash_events r
union all
select 'notification_preferences' as table_name, md5(coalesce(jsonb_agg(to_jsonb(r) order by r.user_id)::text, '[]')) as fingerprint from public.notification_preferences r;
select pg_temp.check_true(not exists (
  select 1 from export_before b full join export_after a using (table_name)
  where a.fingerprint is distinct from b.fingerprint
), 'all stored records and snapshots unchanged by export');

rollback;
