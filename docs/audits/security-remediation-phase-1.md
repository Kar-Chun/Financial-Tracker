# Security Remediation Phase 1 — Financial Integrity Boundaries

## Scope and baseline

Only M1 (offline mutation replay), M2 (ordinary account-type enforcement), and L1 (investment numeric boundaries) are addressed. No deployment or live financial calls were performed. No notification, Gemini, header, dependency, export-format, auth, service-worker, or performance V2 changes are included.

Read AGENTS.md, README.md and the Performance & Reliability V1 audit. No Security Review V1 report file existed; the conversation's completed review supplied the findings. Initial working tree was clean. No reset, restore, clean or stash was used.

Baseline: `npm.cmd test` passed 476 tests in 89 files; lint, build, injectManifest and `git diff --check` passed. PWA precache: 86 entries, 1701.06 KiB. The existing build deprecation warning for `inlineDynamicImports` remains.

The repository had 21 migrations ending at `202609230001_add_full_data_export.sql`. Deployed migration state was not queried. This change adds one migration, `202609260001_harden_financial_input_boundaries.sql`; historical migrations are unchanged.

## M1 — Immediate offline rejection

Installed TanStack Query is 5.101.4. Its retryer treats the default `online` network mode as unable to start offline, so the mutation can pause before the service's `performFinancialMutation()` guard runs. Reconnection previously allowed the guard to run after connectivity returned.

`useFinancialMutation` sets `networkMode: "always"` and `retry: false` after supplied options. Its typed options exclude overrides for network mode, retries and mutation scopes. Existing services retain their offline guards. Offline submissions therefore execute only far enough to reject, with no Supabase client or write request and no paused mutation to resume.

The hook is used by all 24 financial mutation hooks:

- Transactions: create/update Expense, Income and Transfer; soft delete.
- Accounts: create/update, reconcile, archive, restore, permanent cleanup and Simple valuation.
- Budgets: overall/category limits, remove category limit and copy month.
- Categories: create/update and archive/restore.
- Goals: create/update, archive/restore and allocation/reduction.
- Detailed investments: conversion, holding metadata, buy/sell, prices, FX and dividend/cash adjustment.
- Settings: Net Worth history reset.

Read-only conversion preview, profile/auth settings and notification mutations retain their existing policies. Notification services share the low-level offline guard but are not financial writes; changing their behavior belongs outside Phase 1. No global network-mode change, offline persistence, or service-worker queue was introduced.

The regression suite renders each real feature hook with a real QueryClient and real financial service, mocking only Supabase. It verifies immediate rejection, no client acquisition/RPC, `isPaused: false`, error state, retry disabled even against a retry-enabled generic default, form unmount and reconnect with zero writes. Additional tests require a new explicit submission after reconnect and prove an online transport failure is attempted only once.

## M2 — Trusted ordinary account rule

The effective `upsert_financial_transaction` definition was the reconciliation migration's version. It now checks the locked, owned source account is Bank/Cash for Expense/Income, before inserting or updating any transaction or entries. Existing ownership, archive, category, serialization, read-only reconciliation and snapshot behavior is preserved.

The existing deferred transaction/entry integrity triggers call the replaced `validate_transaction_integrity()` body, which now independently rejects ordinary investment-account entries. Trigger definitions and direct browser grants are unchanged. Alternate reconciliation writes remain adjustments, not ordinary income/expenses.

Transfer branches remain byte-for-byte unchanged: funding and withdrawing Simple/Detailed investments is still supported under the existing same-currency and ownership rules.

`get_eligible_expense_facts` additionally requires Bank/Cash. This excludes only structurally invalid ordinary investment-account expenses; all date, currency, deletion and consumer rules remain unchanged. No record is repaired, deleted or relabeled, and historical snapshots are not rebuilt. Invalid historical Income, if any exists, is not rewritten or silently redefined by this expense-only change.

### Historical-data preflight — manual, before production migration

Production data was not available, so absence of invalid history cannot be claimed. Run this read-only aggregate as an authorized database administrator. It prints counts, not transaction payloads:

```sql
select t.transaction_type, a.account_type, a.investment_tracking_mode,
       count(distinct t.id) as affected_transactions
from public.transactions t
join public.transaction_entries e on e.transaction_id = t.id
join public.accounts a on a.id = e.account_id
where t.deleted_at is null
  and t.transaction_type in ('expense', 'income')
  and a.account_type not in ('bank', 'cash')
group by t.transaction_type, a.account_type, a.investment_tracking_mode;
```

If counts are nonzero, review the affected history with its owner before rollout: expense-derived current metrics will exclude those invalid expenses after migration. Preserve the history; correction is a separate explicit decision. A zero result establishes absence only for that environment and time.

## L1 — Exact numeric boundary validation

| Input | Actual destination | Rule |
| --- | --- | --- |
| Trade/opening quantity | `investment_trades.quantity numeric(30,10)` | Positive; at most 20 integer digits; exactly representable at scale 10 |
| Trade unit price | `investment_trades.unit_price numeric(30,10)` | Positive; same precision/scale |
| Opening average cost | Opening trade's `unit_price numeric(30,10)` | Same domain, but zero remains valid |
| Opening/manual price | `investment_prices.price numeric(30,10)` | Positive; same precision/scale |
| Manual FX | `manual_fx_rates.rate numeric(30,12)` | Positive; at most 18 integer digits; exactly representable at scale 12 |

