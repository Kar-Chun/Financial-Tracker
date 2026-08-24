# Ledgerly

Ledgerly is a secure personal finance tracker for understanding current assets, recording daily activity, planning monthly spending, earmarking cash for savings goals, and optionally tracking an investment portfolio in detail. V2 preserves every existing accounting model while adding an explicit holdings ledger.

## Capabilities

- Email/password Supabase Auth with persistent sessions, confirmation handling, protected routes, and logout
- Profiles with display name, locked base currency, and timezone
- Bank, cash, and investment accounts with edit/archive flows
- Transaction-derived bank/cash balances; atomic income, expense, and same-currency transfers
- Simple manual investment valuations plus optional Detailed holdings, trades, broker cash, prices, dividends, and manual valuation FX
- Real dashboard metrics and timezone-aware daily net-worth snapshots
- Spending analytics with period presets, equivalent-period comparisons, parent/subcategory breakdowns, responsive charts, and factual deterministic insights
- Expense and income category management: create, rename, archive, restore, and one-level subcategories
- Explicit warnings/exclusions where foreign values cannot safely be consolidated
- Installable PWA support with iOS home-screen metadata and a static-shell service worker
- Mobile bottom navigation, full-screen transaction entry, safe-area handling, and offline mutation protection
- User-scoped last expense account and deterministic frequent expense category shortcuts
- Independent monthly overall budgets, optional parent-category limits, spending pace, and safe daily guidance
- Multiple base-currency savings goals with virtual allocations, progress, target-date guidance, history, and archival
- An authenticated, read-only AI Financial Assistant grounded by allowlisted deterministic finance tools

## Stack and architecture

- React 19, strict TypeScript, and Vite
- Tailwind CSS and focused shadcn/ui components
- React Router with protected/public-only route guards
- TanStack Query for server state and mutation invalidation
- React Hook Form and Zod for forms
- Supabase Auth, Postgres, RPC functions, and Row Level Security
- Recharts for responsive analytics visualisation
- vite-plugin-pwa and Workbox for static application-shell caching
- Vitest and React Testing Library

Frontend code is feature-based under `src/features`. Supabase access lives in small feature services/hooks instead of page components. The versioned database contract lives under `supabase/migrations`.

## Environment

Create `.env.local` with browser-safe values from Supabase Project Settings > API:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

`.env.local` is ignored by Git. Never place a Supabase `service_role` key, database password, or access token in frontend environment variables.

## High-level structure

```text
src/
|-- app/                 # Router and top-level providers
|-- components/          # Layout, shared, and shadcn UI components
|-- features/            # Auth, finance features, analytics, and the Assistant UI
|-- lib/                 # Supabase, exact currency, date, error, and styling utilities
|-- test/                # Shared Vitest setup
`-- types/               # Database and finance contracts
supabase/
|-- functions/           # Server-side AI provider orchestration and read-only tools
|-- migrations/          # Versioned schema, functions, RLS, and grants
|-- RLS_VERIFICATION.md  # V1 two-user isolation procedure
`-- V1_1_VERIFICATION.md # Analytics/category verification
```

## Apply Supabase migrations

Apply migrations in filename order. For a safely confirmed project link:

```bash
npx supabase@latest login
npx supabase@latest link --project-ref YOUR_PROJECT_REF
npx supabase@latest db push
```

Confirm the project reference before pushing. This repository is not linked automatically. Alternatively, use Supabase SQL Editor and run the files in order:

1. `202608220001_create_finance_schema.sql`
2. `202608220002_create_financial_functions.sql`
3. `202608220003_enable_rls_and_grants.sql`
4. `202608220004_fix_investment_transfer_accounting.sql`
5. `202608230001_add_spending_analytics_and_category_management.sql`
6. `202608230002_add_frequent_expense_categories.sql`
7. `202608240001_add_monthly_budgets.sql`
8. `202608240002_add_savings_goals.sql`
9. `202608240003_add_detailed_investment_ledger.sql`
10. `202608240004_integrate_detailed_investment_values.sql`
11. `202608240005_add_ai_read_models.sql`

Do not recreate tables manually in the Table Editor.

## Authentication and security

New Auth users receive a profile and default categories through a database trigger. If email confirmation is enabled, signup shows a confirmation message and protected routes remain unavailable until a session exists.

