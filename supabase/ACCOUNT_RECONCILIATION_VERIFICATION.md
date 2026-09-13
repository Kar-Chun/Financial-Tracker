# Account Reconciliation V1 verification

## Implementation and audit

- Existing schema already allows `adjustment` and `refund`; no supported RPC previously created them. The new writer uses adjustment plus `is_reconciliation = true`, rather than reinterpreting legacy adjustments as safe-to-purge records.
- Balance is the existing account summary: opening balance plus non-deleted signed entries through the profile-local current day. No separate stored balance, FX, or investment formula.
- One adjustment/one native-currency entry, no category, optional trimmed Note. Zero difference does not write. Integer minor units support negative actual balances.
- `reconcile_account_balance` derives ownership from `auth.uid()`, locks the active Bank/Cash account and checks expected balance/currency. Transaction create/edit/delete and permanent account deletion share the same per-user advisory transaction lock, acquired before account locks. An ordinary edit away from the reconciled account cannot bypass this lock.
- Reconciliation records reject ordinary edits/deletes. Correct errors with a new reconciliation. Legacy non-reconciliation adjustment/refund mutation semantics are not redefined.
- Permanent cleanup checks active ordinary/legacy financial references before any purge. Only explicitly marked, single-account reconciliation records and already-soft-deleted transactions are removable. Other accounts, categories, investments, budgets, goals, and manual FX are untouched.
- Current snapshot refresh reuses the existing helper. Historical snapshots remain historical. Foreign Bank/Cash uses native currency without newly entering base-currency Net Worth.
- Existing expense-only facts and income-only sums exclude adjustments naturally; no Analytics/Budget/Dashboard/AI read formula was changed. Goals' stored allocations do not change; available goal cash follows the corrected underlying balance.
- No RLS/table-write privilege expansion, new dependency, Edge Function change, offline queue, or lifetime browser read.

## Deployment order

Nothing was deployed remotely during implementation.

1. Review and apply `202609130001_add_account_reconciliation.sql` after the existing migrations on the explicitly confirmed project. Use SQL Editor, or after verifying CLI project linkage:

   ```powershell
   npx.cmd supabase db push
   ```

2. Run the rollback-only `ACCOUNT_RECONCILIATION_VERIFICATION.sql` on a disposable/local or staging Supabase database as postgres. Do not use real-user fixtures. It creates two temporary test users in one transaction, exercises browser-role RPC/RLS behaviour, checks spending isolation, and rolls everything back.

   ```powershell
   psql "$env:LEDGERLY_TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/ACCOUNT_RECONCILIATION_VERIFICATION.sql
   ```

3. Regenerate types through the established workflow, inspecting the output before replacing the committed generated artifact. Do not commit CLI diagnostic output as TypeScript. Keep the small RPC adapter for nullable Note arguments and existing exact investment decimals.

   ```powershell
   npx.cmd supabase gen types typescript --linked --schema public | Out-File src/types/database.generated.ts -Encoding utf8
   npm.cmd test
   npm.cmd run lint
   npm.cmd run build
   git diff --check
   ```

4. Commit and deploy the frontend through the existing Vercel workflow. No new environment variables or Edge Function deployment.

## Verification not executable in the implementation environment

Docker's Linux engine was unavailable and no local PostgreSQL client/database was available. The SQL test is supplied but was not executed; static migration checks do not substitute for database execution. Real Safari/PWA device testing was not performed.

## Live/device checklist

Use test accounts first.