Cash, fees, dividends and Simple valuations remain BIGINT minor units with their existing validations; no JavaScript Number conversion was introduced for decimal inputs.

The new internal `validate_investment_numeric(text, integer, boolean)` parses without a typmod, explicitly rejects canonical `NaN`, `Infinity` and `-Infinity`, checks sign and integer range, and compares the value to `trunc(value, scale)`. A difference rejects the input. It returns the original value; it never rounds/truncates an invalid input and continues. Extra trailing zeros are accepted when the value is exactly representable, e.g. `0.12345678900` equals `0.1234567890`.

PostgreSQL treats NUMERIC NaN as greater than finite values; positivity alone is insufficient. No unsupported `isfinite(numeric)` call is used. See [PostgreSQL numeric documentation](https://www.postgresql.org/docs/current/datatype-numeric.html) and [TanStack network modes](https://tanstack.com/query/latest/docs/framework/react/guides/network-mode).

`validate_opening_investment_numbers(jsonb)` preflights quantity, average cost and current price for every opening holding before preview arithmetic or account conversion. Manual prices are also preflighted as a complete batch. All new helpers have an empty search path and are revoked from PUBLIC, anon and authenticated; existing SECURITY DEFINER callers use them internally.

Replaced externally callable numeric RPC bodies:

- `preview_detailed_investment_conversion`
- `enable_detailed_investment_tracking`
- `record_investment_trade`
- `update_investment_prices`
- `upsert_manual_fx_rate`

Their formulas, accepted-input arithmetic, locking, valuation and ledger semantics are unchanged. Frontend error mapping supplies restrained validation messages without displaying raw SQL input or logging financial values.

## Verification and limits

Automated checks include real TanStack mutation behavior and static migration checks. The static tests compare hardened RPC bodies with their previous effective definitions after removing only the new validation statements, protecting the unchanged financial formulas and transfer branches. They are not substitutes for database execution.

Docker's executable is installed, but the Docker Desktop Linux daemon is unavailable. No local PostgreSQL/Supabase executable was available. Consequently real database integration tests were not executed here.

Run `supabase/FINANCIAL_BOUNDARIES_VERIFICATION.sql` after applying all migrations to a disposable/local or staging Supabase database, as postgres, with stop-on-error enabled. It creates fresh fixtures, uses authenticated roles for caller behavior, and ends in ROLLBACK. If execution aborts, explicitly roll back the failed transaction in the SQL session.

The script covers:

- All eight Expense/Income × Bank/Cash/Simple/Detailed cases; rejected inserts and edits leave transactions, entries and snapshots unchanged.
- Cross-user and archived-account rejection, browser direct-write denial and private helper grants.
- Transfers to/from both investment modes, represented balances and Net Worth neutrality.
- Reconciliation, Today’s Spending, Analytics, budgets and one snapshot per local day.
- Each numeric input/domain: valid maximum fractional scale, excess scale/integer digits, NaN, both infinities, zero/negative restrictions, canonical exact storage and no partial state.
- Batch rejection after a valid first item, preserving Simple conversion mode and all ledger rows.
- Independent deferred integrity trigger rejection and legacy invalid-expense exclusion without history deletion.
- Existing foreign-currency/deleted expense exclusions and account lifecycle protections.

Also run the existing `ACCOUNT_RECONCILIATION_VERIFICATION.sql` and the V2/account-lifecycle/RLS verification procedures against the migrated staging environment. Their financial models were not changed.

Manual iPhone/PWA check: load a form online, disconnect, Save, confirm immediate existing offline error, close the form, reconnect and confirm no write. Explicitly submit again and confirm exactly one write. Repeat for a trade and reconciliation; exercise user switching to confirm no retained prior-user data.

### Final local results

- `npm.cmd test`: **516 tests passed in 91 files** (40 added tests; all 476 existing tests retained).
- `npm.cmd run lint`: passed.
- `npm.cmd run build`: passed, including TypeScript and PWA injectManifest.
- Static precache: **87 entries / 1701.80 KiB**. Service-worker source/strategy is unchanged.
- `git diff --check`: passed.
- No package/lockfile, Edge Function, hosting configuration, generated database type, or existing migration changes.

Expense/Income, transfer, reconciliation, spending, Today’s Spending, budgets, Analytics, account balances, Net Worth/snapshots, Simple/Detailed investment precision, account lifecycle and user-isolation suites pass locally. Database-specific cases are additionally specified in the rollback script but remain unexecuted pending a running Supabase/PostgreSQL environment; static preservation checks do not certify production behavior.

Changed frontend files are the seven financial hook modules, the reusable mutation hook and its regression tests, and two safe error mappings. Database changes are confined to the single appended migration. The security regression test, migration-order test, rollback SQL, README and this report document and verify that scope.

## Deployment order

1. Confirm the intended Supabase project and deployed migration sequence. Run the historical-data preflight and review any nonzero result.
2. Apply the single new migration to staging; run rollback SQL and the existing financial/RLS checks.
3. Apply the same reviewed migration to production using the normal authorized deployment process. No old migration is edited.
4. Regenerate database types through the existing confirmed-project workflow if required; public RPC signatures are unchanged and no generated types were hand-edited here.
5. Deploy the frontend containing the financial mutation hook and safe error mapping. Existing cached frontend versions need an app update/reload to receive M1; backend guards apply immediately after migration.
6. Perform installed-device offline/reconnect, valid write, precision and user-isolation smoke checks.

Recommended commit: `fix: enforce financial mutation and numeric input boundaries`