RLS is enabled on every user/financial table. Direct financial and category mutations are withheld from browser roles. Validated `SECURITY DEFINER` RPCs use an empty `search_path`, derive ownership from `auth.uid()`, and validate every referenced row. Follow [V1 RLS verification](supabase/RLS_VERIFICATION.md) and [V1.1 verification](supabase/V1_1_VERIFICATION.md) after migration.

## Money, balances, and investments

Ordinary currency is stored as `BIGINT` integer minor units: SGD 1.00 is `100`. User input is parsed with integer/`BigInt` arithmetic, not `parseFloat(input) * 100`.

Bank/cash balance = opening balance + non-deleted transaction entries through today. Income creates one positive entry, expense one negative entry, and a transfer two opposite entries in one atomic RPC. Transfers do not affect net worth, income, expenses, or net cash flow.

Simple investment accounts use their latest manual native/base valuation plus transfer movements recorded after that valuation. A newer valuation resets that boundary, avoiding double-counting. Existing accounts remain Simple until the user explicitly completes Detailed setup.

Foreign-currency bank/cash values remain visible in native currency but are excluded from consolidated base-currency net worth and spending totals.

## Spending analytics definitions

Analytics includes only non-deleted `expense` transactions against accounts in the profile base currency. Income, transfers, adjustments, and refunds are excluded. Foreign-currency expenses produce an exclusion warning but are not converted. Refund-specific analytics remains deferred until refund UX/semantics are designed.

- This Month: month-to-date versus the same elapsed dates in the previous month (for example 1–22 August versus 1–22 July).
- Last Month: the complete previous month versus the complete month before it.
- Last 3/6 Months: the selected inclusive range versus the immediately preceding range with the same number of days.
- This Year: year-to-date versus the same calendar dates in the prior year.

A zero prior total is shown as no prior spending, never Infinity/NaN. The main category breakdown rolls children such as `Food › Eating Out` into `Food`; direct Food expenses also remain in that total. Expanding the parent reveals children and direct spend. Single-month periods use daily bars; longer periods use monthly bars.

## Category management rules

Settings separates expense and income categories. Category type and parent are immutable, nesting stops after one child level, and active names are unique case-insensitively within the same parent/type scope. Parents with active children cannot be archived until their children are archived. Archiving never deletes a category: history retains its readable label while new transaction forms offer active categories only.

## Daily snapshots

At most one snapshot exists per user/local calendar date. Financial RPCs refresh today, and dashboard loading self-heals it. There is no cron job or artificial row for unused days.

## Monthly budgeting

Each calendar month has an independent overall limit in the profile base currency; unused amounts never roll over. Optional category limits apply to an active parent expense category and all its direct children, but do not need to add up to the overall limit. Archived categories remain readable historically and cannot receive new limits.

Budget spending uses the same definition as Analytics: non-deleted `expense` transactions on base-currency accounts in the selected month. Income, transfers, adjustments, refunds, soft-deleted expenses, and unconverted foreign-currency expenses are excluded. No `spent` value is stored; the authenticated summary RPC aggregates current transactions whenever the budget is read.

For the current month, safe daily spend is `max(overall limit - spent, 0) / remaining calendar days including today`, rounded to integer minor units. Expected pace is `overall limit × elapsed calendar days / days in month`: actual spend at or below that value is **On track**, spend above pace but within the limit is **Spending ahead of pace**, and spend above the limit is **Over budget**. Historical months show final performance and future months do not show current guidance.

Copy Previous Month creates the destination month's overall/category limits only. It never copies transactions, spending, unused balance, or rollover, rejects an existing destination, and skips categories that are no longer active/valid. Budget currency is snapshotted when a month is created so a later profile-currency change cannot silently reinterpret historical limits; the UI still keeps base currency locked.

Migration `202608240001_add_monthly_budgets.sql` adds both budget tables, ownership RLS, validated mutation RPCs, and the aggregated monthly summary RPC. Follow [V1.4 budget verification](supabase/V1_4_VERIFICATION.md) for two-user and accounting checks.

## Savings goals

Savings goals virtually earmark money the user already owns. Allocating or reducing a goal creates only a signed `goal_allocations` history row; it never creates a transaction/entry, moves account money, changes net worth or snapshots, or affects budgets, Analytics, income, expenses, transfers, or cash flow. Goal currency is snapshotted from the authenticated user's current profile base currency and cannot be chosen by the browser.

Allocated amount is the exact sum of signed allocation rows. Remaining is `max(target - allocated, 0)` and a goal is reached when allocation is at least its target; visual progress caps at 100% while the real percentage remains visible. Allocations above the target are valid, while reductions that would make the cumulative allocation negative are rejected atomically.

