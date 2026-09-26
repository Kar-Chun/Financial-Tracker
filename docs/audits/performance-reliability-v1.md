# Ledgerly Performance & Reliability V1

## Scope and evidence

Five improvements only: targeted freshness, bounded read retries, cached-content retention on high-frequency screens, safe development diagnostics, and identity-keyed content to close a reproduced user-switch observer isolation gap. No financial SQL, arithmetic, dependencies, route topology, notification/export behavior, or service-worker strategy changed. No prefetching added.

Read AGENTS.md and README.md before edits. The initial working tree was clean. No reset, restore, clean, stash, migration, deployment, or live financial mutation was performed.

An authenticated browser profiler and installed iPhone session were not available. Request counts below are **static cold-route request budgets**, not measured production network traces. They exclude Auth SDK traffic, assets, retries, and user actions. Query lifecycle behavior is verified with real TanStack Query observers and mocked reads. No production latency, SQL execution time, or payload byte savings are claimed.

## Baseline

- `npm test`: 85 files, **439 tests passed** (69.31 s in this local run).
- `npm run lint`: passed.
- `npm run build`: passed, including injectManifest.
- `git diff --check`: passed.
- Used `npm.cmd` for all scripts because PowerShell execution policy blocks `npm.ps1`.
- Entry chunk: **297.10 kB / 96.06 kB gzip**.
- Entry plus all JS modulepreloads named in index.html: **769,665 bytes / 235,771 gzip bytes**, 14 files. This is the initial static JS set, not just the entry chunk; route downloads add to it.
- CSS: **91.56 kB / 15.98 kB gzip**.
- PWA: **86 precache entries, 1698.44 KiB**; generated worker before manifest injection: 17.25 kB / 5.85 kB gzip.

Baseline major lazy chunks (decimal kB, raw / gzip; shared dependencies are additional):

| Chunk | Size |
| --- | ---: |
| Dashboard | 29.67 / 9.74 |
| Transactions | 9.05 / 3.32 |
| Accounts | 13.64 / 4.43 |
| Analytics | 57.66 / 16.96 |
| Budgets | 15.94 / 4.86 |
| Goals | 6.42 / 2.23 |
| Investments | 6.63 / 2.37 |
| Investment account | 22.86 / 6.44 |
| Detailed setup | 7.26 / 2.78 |
| Holding detail | 3.49 / 1.47 |
| Assistant | 8.52 / 3.45 |
| Settings (includes export implementation) | 44.80 / 15.90 |
| Shared CartesianChart/Recharts | 330.65 / 96.82 |

Every page already uses React Router `lazy`. Recharts is shared by Dashboard/Analytics, outside the initial HTML preload set. Investments and Assistant are already lazy. Settings contains export/ZIP code but does not fetch an export on mount. Additional splitting was not selected: there is no demonstrated initial-route saving from redoing existing lazy boundaries.

## Why error states occur

Confirmed code-level contributors, distinct from an unproven production trigger:

1. Many pages branch on `isError` without considering `data`. TanStack Query preserves prior data when a refetch fails; these pages discarded that usable presentation and showed a full error anyway. This can also hide already-loaded transaction pages when a next-page read fails.
2. Detailed Investment Account redirected to the portfolio on any query error, including a transient refresh failure with loaded data.
3. Query retry inherited the browser default: three retries, with 1/2/4-second backoff. These were **not immediate retries**. A permanent error could incur four requests plus seven seconds of backoff, in addition to request durations.
4. Dashboard and budget summaries became stale after 15 seconds. A short visit to another page could cause both to refetch. Profile used the 30-second financial default, so mounting a new profile consumer after 30 seconds fetched unchanged preferences again.
5. Several initial error screens lacked a functional retry action. Budget's existing retry only refetches its summary even if profile/categories failed (not expanded in V1).

Actual iPhone failure category remains unconfirmed. Supabase transport/server errors and runtime response-validation errors both reach these UI branches. The route boundary instead catches render/lazy-import errors; ordinary query failures are not thrown into it. The old boundary did not distinguish a missing JS chunk from a component error.

