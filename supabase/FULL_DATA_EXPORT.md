# Full data export V1

## Inventory (current schema, classified before implementation)

| Source | Classification | Export treatment |
| --- | --- | --- |
| `profiles` | A — authoritative user data | Display name, base currency, timezone, ID and timestamps; no Auth record |
| `accounts` | A | All records including archives, opening balance, Simple/Detailed mode and conversion boundary |
| `categories` | A | Parent/child IDs, type and archive state |
| `transactions` | A | All retained records, including soft deletion, adjustments and reconciliation marker |
| `transaction_entries` | A | All entries of owned transactions, including both transfer legs |
| `investment_valuations` | A | Simple manual native/base valuation history, separate from Detailed ledgers |
| `monthly_budgets` | A | Historical monthly limits and stored currency |
| `category_budgets` | A | Limits and parent budget/category relationships |
| `savings_goals` | A | Targets, dates, notes, archives; completion is derived, not stored |
| `goal_allocations` | A | Signed virtual-allocation history, not financial transactions |
| `manual_fx_rates` | A | Exact direct currency-pair rate history |
| `investment_holdings` | A | Holding metadata, account relationships, archive state |
| `investment_trades` | A | Opening positions, buys/sells, exact quantity/unit price and stored cash/cost/gain effects |
| `investment_prices` | A | Exact manual price history |
| `investment_cash_events` | A | Opening broker cash, dividends and cash adjustments |
| `net_worth_snapshots` | B — derived historical user data | Stored history exactly as recorded; never refreshed or rebuilt |
| `notification_preferences` | C — non-sensitive preference | Stored enabled flag and timestamps; absent row stays absent |
| Current-device last expense account | C | Only the authenticated user's saved ID, revalidated against exported active Bank/Cash accounts; no other browser storage |
| `push_subscriptions` | D — security/operational | Exclude endpoint, p256dh, auth and all rows |
| `notification_deliveries` | D | Exclude scheduler claims/outcomes |
| `ai_rate_limit_config`, `ai_request_usage` | D | Exclude server quotas, usage counters and leases |
| `auth.*`, sessions, browser Auth storage, Vault, Cron, Edge secrets | D | Exclude credentials and infrastructure metadata |
| Dashboard, account summaries, Analytics, budget spending, goal progress, investment totals, frequent categories, note suggestions, AI read models | Derived live read models | Not stored source records; omit recalculated values rather than introducing accounting calculations |
| AI conversation | No persisted record | Page memory only; not included |

No unresolved E (investigate) database table remains. Permanently deleted records and preferences on other devices cannot be recovered by this export.

Baseline: clean working tree; 408 tests / 80 files, lint, build (injectManifest, 86 precache entries) and diff check passed. Docker CLI exists but its engine is unavailable; psql/Deno are not installed.

## V1 package and contract

The filename and root folder are `ledgerly-export-YYYY-MM-DD`, using the UTC date of `exported_at`. The ZIP has 20 files:

```text
ledgerly-export-YYYY-MM-DD/
  README.txt
  manifest.json
  backup.json
  csv/
    profiles.csv
    accounts.csv
    categories.csv
    transactions.csv
    transaction_entries.csv
    monthly_budgets.csv
    category_budgets.csv
    savings_goals.csv
    goal_allocations.csv
    net_worth_snapshots.csv
    notification_preferences.csv
    investments/
      valuations.csv
      holdings.csv
      trades.csv
      cash_events.csv
      prices.csv
      fx_rates.csv
```

`backup.json` is canonical. Its top-level fields are `format: "ledgerly-backup"`, `version: 1`, `exported_at` (UTC ISO timestamp), `app: { name: "Ledgerly" }`, `data`, `record_counts`, and `device_preferences: { last_expense_account_id }`. `data` contains arrays named after the 17 exported tables. The profile array has exactly one row, notification preferences has zero or one row, and every other collection may be empty. Empty collections still receive a CSV header. IDs, relational IDs, nullable fields, stored timestamps, deleted/archive flags and all current domain columns are preserved. No current-balance column or live derived total is added.

The version belongs to this backup format, independently of migration numbers. The explicit version-1 column allowlists live in the migration and `src/features/data-export/export-schema.ts`. Future schema changes must deliberately review the export contract, not automatically serialize newly added fields. This is a foundation for a future restore design, not a guarantee that V1 already has a restore path. A future restore must validate ownership/relationships, reconcile IDs, and preserve accounting invariants before any writes; none of that is implemented here.

`manifest.json` uses `format: "ledgerly-export"`, `version: 1`, a file list (relative to the package root), the same export timestamp and database record counts, `derived_history: ["net_worth_snapshots"]`, numeric encoding and current-device preference scope. Counts refer to database collections; the optional local preference is separate.

## Exact numbers and CSVs

Every BIGINT minor-unit column and PostgreSQL NUMERIC column is explicitly cast to `text` in SQL before JSON construction. JavaScript never receives these values as Number. Runtime validation rejects numeric JSON values. This preserves values beyond JavaScript's safe integer range, all ten quantity/price decimal places and all twelve FX decimal places. No financial arithmetic or FX conversion occurs.

CSV files preserve stored columns and add related readable account/category/goal names where relevant. Money fields include both the exact `*_minor` string and a display value with the `_minor` suffix removed, formed with BigInt and the existing currency minor-unit scale. `currency` identifies native amounts; `base_currency` identifies stored base amounts in Simple valuations and snapshots. Prices/trades retain native currency context through their holding/account. FX uses its explicit source/destination pair. There is no recalculated budget spending or portfolio value.

