# V3.0 release-candidate audit

Audit date: 24 August 2026

## Executive status

**READY WITH MANUAL CHECKS**

The repository passes its automated frontend, deterministic finance, static database-security, PWA, build, and dependency checks. The audit fixed all confirmed High/Medium application findings. Release still requires applying the new abuse-protection migration, redeploying the Edge Function, and running live two-user/RLS, migration-replay, Supabase Advisor, provider-rate-limit, and iPhone checks against the confirmed project. Those environment-dependent checks were not represented as passed.

Baseline: **34 test files / 131 tests passed**. Final: **37 test files / 148 tests passed**.

## Findings and fixes

| Severity | Area | Problem and impact | Fix | Regression evidence |
| --- | --- | --- | --- | --- |
| High | AI quota abuse | Every authenticated request could reach the shared Gemini key. Parallel tabs/direct calls could consume the project quota. | Added an atomic database limiter with 6/minute, 30/hour, 100/rolling-24-hours per user, 500/rolling-24-hours globally, and one active request per user. A 60-second lease prevents permanent lockout after a crash. Denied requests return 429 before Gemini. | `assistant-request-security.test.ts`; `release-security.test.ts`; migration review. Live concurrency remains a manual check. |
| Medium | Session privacy | Most TanStack Query keys were not user-scoped, and the global cache was not cleared on logout or a direct User A → User B session change. Cached User A data could remain in memory or briefly render. | Auth session changes now clear the complete QueryClient cache whenever the authenticated user ID changes or becomes null. Initial restoration does not cause a redundant clear. | `authenticated-user cache isolation` regression test; production TypeScript build. |
| Medium | AI input abuse | Message length was bounded, but the total HTTP body was not. A direct caller could submit an oversized history/body. | Added a streaming 16 KiB byte cap, maximum six history messages, 2,000 characters per question/history item, strict roles/workflow, and 400/413 responses before lease/provider use. | `AI request boundary` tests include multibyte/streamed overflow and malformed JSON. |
| Medium | AI operational timeout | Gemini calls had a 15-second timeout, but total multi-round orchestration and a stalled finance RPC were not hard-bounded. | Added a 45-second orchestration deadline, propagated cancellation to Gemini, stopped post-timeout tool progression, retained three tool rounds/six calls/900 output tokens, and added no retries. | Stalled-tool deadline and provider abort tests. |
| Low | Rate-limit UX | Provider quota errors were generic, with no distinct safe local/global limiter messages. | Added structured 429 handling and concise messages without counts, other-user usage, or key details. | `assistant-service.test.ts`. |
| Informational | Secret scanning | A synthetic Gemini-looking string in a sanitizer test triggered credential scanners. It was not a real key. | Constructed the synthetic value at runtime so current source/build scans are clean. Historical scan still identifies that known test path; no real secret was found. | Current tracked/build pattern scan. |

No Critical finding was identified.

## Financial correctness audit

The existing accounting implementation and regression suite preserve these definitions:

| Operation | Verified result |
| --- | --- |
| Expense | One negative entry; bank/cash and net worth decrease; eligible expense/Analytics/Budget totals increase. |
| Income | One positive entry; account/net worth and income increase; Budget spending is unchanged. |
| Transfer | Two atomic opposite entries; account allocation changes; net worth, income, expenses, cash flow, Analytics, and Budget remain unchanged. |
| Goal allocation | Signed goal-planning row only; no transaction/entry/snapshot; all real financial metrics remain unchanged. |
| Detailed buy/sell | Serialized account/holding ledger operation using PostgreSQL `NUMERIC`; buys consume broker cash, sells reject oversells, and neither becomes ordinary expense/income. |
| Price/FX | Manual valuation data only; relevant represented value/snapshot may change without creating an ordinary transaction. |

Evidence includes transaction sign/transfer tests, Analytics eligibility tests, Budget definition/pace tests, Goals isolation tests, Simple/Detailed investment formula and weighted-basis tests, currency exactness tests, snapshot tests, and static migration tests. The SQL lifecycle was code-reviewed for create/edit/soft-delete refreshes and one-row-per-local-day snapshot upserts. A live end-to-end Supabase exercise remains required.

## Database, RLS, and ownership audit

- All 18 public user/financial/operational tables enable RLS in the cumulative migration chain.
- Browser access to transaction entries, goal allocations, trades, investment cash events, prices, and manual FX is select-only; writes use validated RPCs.
- All 44 `SECURITY DEFINER` occurrences use `set search_path = ''`; referenced relations/functions are schema-qualified and no dynamic SQL was found.
- Authenticated RPCs derive ownership from `auth.uid()`. Internal functions that accept a user ID are revoked from browser roles and are called only by trusted triggers/RPCs.
- Transaction edits lock the transaction and relevant accounts; goal allocations lock the goal; Detailed buys/sells lock the account and holding; budget/price/FX upserts use uniqueness/conflict semantics.
- AI reads use a publishable Supabase client carrying the caller's JWT. No service-role client or arbitrary RPC/table/function selector exists.
- The new limiter tables expose no browser table privileges. Claim/completion RPCs derive `auth.uid()`, and an advisory transaction lock makes count-and-claim atomic.

Live User A/User B attempts, direct PostgREST writes, and Supabase Security Advisor output could not be run without a safely linked project. Follow the manual release gate below.

## AI security and privacy audit