No session-readiness race was found: ProtectedRoute blocks children while AuthProvider initializes and redirects signed-out users. Profile/transactions additionally have user-dependent enabling; Analytics/budgets wait for the profile-derived range/month. However, the new rendered-data test reproduced a different isolation gap: clearing QueryClient before publishing a changed session did not remove an old QueryObserver result from a mounted component that did not consume AuthContext. The fifth selected fix keys the provider's content by user ID, remounting consumers and clearing local view/form state on identity changes, alongside the existing synchronous cache clear. Same-user token refresh keeps both content and cache. Tests cover readiness, displayed-data isolation, and old in-flight completion after clearing.

Cancellation is not a confirmed cause: these query functions do not consume TanStack's abort signal. Unmount generally leaves a read available to finish and populate memory; QueryClient clear cancels its query result on user changes. Request cancellation wiring was not added.

## Error-state map (baseline and V1 handling)

For normal queries, automatic retry was the inherited three retries before this work; V1 uses the policy below. Cached data can coexist with `isError`. Manual retry bypasses freshness and requests new data.

| Page/component | Source | Baseline error trigger / cached data | Manual retry and V1 behavior |
| --- | --- | --- | --- |
| Global RouteErrorPage | Lazy import or render error | Router error boundary; independent of query cache | Reload page / return home, unchanged. New safe route failure classification. |
| Dashboard | `get_dashboard_data`, profile table | Either `isError`, or missing dashboard; could have cached data | Previously no button. Now retry both reads; keep content for recognized transient background errors. |
| Dashboard budget card | `get_monthly_budget_summary` | Any budget error hides optional card, even with cache | Existing hiding retained; no full Dashboard error from this optional read. |
| Transactions | `get_transactions_page`, `get_account_summaries`, categories table | Any dependency `isError`; includes next-page errors with existing rows | Now keep same-filter data for transient failures and offer retry. Initial full error also has retry. No previous-filter placeholder. |
| Add Transaction | accounts, categories, profile | Any dependency `isError`; frequent-category failure instead falls back | Conservative form error behavior retained; no automatic mutation replay added. |
| Accounts | active summaries; archived accounts table | Active `isError` replaces list; archive `isError` hides archived rows | Active initial retry retained. Transient cached lists stay visible with one notice/retry. Permanent errors still block affected list. |
| Bank/Cash Account Detail | Parent account row; reconciliation subscribes to summaries | No separate detail read; failed explicit reconciliation refresh sets `needsRefresh` | Parent cache retention keeps the dialog available. Reconciliation must still successfully reread before updating reviewed balance. |
| Analytics | profile, `get_spending_analytics` | Either `isError` or no analytics data; cached charts could exist | Added retry; keep same-range cached charts only on transient error. Missing profile cannot label amounts with a guessed currency. |
| Budgets | profile, monthly summary, categories | Any `isError` or missing required data | Existing summary-only retry/full error retained. Shares the new read retry policy. |
| Goals list | `get_savings_goals_summary` | `isError` or missing data | Existing refetch/full error retained. |
| Goal detail | `get_savings_goal_detail`, profile | Error/missing goal or profile | Existing unavailable/back link retained. |
| Investments list | `get_investment_portfolio_summary` | `isError` or missing data | Existing retry/full error retained. |
| Detailed Investment Account | `get_detailed_investment_account`, profile | Query error/missing account redirected away | Now initial error offers retry in place; transient cached data remains with notice. Auth/validation errors do not get this fallback. |
| Holding detail | Same account query | Missing account/holding redirects; existing data already survives query errors | Existing behavior retained; shares account cache. |
| Detailed setup | Active accounts, profile; explicit conversion preview | Missing/non-investment account redirects; invalid preview/action errors stay in form | Existing behavior retained; preview/write mutation retries remain off. |
| Settings profile | Profile table | Profile `isError`, even if cached | Existing form error retained; longer stable cache and new read retry policy apply. |
| Category management | Categories table | Categories `isError`, even if cached | Existing local error retained. |
| Notification settings | `get_notification_settings` | Preference `isError` shows local load failure; setup/save errors use safe messages | Existing behavior retained. |
| Data export | Explicit `export_user_data_v1` action | Preparation, validation, ownership/session, ZIP or save failure | Local status, explicitly initiated retry only; no query-cache/mutation replay change. |
| Assistant | Explicit Edge Function request | Auth/rate-limit/provider/network/validation failures | Local conversation error, explicit user action; not a navigation query. |
| Mutation forms / logout | Validated feature RPCs; Auth sign-out | Mutation rejection | Existing friendly inline/toast fallback, no automatic retry. `lib/errors.ts` and RPC validation contain additional “try again” wording, not independent full-page states. |