CSV uses UTF-8 with a BOM, CRLF records, quoted cells, doubled embedded quotes and preserved embedded newlines. Formula-looking user text is prefixed with an apostrophe for spreadsheet safety. The unmodified text remains in `backup.json`. Spreadsheet applications can themselves round long decimal columns; import those columns as text when exact display matters.

## Security, consistency and size

`export_user_data_v1()` has no parameters and derives its caller from `auth.uid()`. It is `STABLE`, `SECURITY DEFINER`, has an empty search path, uses fully qualified tables, and grants execution only to authenticated browser users. No table grants/RLS policies change. Direct `user_id` filters and parent ownership checks cover collections without a user column. SECURITY DEFINER intentionally includes retained soft-deleted records hidden by ordinary UI RLS; it never calls financial mutation or snapshot-refresh helpers. The stable query reads one database snapshot.

The browser validates all keys/row shapes and server record counts before packaging, checks ownership, and rejects session changes during export. ZIP creation is local using **fflate 0.8.3**, a small dependency-free browser-compatible library with asynchronous ZIP support. Only the export response and ZIP are held in memory; they are not put in TanStack Query, browser storage, analytics, AI, Supabase Storage, or service-worker runtime caches. Prepared share files are discarded when the Settings component unmounts or the account changes. Download object URLs are revoked after the browser has consumed them. The ZIP is not encrypted.

There is no row limit. V1 fails the entire request above 32 MiB of server JSON, or the entire package above 64 MiB of uncompressed files, to bound the browser-memory workflow. Server timeouts, network/ZIP errors, missing collections, unexpected fields and count mismatches fail rather than reporting an incomplete backup as successful. The UI displays the requested safe error. Large exports beyond these boundaries need a separately designed streaming export; do not silently truncate them.

## Validation and deployment

Nothing is deployed automatically. Use this order:

1. Confirm the intended Supabase project, project link and migration history. The reminder migration must already exist before the export migration.
2. Apply **only the pending migrations in confirmed order**, including `202609230001_add_full_data_export.sql`. Do not assume `db push` is safe without that review.
3. On a disposable local/staging Supabase database, run `psql "$env:LEDGERLY_TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/FULL_DATA_EXPORT_VERIFICATION.sql`. The script creates two domain fixtures, tests anonymous/missing-identity rejection and cross-user isolation as the real browser role, compares all counts and numeric strings, checks excluded secrets, and fingerprints tables before/after to detect writes. It always rolls back; it does not disable triggers.
4. Regenerate types with `npm.cmd run db:types -- --project-ref YOUR_CONFIRMED_PROJECT_REF`. Generated definitions are intentionally not hand-edited; the application adapter declares the pending RPC.
5. Run `npm.cmd test`, `npm.cmd run lint`, `npm.cmd run build`, and `git diff --check`.
6. Deploy the frontend through the existing Vercel workflow. No new environment variable, Edge Function, Storage bucket, Cron job, or secret is required.
7. Perform the desktop and real installed-iPhone checks below. Docker's engine was unavailable during implementation, so the SQL script and hosted RPC behavior remain unexecuted until this step is carried out.

## Manual desktop and installed-iPhone checks

1. Open **Settings > Data & Privacy**; confirm the privacy warning is visible before tapping **Export Ledgerly data**.
2. Confirm one request is made, the button is disabled during preparation and a safe error appears when offline.
3. Desktop: confirm `ledgerly-export-YYYY-MM-DD.zip` downloads and unzips into the documented folder with 20 files. Confirm manifest counts match JSON collections and CSV records (use a CSV parser, not newline counts).
4. Installed iPhone PWA: update/reopen Ledgerly, prepare the file, then tap **Share / Save to Files**. Verify Save to Files works and the resulting ZIP opens. Sharing uses `navigator.canShare({ files })`, touch/standalone feature detection and a fresh user click; no user-agent sniffing. If ZIP sharing is unsupported, verify the normal download fallback. Cancel sharing and retry; test the explicit Download ZIP fallback too.
5. Verify archived accounts, category parents, both transfer entries, deleted transactions, reconciliation adjustments, budget limits, signed goal history, snapshots and separate Simple/Detailed investment data against known records. Check long minor-unit values and high-precision decimal strings in a text editor.
6. Export as another user; verify no record from the first user appears. Sign out/switch accounts during preparation; no old-user download or Share action should appear.
7. Confirm balances, snapshots, budgets, goals, reconciliation and reminder scheduling are unchanged. The existing static-shell PWA cache rules are untouched.

References: [fflate ZIP API](https://github.com/101arrowz/fflate/blob/master/docs/functions/zip.md), [Web Share requirements](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/share).

## Automated results

The implementation added 31 tests: final suite 439 tests across 85 files. Coverage includes the schema allowlist/ownership boundary, exact numeric serialization, retained financial relationships, archive/deletion/reconciliation state, CSV quoting/formula safety, ZIP extraction and manifest consistency, session switching, offline failure, single in-flight export, download cleanup, sharing and safe error paths. SQL security and side-effect assertions are in the rollback script and still require execution against Supabase.

The dependency installation changed only `fflate` in the lockfile. `npm audit` reports four existing transitive advisories (fast-uri, hono, js-yaml and qs: two high, two moderate), none attributed to fflate. No unrelated dependency upgrade was performed.
