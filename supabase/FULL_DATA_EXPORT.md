# Full data export

Settings → Data & Privacy prepares a local, **unencrypted** ZIP. Treat it as sensitive financial data. Ledgerly has no import/restore feature; permanently deleted records and other devices' preferences cannot be recovered.

## Backup contract

The filename/root is `ledgerly-export-YYYY-MM-DD`, using the UTC export date. Each ZIP contains 20 files:

- `README.txt`, `manifest.json`, `backup.json`.
- Under `csv/`: profiles, accounts, categories, transactions, transaction_entries, monthly_budgets, category_budgets, savings_goals, goal_allocations, net_worth_snapshots and notification_preferences CSVs.
- Under `csv/investments/`: valuations, holdings, trades, cash_events, prices and fx_rates CSVs.

`backup.json` is canonical: `format: "ledgerly-backup"`, `version: 1`, UTC `exported_at`, `app: { name: "Ledgerly" }`, `data`, `record_counts`, and `device_preferences: { last_expense_account_id }`. Its 17 table arrays preserve stored IDs/relationships, fields, timestamps, archives and soft deletions. Profiles has exactly one row; notification preferences has zero or one. Empty collections still receive CSV headers.

Included investment tables are `investment_valuations`, `investment_holdings`, `investment_trades`, `investment_cash_events`, `investment_prices` and `manual_fx_rates`. Simple valuations remain separate from Detailed ledgers. Snapshot history is exported as stored, not rebuilt.

`manifest.json` uses `format: "ledgerly-export"`, `version: 1`, export timestamp, relative file list, database counts, numeric encoding, device-preference scope and `derived_history: ["net_worth_snapshots"]`. Format version is independent of migration numbers. Review schema changes against explicit SQL/`export-schema.ts` allowlists.

Excluded: Auth/session/browser credential storage, push subscriptions/keys, delivery claims, AI quotas/leases/conversation, Vault/Cron/Edge secrets and recalculated read-model totals. Only this user's current-device remembered expense-account ID is considered, revalidated against active owned Bank/Cash accounts.

## Exact data and CSV safety

SQL casts BIGINT minor units and NUMERIC to text before JSON. Runtime validation rejects Number values, preserving large integers, ten-place quantities/prices and twelve-place FX. No financial arithmetic/FX conversion occurs during export.

CSVs add relevant readable labels and exact minor-unit/display strings using BigInt and currency scales. They use UTF-8 BOM, CRLF, quoted cells, escaped quotes and embedded newlines. Formula-looking user text receives an apostrophe; original text remains in JSON. Import long numeric columns as text because spreadsheets may round them.

## Privacy and limits

`export_user_data_v1()` derives identity from `auth.uid()`, accepts no user parameter and is authenticated-only. Its stable SECURITY DEFINER query uses an empty search path and explicit ownership filters; it includes retained soft-deleted history without mutating finances/snapshots.

The browser validates schema/counts/ownership and rejects session changes. JSON/ZIP remain in memory: no upload, AI transmission, query cache, browser storage or private service-worker cache. Prepared files disappear on Settings unmount/user change; download URLs are revoked.

Requests fail above **32 MiB JSON** or **64 MiB uncompressed package**. Missing/unexpected fields, count mismatches and preparation errors fail the entire backup rather than silently truncating it. Larger datasets require a separate streaming design.

## Deployment and verification

Apply only reviewed pending migrations to the confirmed project, then deploy the frontend; no extra secret, function, storage bucket or Cron is needed. Follow [setup/type/check instructions](../docs/development.md).

Run [rollback-only export SQL](FULL_DATA_EXPORT_VERIFICATION.sql) in disposable/staging Supabase. It checks real authenticated/anonymous boundaries, two-user isolation, counts, exact strings, excluded secrets and no writes. Read it first and explicitly roll back the session if interrupted; automated fixtures do not prove hosted behavior.

On desktop and installed iPhone:

1. Prepare an export once; check privacy warning, pending state, offline error and safe cancellation.
2. Download/unzip; confirm 20 files and matching JSON/manifest/CSV counts using a CSV parser. Compare known archived/deleted/transfer/reconciliation and Simple/Detailed records; inspect exact strings in a text editor.
3. Test Share / Save to Files and explicit Download fallback. Cancel sharing and retry; no upload should occur. Include an entry >160000 bytes to exercise fflate's Blob worker under the [report-only CSP](../docs/development.md#vercel-headers-and-pwa).
4. Switch users during preparation; old-user download/share must disappear. Export as User B and confirm no User A records.
5. Confirm balances, snapshots, budgets/goals and reminder scheduling remain unchanged.

Automated export tests cover parsing, ownership, exact numbers, formula-safe CSV, ZIP/manifest consistency, preparation/session behavior, download and sharing. Real Supabase and installed-device checks remain separate.