Cached fallback is limited to recognized transient errors. Authorization, unexpected RPC responses, SQL errors, and unknown errors remain blocking on the updated screens. Existing account lifecycle/reconciliation checks and server-side validation remain authoritative. No cached data is supplied as a successful new fetch; the notice explicitly says it is the latest *loaded* data.

## Query and request audit by core route

Global baseline: `staleTime=30s`, `gcTime=5m` (browser default), `refetchOnMount=true` for stale data, `refetchOnWindowFocus=false`, `refetchOnReconnect=true` for stale data, three read retries / exponential 1/2/4s delays. No core query uses previous/placeholder data or polling. V1 keeps mount/focus/reconnect/GC behavior; changes only the entries specified below and read retries.

Cold request totals include the shell's one deduplicated profile table read. Mounted UserMenu/page/profile consumers use the same key; they are not one request per component. Totals assume online, healthy requests and empty memory cache.

| Route | Query keys → service | Cold requests | Freshness baseline → V1 | Reuse, waterfalls, invalidation |
| --- | --- | ---: | --- | --- |
| Dashboard | `[dashboard]` → `get_dashboard_data`; `[profile,user]`; `[budgets,month]` → `get_monthly_budget_summary` | 3 | Dashboard/budget 15→30s; profile 30s→5m | Dashboard/profile concurrent; budget waits for profile timezone. Same budget key as Budgets. Transaction/account/investment/category/budget/reset mutations already invalidate affected data. |
| Transactions | `[transactions,list,user,filters,40]` → `get_transactions_page`; `[accounts,summaries]`; `[categories]`; shell profile | 4 | Financial 30s unchanged; categories 5m unchanged | Three page reads concurrent. Each extra page is one RPC; refresh can sequentially reread all loaded pages to keep cursors coherent. Transaction/account/category invalidation retained. |
| Analytics | `[analytics,preset,range]` → `get_spending_analytics`; profile | 2 | Analytics 30s unchanged | Profile-derived dates are a necessary cold waterfall. No separate category or account request. Finance/category mutations invalidate. |
| Accounts | `[accounts,summaries]` → `get_account_summaries`; `[accounts,archived]` → accounts table; profile | 3 | Summaries 30s unchanged; archived 30s→5m | Concurrent; archived data is displayed, not an unused request. Account mutation invalidates both lists plus dependents. Transaction mutations invalidate `[accounts]`. |
| Account Detail | Parent summaries; reconciliation shares `[accounts,summaries]` | 0 additional to open dialog | 30s unchanged | Entering reconciliation may refetch if stale; explicit refresh must read server. No per-account N+1 call. |
| Budgets | `[budgets,month]`, profile, categories | 3 | Summary 15→30s | Profile determines month; categories concurrent. Dashboard→Budgets can reuse current month. Budget/transaction/account/category invalidation retained. |
| Goals | `[goals,summary,true]` → `get_savings_goals_summary`; shell profile | 2 | Summary 15s unchanged | No independent balance read; RPC returns available cash. Goal detail uses `[goals,detail,id]` (30s), with profile: 2 cold reads. Goal mutations invalidate only goals; financial mutations invalidate dependent available cash. |
| Investments | `[investments]` → `get_investment_portfolio_summary`; shell profile | 2 | 30s unchanged | No separate summary read per account; one aggregate RPC. Investment/account/transaction invalidation retained. |
| Investment detail | `[investments,account,id]` → `get_detailed_investment_account`; profile | 2 | 30s unchanged | Concurrent; Holding Detail reuses exactly the same account key/data. No portfolio fetch here. All investment mutation invalidation retained. |
| Settings | `[profile,user]`, `[categories]`, `[notification-preference,user]` → `get_notification_settings` | 3 | Profile 30s→5m; categories 5m, notification 30s unchanged | Independent reads concurrent. Profile save sets returned profile directly; category mutations invalidate; notification saves set returned preference directly. Export/reset are explicit actions only. |

