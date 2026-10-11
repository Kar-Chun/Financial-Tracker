# Setup and deployment

Ledgerly is a Vite SPA backed by Supabase Auth/Postgres and Edge Functions, with Vercel hosting. Use Node 20.19+ in the 20.x series or Node 22.12+.

## Local setup

1. Run `npm ci`, then copy `.env.example` to `.env.local`.
2. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` for the intended project. Add `VITE_WEB_PUSH_VAPID_PUBLIC_KEY` only for notifications.
3. Configure the database and Auth URLs below; start `npm run dev`.

Only public configuration belongs in `VITE_` variables. Gemini/VAPID private keys, scheduler secrets and service-role credentials stay server-side. Local environment files are ignored. On PowerShell, use `npm.cmd`/`npx.cmd` if script execution policy blocks their wrappers.

## Database and types

Confirm the project and pending migration list before applying changes:

```bash
npx supabase@2.117.0 login
npx supabase@2.117.0 link --project-ref YOUR_CONFIRMED_PROJECT_REF
npx supabase@2.117.0 migration list
npx supabase@2.117.0 db push
npm run db:types -- --project-ref YOUR_CONFIRMED_PROJECT_REF
```

Apply pending files in `supabase/migrations` in filename order; never edit/reapply deployed migrations. SQL Editor is an alternative. Review the list before `db push`; project linkage alone is not authorization to update production.

Type generation requires the reference to match `supabase/.temp/project-ref`, validates temporary output and replaces `src/types/database.generated.ts` only on success. Review its diff; keep exact decimal/RPC adaptations in `src/types/database.ts`.

Before first applying `202609260001_harden_financial_input_boundaries.sql`, an authorized administrator should run this read-only historical-data preflight:

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

Review nonzero results with the owner before rollout: eligible-spending reads exclude those invalid investment-account expenses after migration. Preserve historical records; this preflight does not repair them.

## Auth and optional services

In Supabase **Authentication → URL Configuration**, set the exact HTTPS production Site URL and allow its `/login` URL. Allow exact local/preview origins you use, normally `http://localhost:5173/login`; `127.0.0.1` is a different origin.

Signup uses the active origin plus `/login`. Keep Supabase's implicit flow and the email template's `{{ .ConfirmationURL }}`; do not substitute a PKCE/token-hash callback. After configuration changes, request a fresh email and verify confirmation establishes the session, removes URL credentials and opens Dashboard. Never share token-bearing links.

The optional read-only Assistant requires current AI migrations, server-only `GEMINI_API_KEY`/`GEMINI_MODEL`, and its Edge Function:

```bash
npx supabase@2.117.0 secrets set GEMINI_API_KEY=YOUR_GEMINI_KEY GEMINI_MODEL=YOUR_SUPPORTED_MODEL --project-ref YOUR_CONFIRMED_PROJECT_REF
npx supabase@2.117.0 functions deploy financial-assistant --project-ref YOUR_CONFIRMED_PROJECT_REF
```

Keep its gateway JWT verification enabled. Test configured quotas, one-active-request protection, timeout and auth rejection in staging. Logs may contain generated request ID, fixed category/provider and HTTP metadata, never provider text/prompts/financial context/tokens.

Follow the [reminder guide](../supabase/DAILY_TRANSACTION_REMINDER.md) for VAPID/Vault/Cron setup and the [export guide](../supabase/FULL_DATA_EXPORT.md) for the local ZIP contract. Neither public browser key is a secret.

## Vercel, headers and PWA

Use install `npm ci`, build `npm run build`, output `dist`; configure public frontend variables. Apply pending migrations/deploy affected functions before dependent frontend code.

`vercel.json` preserves SPA deep links and defines nosniff, conservative referrers, framing denial and unused-capability restrictions while retaining Web Share. CSP is **report-only**. Its exact Supabase HTTPS origin must match `VITE_SUPABASE_URL`; JSON does not interpolate environment variables. Local fonts/assets need only self; no app Realtime connection is used. Existing React/charts require inline styles, and fflate's large ZIP entries require `worker-src 'self' blob:`. Scripts allow neither inline code nor eval. Do not add broad wildcard/Blob sources.

Before enforcing CSP, check browser-console violations through login/signup/refresh, core routes/charts, Assistant, PWA install/update/push clicks and desktop/iPhone export; include a ZIP entry >160000 bytes to exercise Blob workers. Vite dev/preview does not apply Vercel headers automatically.

Production TLS/headers/HSTS remain hosted checks. Replace the example domain; never use `--insecure`:

```powershell
curl.exe -sS -L -o NUL -D - http://ledgerly.example.com/
curl.exe -sS -o NUL -D - https://ledgerly.example.com/dashboard
curl.exe -sS -o NUL -D - https://ledgerly.example.com/service-worker.js
curl.exe -sS -o NUL -D - https://ledgerly.example.com/manifest.webmanifest
curl.exe -vI https://ledgerly.example.com/
```

Use `curl`/`/dev/null` on macOS/Linux. Verify certificate hostname/chain/expiry, HTTP→HTTPS, asset MIME types and final CSP-Report-Only, nosniff, referrer/framing/permissions headers. Check hosting-provided enforced CSP/HSTS too; no repository HSTS preload/subdomain commitment is added. Inspect fresh network responses because cached PWA HTML may retain old headers.

The service worker caches static assets only. Installed apps may need close/reopen after updates; a build cannot verify real iPhone launch, push or Save to Files.

## Verification

```bash
npm test
npm run lint
npm run build
git diff --check
```

Database tests use disposable migrated Supabase data, not production. Read scripts first; they may take locks despite rollback. Run with `psql "$env:LEDGERLY_TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f PATH` and explicitly roll back a session if execution aborts.

- [Financial boundaries](../supabase/FINANCIAL_BOUNDARIES_VERIFICATION.sql): ordinary account types, exact investment inputs, rejected-write atomicity and financial invariants.
- [Reconciliation](../supabase/ACCOUNT_RECONCILIATION_VERIFICATION.sql): reviewed-balance locking, adjustments, spending isolation and lifecycle behavior.
- [Reminders](../supabase/DAILY_TRANSACTION_REMINDER_VERIFICATION.sql) and [export](../supabase/FULL_DATA_EXPORT_VERIFICATION.sql): ownership and feature boundaries.
- [Push concurrency](../supabase/PUSH_SUBSCRIPTION_CONCURRENCY_VERIFICATION.sql): follow labeled blocks in **two connections**, not one whole-file execution.

For isolation, use two ordinary users/JWT-backed sessions. Elevated SQL Editor or service-role reads do not prove RLS. Verify no foreign rows, rejected foreign-ID RPCs, and denied direct sensitive-ledger writes. Then check offline Save→error→reconnect produces no write, explicit valid saves refresh dependent totals, transfers/goal allocations remain neutral, reconciliation excludes spending, and user switching removes old content. Finally exercise installed-iPhone layout/keyboard, PWA updates, deep links, notifications and export. Mocks/static SQL checks do not establish deployed database, provider or device behavior.