- Hardcoded allowlist: nine read-only/deterministic tools; unknown tools fail before execution; no financial mutation tool exists.
- Limits: three tool rounds, six total calls, transaction/tool arrays capped at 20, 900 provider output tokens, 6,000-character returned answer, low temperature, 15-second provider timeout, 45-second total timeout, and no retries/background calls.
- Gemini is invoked only from the explicit Assistant send/monthly-review flow. Dashboard and normal finance mutations do not import/call the provider.
- Stored Notes/names remain structured untrusted tool data, never system instructions. The provider receives no environment, JWT, API key value, request headers, arbitrary SQL, or unrestricted URL/RPC selector.
- Output is rendered as plain React text with whitespace preservation; no raw HTML/Markdown renderer, `dangerouslySetInnerHTML`, `eval`, or `new Function` was found. Suggested routes use a strict allowlist.
- Provider logs contain request ID, category, safe status/code/message/model only. Prompts, answers, financial results, Notes, JWTs, and tool payloads are not logged.
- Limiter storage contains only user ID, timestamps, status, optional model, and lease metadata. It stores no chat/financial content.
- Invalid/missing JWT returns 401 before request validation, limiter claim, or Gemini construction/use. Invalid/oversized schema is rejected before the provider-attempt stage; an allowed lease counts once even when the provider later fails.

## Secrets, frontend, PWA, and storage

- `.env.local` is ignored and untracked; only `.env.example` is tracked.
- Current tracked-source and `dist/` scans found no credential-shaped Gemini, Supabase secret, JWT, or bearer value. `GEMINI_API_KEY` exists only as a server-side Edge secret lookup/documentation placeholder and does not appear in `dist/`.
- Git-history pattern scanning identified only the known synthetic sanitizer fixture path; no real credential was identified. If an independent secret scanner ever identifies an actual historical credential, rotate it rather than only deleting it.
- Workbox precaches static HTML/JS/CSS/fonts/icons and uses an SPA navigation fallback. `runtimeCaching` is empty: Supabase/Auth/financial/AI responses and access tokens are not persisted by the service worker.
- No AI conversation/answer or financial summary is written to local/session storage. The only custom local preference is the authenticated-user-scoped remembered expense account ID, revalidated against RLS-filtered active accounts.
- User-switch cache isolation is now enforced at the Auth provider.

## Dependency and build hygiene

- `npm audit`: **0 vulnerabilities** across the audited dependency tree.
- `npm outdated`: routine updates are available for React Query, React DOM types, React Hook Form, and shadcn; major-only updates exist for Node types and TypeScript. No upgrades were made during this audit.
- Production build emitted `dist/`, manifest, register script, generated service worker, Workbox runtime, and 81 static precache entries.
- No database schema/accounting model or normal application feature was redesigned.

## Verification classification

Automatically verified:

- 148 Vitest tests, lint, strict TypeScript/Vite/PWA build, `git diff --check` (final command evidence is recorded at handoff).
- Provider request/response transforms, prompt-injection architecture, tool allowlist, malformed/unknown tools, offline AI refusal, request caps, rate-limit response parsing, timeout behavior, auth-cache decision, migration ordering/security posture, finance calculations, routes/components covered by the existing suite, and PWA manifest.
- Current source/build secret patterns, `.env.local` ignore/tracking state, risky frontend constructs, PWA runtime-cache configuration, dependency audit/outdated review.

Code-reviewed:

- Complete migration order, RLS/policies/grants, RPC ownership joins, direct-write posture, financial lifecycle/snapshots, budget/Analytics equivalence, Goal isolation, Simple/Detailed exclusivity, investment row locking/cost basis, AI JWT data path, logs, and browser storage.

Not testable in this environment:

- Empty-database migration replay (Supabase CLI absent; Docker daemon unavailable).
- Live two-user RLS/direct-write/RPC spoofing and concurrent database calls.
- Supabase Database Linter/Security Advisor.
- Real Gemini quota/429/provider behavior (automated tests intentionally mock the provider).
- Visual/mobile/PWA standalone/iPhone checks (no controllable browser was available).

## Required release gate

1. Confirm the intended Supabase project, then apply migration `202608240006_add_ai_abuse_protection.sql` before deploying the updated function:

   ```bash
   npx supabase@latest login
   npx supabase@latest link --project-ref YOUR_CONFIRMED_PROJECT_REF
   npx supabase@latest db push
   npx supabase@latest functions deploy financial-assistant
   ```

   Alternatively run migration 006 once in Supabase SQL Editor, then deploy with `npx supabase@latest functions deploy financial-assistant --project-ref YOUR_CONFIRMED_PROJECT_REF`. Do not reset or re-enter the Gemini secret.

2. In Supabase SQL Editor as an administrator, confirm the private configuration row is `(6, 30, 100, 500, 60)`. Change it only server-side if the school quota requires a lower project allowance.
3. Run all existing RLS verification documents plus these additions with User A/User B:
   - User B cannot select either user's private limiter rows or call any finance RPC with User A account/category/budget/goal/holding IDs.
   - Direct insert/update/delete on sensitive ledgers and limiter tables is denied.
   - Six allowed Assistant calls in a rolling minute are followed by HTTP 429; a parallel second call is denied/busy; a different user remains independently limited; the configured global threshold prevents Gemini calls.
   - No/expired JWT returns 401 and malformed/over-16-KiB input returns 400/413 without a usage row/provider attempt.
4. Use Supabase Dashboard > Database > Advisors and classify any Database Linter/Security Advisor warning before release.
5. Exercise expense/income/transfer/edit/delete, Budget/Goal isolation, Simple/Detailed investment buy/sell/price/FX, snapshots, fresh-user empty states, and old records with missing Notes/archived categories.
6. On iPhone Safari and installed PWA, verify 390×844 and 430×932 layouts, date/keyboard/save controls, safe areas/FAB/navigation, long values/Notes, `/assistant`, offline refusal, logout, and User A → User B isolation. After logout, going offline must not expose User A finance or AI data.

Do not deploy Vercel merely for this audit. The frontend cache fix requires the normal next frontend release; migration 006 and the Edge Function require the explicit Supabase steps above.