Other bounded reads: Add Transaction requests active accounts/categories/profile/frequent categories (4 cold requests); Note suggestions are debounced 225 ms, at least two characters, maximum three results, 60-second freshness, no automatic retries. Frequent categories return five results with a five-minute freshness period. Neither is automatically fetched by Dashboard.

No clear duplicate concurrent RPC or removable frontend waterfall was found. Dashboard's account summary overlaps Accounts semantically but is embedded in a different aggregate result. Seeding another query from it could alter timestamps, invalidation, and representation assumptions; not selected without stronger evidence. Necessary profile/timezone dependencies are preserved.

## Ranking and selected fixes

| Finding | Impact | Confidence | Risk / effort | Decision |
| --- | --- | --- | --- | --- |
| Cached reads become full errors / investment redirect | High reliability/continuity | High, explicit branches | Low–medium / medium, UI-only | Selected for five high-frequency views |
| Blind retries of permanent errors | High failure-path latency/request count | High, installed Query source | Low / small | Selected; conservative transient allowlist |
| Short freshness on stable data and quick Dashboard revisits | Medium–high request reduction | High, options and observer tests | Low / small | Selected; no huge global staleTime |
| Opaque query/route failure source | High diagnostic value | High | Low / small | Selected; development-only metadata |
| Mounted observer retains a prior user's displayed result after cache clear | High privacy/reliability | High, new regression test failed before fix | Low / small | Fifth selected fix; remount content only on identity change |
| More route splitting | Low demonstrated benefit | High that all pages already lazy | Medium / medium | Not selected |
| Large Detailed investment histories | Potentially high at scale | High payload-shape evidence; unknown runtime cost | Financial read-model risk / substantial | DEFERRED DATABASE OPTIMISATION |
| Database index/RPC consolidation | Unknown | No production plans/timings | Medium–high | DEFERRED DATABASE OPTIMISATION |
| Prefetching and additional page skeletons | Unknown | No navigation/bandwidth trace | Extra traffic and code | Not selected |

## Exact retry, caching, diagnostics changes

- Dashboard and monthly budgets: **15,000 → 30,000 ms** freshness.
- Profile and archived accounts: **30,000 → 300,000 ms** via scoped QueryClient defaults.
- Global financial default **30,000 ms unchanged**. Categories/frequent categories remain 300,000 ms; Goals summary 15,000 ms; note suggestions 60,000 ms.
- `gcTime` now explicitly 300,000 ms (same as previous browser default). No persisted Query cache. No placeholder data across keys, users, filters, months, or accounts.
- One automatic retry after **1,000 ms**, only for recognized fetch transport messages, HTTP 408/429/502/503/504 when status is available, pool timeout PGRST003, connection errors 08000/08003/08006, capacity 53300, or shutdown 57P01. Supabase services often throw a PostgREST error without HTTP status; unknown/ambiguous failures deliberately do not retry.
- Auth/permissions, runtime validation, remaining SQL/PostgREST errors, known permanent status errors, and unknown errors have zero automatic retries. Abort-like errors are not classified as retryable.
- All mutations explicitly `retry:false`, preserving the previous default; Note suggestions keep their existing explicit `retry:false`. No service/RPC body or mutation invalidation function changed.
- Remount/reconnect remain stale-aware; focus refetch remains disabled. Manual Try again is an explicit new read.
- QueryCache reports exhausted failures once per query failure, rather than per component observer. Output is a fixed label, allowlisted query family, sanitized route template, error category, and online flag. No error object/stack, complete key, ID, URL parameters, raw code/message, payload, note, amount, balance, name, token, or subscription endpoint is logged. Route boundary separately classifies chunk-load vs render/route. Both are development-only; no new telemetry service or data persistence.

## Database and PWA audit / deferred work

**DEFERRED DATABASE OPTIMISATION:** `get_detailed_investment_account` returns all trades, cash events, and price history. The account page shows only twelve activity items, while Holding Detail uses per-holding history from that same result. Paginating/trimming the response requires a designed RPC/UI contract; no SQL changed. Portfolio and Dashboard account valuation helpers also warrant real execution plans with a large representative dataset before any index or arithmetic change.