Available goal cash reuses the application's represented balances for active base-currency Bank and Cash accounts. Investments and unconverted foreign balances are excluded. `unallocated cash = available cash - allocations for active goals in the profile base currency`; a negative result is a planning warning, never an automatic correction or hard block.

For an unreached dated goal, the approximate monthly amount is `ceil(remaining / calendar months from the current profile-timezone month through the target month, inclusive)`. Passed targets show no misleading monthly guidance. Archiving preserves the goal and complete history but excludes its allocation from current totals; restoring includes the existing allocation again.

Migration `202608240002_add_savings_goals.sql` adds goal/allocation tables, RLS, validated mutation RPCs, and aggregated summary/detail RPCs. Follow [V1.5 savings-goal verification](supabase/V1_5_VERIFICATION.md) for accounting-isolation and two-user checks.

## V2 detailed investments

Investment accounts have two deliberately separate tracking modes. **Simple** preserves the existing account-level manual valuation plus qualifying post-valuation transfers. **Detailed** uses only `broker cash + holdings at latest manual prices`; old Simple valuations remain historical and are never added to that total.

Enabling Detailed tracking is explicit and one-way in V2. The user chooses a boundary date, opening broker cash, and opening holdings with quantity, historical average cost, and current price. The preview compares the current Simple represented value with the new opening state without forcing them to match. Opening state represents everything at/before the conversion boundary, so only later transfer entries affect broker cash.

Detailed accounts are single-currency. Quantities, unit prices, and FX rates use PostgreSQL `NUMERIC`; represented money remains rounded integer minor units. Buys reduce broker cash by `quantity × unit price + fee`, increase ledger quantity, and add fees to weighted-average cost. Sells reject overselling, increase cash by proceeds less fees, remove weighted-average basis, and record realised gain/loss. Ledger rows are append-only. Neither operation is an ordinary expense/income transaction.

Current holding value is ledger quantity times the latest historical manual price. Dividends are investment cash events that increase broker cash but do not enter ordinary monthly income, budgets, or spending Analytics. Signed broker-cash adjustments require a reason and are a reconciliation tool, not a replacement for account transfers.

For foreign Detailed accounts, consolidated net worth requires the latest direct, user-owned `account currency → profile base currency` manual FX rate. Manual FX is valuation-only: it never converts transfers and no missing rate is treated as 1:1. Missing FX or any active holding price makes base value unavailable and safely excludes that account from consolidated totals until corrected. Price and FX updates refresh the existing one-per-local-day net-worth snapshot.

Migrations `202608240003_add_detailed_investment_ledger.sql` and `202608240004_integrate_detailed_investment_values.sql` add the ledgers/RLS/RPCs and then connect the mutually exclusive Simple/Detailed formulas to account summaries and snapshots. Apply both in order. Follow [V2 investment verification](supabase/V2_0_VERIFICATION.md) for conversion, trade, transfer, FX, snapshot, and two-user checks.

## V3 AI Financial Assistant

`/assistant` is an optional, read-only interpretation layer. The browser invokes the authenticated `financial-assistant` Supabase Edge Function; the function validates the user JWT, recreates trusted instructions server-side, and lets the configured Gemini model request only explicitly registered read tools. Deterministic Postgres RPCs remain authoritative for balances, spending, budgets, goals, and investments. A server-side exact minor-unit calculator handles supported what-if arithmetic. The assistant has no financial write tool and is never called by normal tracker calculations or background loading.

The function currently exposes compact financial overview, spending/comparison/category summaries, a capped transaction search, budget status, savings goals, investment summaries, a readable-name Detailed account lookup, and deterministic what-if scenarios. Transaction Notes and all other database text are passed only as structured, untrusted tool data. Read results are scoped by the user's JWT/RLS context; IDs and unrelated data are removed before provider calls where practical. Transaction search is capped at 20 rows.

Conversation is held only in page memory and clears on refresh; there is no chat-history table or local-storage copy. When a user invokes the Assistant, only relevant tool results and a small recent conversation window are sent to the configured AI provider. The Monthly Review is an explicit user action, not an automatic Dashboard request. Missing keys, quota, timeouts, or provider outages disable only AI—the rest of Ledgerly remains independent.

The Gemini key belongs in Supabase Edge Function secrets, never `.env.local`, Vercel, or a `VITE_` variable. After applying migration 11 and confirming the intended linked project, configure and deploy with placeholders:

