# Account lifecycle verification

Apply `migrations/202608270001_add_safe_account_lifecycle.sql` to a confirmed test/staging project before production. Use two ordinary Auth users and the frontend or each user's JWT-backed SQL session; never use a service-role key to evaluate RLS.

## Ownership and direct-write checks

1. Create User A and User B, then create accounts for each.
2. As User A, call `archive_account`, `restore_account`, and `delete_account_permanently` with User B's account ID. Each call must fail without revealing User B's data.
3. As either authenticated browser role, attempt direct `delete` operations on `accounts`, `investment_valuations`, `investment_holdings`, `investment_trades`, `investment_prices`, and `investment_cash_events`. Each must be denied.

## Archive and restore

1. Create non-zero Bank, Cash, Simple investment, and Detailed investment accounts. Confirm archive is rejected for each.
2. Bring each represented value to zero using its existing authoritative model. Confirm archive succeeds.
3. Confirm archived accounts disappear from Dashboard, active Accounts/Investments, and new Expense/Income/Transfer selectors, but remain under **Archived accounts** with readable names.
4. Restore an account. Confirm it returns to active lists with unchanged history and no new transaction, entry, valuation, trade, or cash event.

## Permanent test-account cleanup

1. Create a Detailed test investment with holdings, trades, prices, dividends/cash events, and no ordinary transaction entries.
2. Permanently delete it after typing `DELETE`. Confirm the account and only its owned ledger rows disappear.
3. Confirm another Bank account and another investment account retain identical balances, holdings, prices, and history.
4. Repeat with a Simple test investment and confirm only its valuations are removed.
5. Create an active transfer referencing a test account and confirm permanent deletion is rejected with the active transaction count.
6. Soft-delete that transaction, retry deletion, and confirm the complete already-deleted transaction plus entries are purged without changing current balances.
7. Confirm today's snapshot is updated and no duplicate snapshot is created. Historical snapshots remain unchanged.

## Offline and cache behaviour

1. While offline, confirm Archive, Restore, and Delete permanently all refuse to submit and are not replayed after reconnecting.
2. After each successful lifecycle action, confirm Accounts, transaction selectors, Dashboard, Investments, Goals available cash, and current totals refresh.