Dashboard already bounds recent transactions to six and snapshot history to 90 local-calendar days. Transactions use 40-row keyset pages. Analytics is a ranged database aggregation. Categories, account lists, goal history, and investment histories can grow; no live payload sizes or execution times were available. Dashboard still returns monthly income/net cash flow/spending groups beyond the currently displayed metrics; removing fields would change the RPC contract for a small unmeasured gain.

The worker remains `injectManifest`, static precache plus index.html navigation fallback, with `skipWaiting`, `clientsClaim`, and outdated-cache cleanup. No Supabase/Auth runtime route, private response cache, or offline write queue was introduced. It precaches lazy route JS too, which helps subsequent installed-app routes but increases installation/update bytes. Five font subsets are included (about 76 kB total); no measured reason to change language coverage.

Existing immediate worker activation plus obsolete asset cleanup can, in principle, leave an already-open page referencing an old lazy chunk during deployment. That is a hypothesis, not a reproduced root cause. The new route diagnostic distinguishes chunk-load failures during development. Worker update behavior was deliberately not changed without an installed-device reproduction. Existing guards, bottom navigation, SPA hosting rewrite, and PWA fallback are unchanged.

## Tests and validation

Added real QueryClient/QueryObserver checks for stable-cache remount, a 20-second Dashboard revisit, mutation invalidation, concurrent query deduplication, bounded transient retries, no auth/validation retries, no mutation retry, retained data through failure, offline pause/reconnect, and old-user in-flight completion after clearing.

Added a protected-route/AuthProvider test showing that reads wait for session readiness and prior-user data disappears on an actual user switch. Added presentation tests for cached Dashboard metrics, Analytics charts, transaction rows, Accounts/detail dialog, initial failures/retry, Investment Account no-redirect recovery, and refresh notice state. Added diagnostic redaction and production-silence tests. Existing financial, auth, PWA, reconciliation, export, and notification tests remain intact.

Final verification: **89 files / 476 tests passed** (37 additional tests; 39.96 s local run). `npm.cmd run lint`, `npm.cmd run build`, and `git diff --check` passed. Build completed the injectManifest worker. The existing plugin warning about deprecated `inlineDynamicImports` remains; no build failures. Test/build durations vary with machine concurrency and are not app performance measurements.

| Evidence | Before | After | Interpretation |
| --- | ---: | ---: | --- |
| Dashboard + budget reads on remount with 20-second-old data | 2 | 0 | Controlled real QueryObserver test, seeded same-key cache, old/new freshness options. Not a production network trace. |
| Profile/archived data remount at 60 seconds | Stale, requests again | 0 reads while fresh | V1 observer test; baseline inferred from old 30-second options. |
| Recognized transient read attempts | Up to 4 | Up to 2 | Installed browser default vs verified V1 policy. |
| Permanent/auth/validation read attempts | Up to 4 | 1 | V1 behavior tested. |
| Worst retry backoff, excluding request durations | 7 seconds | 1 second transient / 0 permanent | Old exponential 1+2+4 vs bounded policy. A hung request can still take time; no new request timeout. |
| Mutation invalidation of fresh Dashboard | Refresh | Refresh | Verified one new read immediately after invalidation. |
| Entry JS chunk, raw / gzip | 297.10 / 96.06 kB | 298.25 / 96.59 kB | Small reliability-code increase; no claimed bundle reduction. |
| HTML entry + JS modulepreloads | 769,665 / 235,771 bytes gzip | 771,000 / 236,174 bytes gzip | Raw +1,335 bytes; gzip +403 bytes. Automatic chunk grouping changed from 14 to 13 files. |
| CSS, raw / gzip | 91.56 / 15.98 kB | 91.78 / 16.00 kB | Small notice styling increase. |
| PWA static precache | 86 entries / 1698.44 KiB | 86 entries / 1701.06 KiB | Parsed generated manifest: 86 unique static URLs, zero duplicates, index.html present. |