```bash
npx supabase@latest secrets set GEMINI_API_KEY=YOUR_SCHOOL_GEMINI_KEY GEMINI_MODEL=YOUR_SUPPORTED_FLASH_MODEL
npx supabase@latest functions deploy financial-assistant
```

If the repository is not linked, add `--project-ref YOUR_CONFIRMED_PROJECT_REF` to each command or link it first. Changing `GEMINI_MODEL` switches the model without a frontend rebuild. See [V3 manual verification](supabase/V3_0_VERIFICATION.md).

V3 does not include AI writes, automatic categorisation/budgeting/allocation/trading, stock recommendations, live market/news grounding, persistent chat history, background reviews, voice, OCR, or multiple runtime providers.

## V1.2 mobile and PWA behaviour

Authenticated phone layouts use a four-item bottom bar for Home, Transactions, Analytics, and More, plus a separate safe-area-aware floating Add button. The button and every other create action open the protected `/transactions/new` route. The dedicated page defaults to Expense, puts the amount first, keeps Note visible, defaults the date using the profile timezone, and returns to the originating screen after Supabase confirms the save. Editing remains in the existing focused dialog.

The user-facing **Note** field maps to the existing `transactions.description` column and `p_description` RPC parameter; no duplicate note column exists. When present, Note is the transaction row title while category/account remain secondary context. Without a Note, expense/income rows fall back to category and transfers fall back to their source-to-destination account labels.

After a confirmed expense save, the app stores only that account UUID in local storage under a key scoped to the authenticated user. It is reused only when the account is still present in the user's RLS-filtered active account list and is a bank/cash account. Another user on the same device receives a different preference key.

The `get_frequent_expense_categories` RPC ranks up to five active expense categories by usage count over the previous 90 local-calendar days, with most recent use as the tie-breaker. It derives the user from `auth.uid()`, excludes soft-deleted/non-expense transactions and archived/income categories, and performs no per-category query. With no history, Quick Add falls back to sensible active expense categories.

The service worker precaches only the static application shell, generated JS/CSS, local fonts, and icons. It has no Supabase API runtime cache, background sync, financial mutation queue, or private financial response cache. Read-only screens may remain visible only where the browser already has them in memory. Every transaction, transfer, account, category, and valuation write checks connectivity before calling Supabase; offline attempts remain in the open form and are never replayed automatically.

Install on supported browsers using their **Install app** or **Add to Home Screen** action. On iPhone/iPad, open the production site in Safari, tap **Share**, then **Add to Home Screen**. The installed app uses standalone display mode and safe-area spacing for notches and the home indicator.

## Development and validation

```bash
npm install
npm run dev
npm test
npm run lint
npm run build
git diff --check
```

## Vercel deployment

This project is a Vite single-page application. Vite produces the production site in `dist/`, and the root `vercel.json` rewrites direct route requests to `index.html` so React Router can handle routes such as `/dashboard`, `/transactions`, and `/analytics` after a refresh.

Import the repository into Vercel and keep the detected Vite settings:

- Build command: `npm run build`
- Output directory: `dist`
- Install command: `npm install`

Configure these browser-safe environment variables in the Vercel project:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

No Supabase secret, Gemini key, or service-role credential belongs in Vercel's frontend environment. Gemini secrets are configured only for the Supabase Edge Function.

After Vercel provides the production URL, open Supabase Dashboard > Authentication > URL Configuration:

1. Set **Site URL** to the exact HTTPS production URL.
2. Add the exact production URL to **Redirect URLs** if it is not already allowed.
3. Keep the local Vite URL as an additional redirect only if local confirmation testing is needed.
4. If Vercel preview signups need email confirmation, add an appropriately scoped preview redirect pattern separately; prefer an exact production redirect for production.

Signup does not hardcode a host. Supabase uses the configured Site URL for email-confirmation redirects, and the browser client detects the returned session in the URL. Do not deploy until migration status and the production environment variables have been confirmed.

V2 does not change `vercel.json` or require additional Vercel environment variables. Apply both V2 migrations in order, then rebuild/redeploy. Existing installed-app users may need to close and reopen once after the service-worker update.

## Intentionally deferred

The app does not include automatic prices/FX, mixed-currency brokerage accounts, brokerage sync, contribution-adjusted returns (TWR/XIRR), tax lots/FIFO/LIFO, margin, derivatives, tax reporting, bank imports, or AI investment advice. Existing deferred personal-finance features remain deferred.