1. Open Accounts, tap an active Bank account name, then Reconcile balance. Investments and archived accounts must have no reconciliation entry point.
2. From S$1,000 enter S$950. Confirm a -S$50 preview, optional Note, new S$950 balance, and exactly one signed read-only adjustment in Transactions → All.
3. Confirm expense/income/transfer filters exclude it; ordinary edit/delete controls are absent. Attempt these RPCs directly against the adjustment and confirm rejection.
4. Compare Dashboard monthly income/spent/cash flow, Today’s Spending, seven-day average, Analytics totals/counts/categories, and Budget spend before/after: unchanged. Note suggestions must not include adjustment Notes.
5. Confirm base Net Worth/today's single snapshot falls by S$50. Old daily snapshots remain intact.
6. Reconcile S$950 to S$1,000: +S$50. Enter the same balance: disabled confirmation/no new row. Test a negative actual balance and invalid/excess-precision input.
7. For USD Cash, US$120.40 → US$115.20 creates -US$5.20; native balance changes but base Net Worth stays unchanged under current foreign-account exclusion rules.
8. Leave a reconcile preview open in tab A. In tab B, add/edit/delete an ordinary transaction affecting that account (also test moving a transaction to another account). Confirm in A: conflict, no adjustment, refreshed balance and retained actual input. Review and explicitly submit again.
9. Double-tap confirmation: one adjustment only. Replay the original expected-balance RPC: conflict. A network failure must never queue or replay a write automatically.
10. Offline: submission disabled, form stays available. Reconnect and explicitly review/submit.
11. Try reconciliation as another user, unauthenticated, on Simple/Detailed investment, and on archived Bank/Cash: rejected with no writes.
12. A nonzero reconciled account still cannot archive. Reconcile a test account to zero, archive/restore, and verify history remains.
13. Reconciliation-only test Bank/Cash can be permanently deleted after typing DELETE. Reconciliation entries are purged atomically. A test account with an active expense/income/transfer must reject permanent deletion, preserving both sides of transfers and all unrelated records.
14. At 390/393/430px, check native currency, negative keyboard entry, long account names, dialog scrolling, pending close protection, error text, safe areas, and the refreshed UI.

## Concurrent database sessions

For deterministic concurrency verification, use two SQL sessions with the same test user's JWT subject. In A, begin a transaction, call an ordinary create/edit/delete RPC, and leave it uncommitted. In B, call reconciliation with the old expected balance. It should wait; commit A, then B must reject with SQLSTATE 40001 and no write. Repeat with two identical reconciliations: the second waits, then rejects. Roll back/clean up only the dedicated test fixtures.

## Limitations

- Current balance only; no historical statement reconciliation, automatic imports, or undo.
- Generated schema output must be regenerated after the migration; it is not hand-edited in this change.
- Reconciliation appears read-only in existing All history; no new Add Transaction option/filter.
- Existing snapshot semantics remain unchanged, including historical values and existing incomplete-investment representation rules.

## Changed files

- `supabase/migrations/202609130001_add_account_reconciliation.sql`: marker, authenticated RPC, immutable history, concurrency guards, scoped cleanup.
- `src/features/accounts/account-detail-dialog.tsx`: native-currency detail/reconciliation UI.
- `src/features/accounts/accounts-view.tsx`: account-name detail entry point.
- `src/features/accounts/accounts-service.ts`: offline-safe validated RPC boundary.
- `src/features/accounts/accounts-hooks.ts`: mutation and existing dependent-query invalidation.
- `src/features/accounts/account-lifecycle-actions.tsx`: reconciliation-aware permanent-delete warning.
- `src/features/transactions/transaction-logic.ts`, `transaction-row-content.tsx`: note-first adjustment label/icon and signed amount.
- `src/lib/errors.ts`: safe reconciliation error messages.
- `src/types/database.ts`: pending-migration RPC adapter; generated output unchanged.
- `src/types/rpc-schemas.ts`: optional reconciliation cleanup count.
- `src/features/accounts/account-reconciliation.test.tsx`, `account-reconciliation-migration.test.ts`: UI and static SQL coverage.
- `src/features/accounts/accounts-service.test.ts`, `accounts-view.test.tsx`: RPC/offline and detail entry-point coverage.
- `src/security/release-security.test.ts`: append the expected migration filename.
- `AGENTS.md`, `README.md`: durable invariants and behaviour/deployment notes.
- `supabase/ACCOUNT_RECONCILIATION_VERIFICATION.sql` and this document: rollback-only live tests and manual/deployment checklist.