Final lazy chunks, raw / gzip kB: Dashboard 29.90 / 9.83; Transactions 9.29 / 3.40; Accounts 13.73 / 4.48; Analytics 57.93 / 17.08; Budgets 15.93 / 4.87; Goals 6.38 / 2.23; Investments 6.58 / 2.35; Investment Account 23.18 / 6.53; Detailed Setup 7.21 / 2.76; Holding Detail 3.44 / 1.45; Assistant 8.51 / 3.44; Settings 44.81 / 15.90; shared Recharts 330.65 / 96.86. These exclude shared dependencies. No route was newly split and no chart library changed.

Production assets contain neither new diagnostic log label (development diagnostics are eliminated). Frontend source scan found no service-role reference outside tests. No changes to migrations, package manifests/lockfile, Supabase services, financial schemas, service worker, or PWA config. Existing financial/RLS/offline/reconciliation/notification/export suites passed. No authenticated live financial or iPhone checks were performed.

## Files changed

Production code:

- `src/app/providers.tsx`, `src/app/query-client.ts`, `src/app/route-error-page.tsx`
- `src/lib/query-policy.ts`, `src/lib/query-diagnostics.ts`
- `src/components/shared/query-refresh-notice.tsx`
- `src/features/auth/auth-provider.tsx`
- `src/features/dashboard/dashboard-hooks.ts`, `src/features/dashboard/dashboard-page.tsx`
- `src/features/budgets/budget-hooks.ts`
- `src/features/accounts/accounts-view.tsx`, `src/features/accounts/account-detail-dialog.tsx`
- `src/features/analytics/analytics-page.tsx`
- `src/features/transactions/transactions-page.tsx`
- `src/features/investments/investment-account-page.tsx`

Added tests:

- `src/app/query-client.test.ts`
- `src/lib/query-diagnostics.test.ts`
- `src/components/shared/query-refresh-notice.test.tsx`
- `src/features/investments/investment-account-reliability.test.tsx`

Extended tests:

- `src/features/auth/auth-provider.test.tsx`
- `src/features/accounts/accounts-view.test.tsx`
- `src/features/analytics/analytics-page.test.tsx`
- `src/features/dashboard/dashboard-page.test.tsx`
- `src/features/transactions/transactions-page-interactions.test.tsx`

Audit/report: `docs/audits/performance-reliability-v1.md`.

## Manual iPhone checks still required

1. Install/update from the intended production origin. Cold-launch and navigate Dashboard → Transactions → Dashboard within 20 seconds. Repeat after more than 30 seconds, and check requests with Safari's remote inspector.
2. Load each updated view, interrupt connectivity or fail its next read, and confirm loaded data stays visible with the notice. Try again after reconnect; confirm notice disappears after success. Cold offline startup cannot invent uncached financial data.
3. Change transaction filters/month and Analytics period during a failure: another range's data must not appear under the new selection.
4. Save an ordinary transaction; confirm account balance, Dashboard, budgets and other affected reads invalidate immediately despite the freshness window. Do not replay a timed-out financial mutation.
5. Open Account Detail, fail reconciliation's explicit refresh, and verify submission remains blocked until a successful reread. Verify stale-reviewed-value rejection remains intact.
6. Open a Detailed account and a holding; confirm account-cache reuse, retry-in-place, unchanged values/history, and no automatic large investment prefetch.
7. Background/resume the standalone app, expire/refresh the auth session, sign out, and log in as another test user. Confirm no previous-user data or preferences remain visible.
8. Deploy an update while the old app is open, then visit a previously unopened lazy route. Check chunk failures, app reload recovery, bottom navigation, direct deep-link reload, static precache, and absence of Supabase responses in Cache Storage.

## Remaining limits and commit

V1 does not claim a proven production root cause or faster database execution. Cold-route request counts are unchanged. Remaining candidates are measured SQL work, Detailed history pagination, large initial shared UI/Auth JS, chart parse/render cost, all-loaded-pages transaction refetching, date rollover/resume behavior, and old-open-tab worker/chunk updates. Budgets, Goals, portfolio list, and Settings retain their existing local/full error presentation; extending cached-content UX to them is outside this selected phase. No second optimisation phase is included.

Recommended commit: `perf: improve navigation cache reuse and transient read recovery`
