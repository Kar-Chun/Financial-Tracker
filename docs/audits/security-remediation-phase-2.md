# Security Remediation Phase 2 — Web Push Subscription Hardening

## Scope and baseline

Only M3 (subscription fan-out), L2 (endpoint reassignment), and I1 (first-batch reminder coverage) are addressed. Read AGENTS.md, README.md, the current notification migration/functions and DAILY_TRANSACTION_REMINDER.md. Security Review V1 exists in the conversation, not as a repository report file.

The initial working tree was clean at `52033ed`; Phase 1 was already committed. The repository contained 22 migrations ending at `202609260001_harden_financial_input_boundaries.sql`. No deployed migration state was assumed or altered. No reset, restore, clean, stash, secret changes or deployments were performed.

Baseline: 516 tests passed in 91 files; lint, build, PWA injectManifest and `git diff --check` passed. Static precache: 87 entries / 1701.80 KiB. The existing inlineDynamicImports build deprecation warning remains.

## Existing flow and failures

Browser explicit Enable → PushManager get/create subscription → authenticated `enable_daily_transaction_reminder` → `push_subscriptions` and preference. The single daily Cron → scheduler-authenticated Edge Function → service-only claim RPC → user preference/subscriptions → Web Push sender → generic service-worker notification → Add Expense.

Registration previously inserted arbitrary numbers of endpoints and reassigned `user_id` on endpoint conflicts. The worker fetched all subscriptions and sent them through Promise.all. Claim SQL selected the first 50 enabled users before conflict handling, and the worker requested only one batch, excluding later users from coverage.

## Database changes

One appended migration: `202609260002_harden_push_subscriptions_and_reminder_batches.sql`. It replaces only `enable_daily_transaction_reminder` and `claim_daily_transaction_reminders`. Existing function ownership/grants, RLS, tables, daily unique constraint, removal and completion functions are preserved. No financial SQL or old migration is changed.

Registration takes a transaction-scoped advisory lock per authenticated user before selecting/counting/inserting. Thus concurrent registrations for that user serialize. Existing caller-owned endpoints update keys without consuming another slot. Otherwise five existing rows cause a P2002 domain rejection. There is no automatic eviction or new active flag.

Existing endpoints owned by anyone else cause the generic P2001 conflict; no owner identity or subscription material appears in the error. The insert uses `ON CONFLICT (endpoint) DO NOTHING`, so a race between different users offering a new endpoint cannot overwrite ownership or leak endpoint details through a unique-constraint error. Only the successful insert owns the row. These transaction-level locks release at transaction end; see [PostgreSQL advisory locks](https://www.postgresql.org/docs/current/explicit-locking.html#ADVISORY-LOCKS).

Claim selection now filters enabled users with no existing claim for the requested Singapore date before stable user-ID ordering and LIMIT. Short claim transactions serialize per date to prevent concurrent first-batch conflicts from being mistaken for an empty eligible set. The durable unique constraint and ON CONFLICT protection remain. All existing claim statuses are skipped, including failed claims.

Existing over-cap rows are not deleted. They block additional registrations while same-owner refresh remains allowed; worker read/send bounds protect delivery immediately. The deployment guide includes an aggregate preflight and explicit owner-led cleanup instructions.

## Frontend and Edge behavior

The notification service retries registration only once with a fresh local PushSubscription after an explicit conflict on an existing local subscription. Successful local unsubscribe is required, and the new endpoint must differ. No rotation occurs on capacity, authentication, unknown RPC or network errors; a second conflict stops. The original server row is untouched. Identity checks abort pending setup/recovery after a user switch. Permission prompting remains directly initiated by the user's action.

The existing Settings toast maps the cap error to: “You've reached the device limit for notifications. Remove an existing device before adding another.” No Settings layout, logout behavior, auth provider or query-cache isolation changes were made.

The Edge Function queries at most five subscriptions in stable updated-at/ID order, and the worker also slices to five defensively. It processes at most five users concurrently. Claim batches are 50; it drains until empty or 20 non-empty batches (at most 1,000 users). A bounded in-memory set prevents an accidental repeated claim from being sent again. No unbounded user array is accumulated.

The first database-provided Singapore date is pinned across the invocation. Safety stops return HTTP 503 and log only request ID, fixed category, claimed count and batch count. Responses contain operational counts and a stop reason, not user IDs, endpoints or keys. No automatic same-day retry is added. Platform execution deadlines remain a hosted consideration for unusually large or slow batches.

Fixed product behavior is unchanged: **9 PM Singapore**, Cron `0 13 * * *`; generic reminder; click opens `/transactions/new?type=expense`; no financial values, configurable times, additional scheduler or financial mutations.

## Tests and hosted limits

Existing tests are retained. Added coverage checks:

- Shared-browser fresh registration, no reassignment RPC, one recovery attempt, unsubscribe failure, same-endpoint failure, cap/auth/unknown error preservation and session changes.
- Safe Settings device-limit message.
- Worker draining 123 users in 50/50/23 batches, five-device limit, maximum 25 concurrent sends, safety guard, duplicate/oversized batch rejection and no sensitive failure logging.
- Migration lock/count/insert order, ownership protection, unchanged grants and claim filtering before LIMIT.
- Edge bounded queries, pinned date, operational logs, existing scheduler authentication and generic payload.

`DAILY_TRANSACTION_REMINDER_VERIFICATION.sql` now exercises actual authenticated/service-role RPCs for first/update/five/sixth devices, removal, conflict ownership and key preservation, browser delivery denial, disabled users, existing claims, non-overlapping 50/10 batches, same-day uniqueness and next-day eligibility. It rolls back all fixtures and refuses to run against existing enabled reminder preferences.

`PUSH_SUBSCRIPTION_CONCURRENCY_VERIFICATION.sql` is an explicit two-connection rollback probe: A holds the registration lock after five devices; B must fail to acquire it before reaching insertion; A's sixth registration must fail the cap. It does not pretend a single-session assertion is a parallel database test.

Docker's executable exists but its Linux daemon is unavailable, and no local psql/Supabase executable was found. Database scripts have not been executed here. Run them on disposable/staging Supabase, followed by competing committed-request tests, deployed scheduler authentication, real 404/410 cleanup, shared-browser switching and installed-iPhone checks. No real push was sent during implementation.

## Final verification

- `npm test`: 539 tests passed in 91 files (23 added; baseline 516).
- `npm run lint`: passed.
- `npm run build`: passed, including PWA injectManifest; 87 static precache entries / 1701.94 KiB. Generated manifest inspection found 87 unique URLs, all static shell assets.
- `git diff --check`: passed. Existing migrations are unchanged; only the new Phase 2 migration is added.
- Service-worker source, financial SQL, auth provider, dependencies, reminder schedule and secrets are unchanged. No private Supabase runtime caching or offline queue was added. No server-secret variable references were found in production frontend source or generated bundles.
- Database integration and real browser push delivery remain unexecuted here, as described above. Unit tests and SQL source checks are not a substitute for staging SQL verification.

Commands used `npm.cmd` because this Windows shell blocks `npm.ps1`.

## Deployment

Follow the Phase 2 upgrade section in `supabase/DAILY_TRANSACTION_REMINDER.md`: verify migration state and legacy counts → staging migration and SQL checks → reviewed production migration → updated Edge Function → frontend/PWA update → manual checks. Preserve the existing Cron job and VAPID/scheduler secrets. No automatic deployment was performed.

Recommended commit: `fix: bound push subscriptions and drain daily reminder batches`
