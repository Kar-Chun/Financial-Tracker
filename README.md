# Ledgerly

Ledgerly is a secure personal finance tracker for understanding current assets, recording daily activity, and seeing where money is spent. V1.2 adds an installable, mobile-first experience without changing the established accounting model.

## Capabilities

- Email/password Supabase Auth with persistent sessions, confirmation handling, protected routes, and logout
- Profiles with display name, locked base currency, and timezone
- Bank, cash, and investment accounts with edit/archive flows
- Transaction-derived bank/cash balances; atomic income, expense, and same-currency transfers
- Manual total investment valuations in native and base currency
- Real dashboard metrics and timezone-aware daily net-worth snapshots
- Spending analytics with period presets, equivalent-period comparisons, parent/subcategory breakdowns, responsive charts, and factual deterministic insights
- Expense and income category management: create, rename, archive, restore, and one-level subcategories
- Explicit warnings/exclusions where foreign values cannot safely be consolidated
- Installable PWA support with iOS home-screen metadata and a static-shell service worker
- Mobile bottom navigation, full-screen transaction entry, safe-area handling, and offline mutation protection
- User-scoped last expense account and deterministic frequent expense category shortcuts

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
|-- features/            # Auth, accounts, transactions, dashboard, analytics, categories
|-- lib/                 # Supabase, exact currency, date, error, and styling utilities
|-- test/                # Shared Vitest setup
`-- types/               # Database and finance contracts
supabase/
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

Do not recreate tables manually in the Table Editor.

## Authentication and security

New Auth users receive a profile and default categories through a database trigger. If email confirmation is enabled, signup shows a confirmation message and protected routes remain unavailable until a session exists.

RLS is enabled on every user/financial table. Direct financial and category mutations are withheld from browser roles. Validated `SECURITY DEFINER` RPCs use an empty `search_path`, derive ownership from `auth.uid()`, and validate every referenced row. Follow [V1 RLS verification](supabase/RLS_VERIFICATION.md) and [V1.1 verification](supabase/V1_1_VERIFICATION.md) after migration.

## Money, balances, and investments

Ordinary currency is stored as `BIGINT` integer minor units: SGD 1.00 is `100`. User input is parsed with integer/`BigInt` arithmetic, not `parseFloat(input) * 100`.

Bank/cash balance = opening balance + non-deleted transaction entries through today. Income creates one positive entry, expense one negative entry, and a transfer two opposite entries in one atomic RPC. Transfers do not affect net worth, income, expenses, or net cash flow.

An investment account uses its latest manual native/base valuation plus transfer movements recorded after that valuation. A newer valuation resets that boundary, avoiding double-counting. Base-currency investment transfer movements can remain represented in net worth; foreign investment movements update native value only because V1.1 does not invent FX.

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

No Supabase secret or service-role credential belongs in Vercel's frontend environment.

After Vercel provides the production URL, open Supabase Dashboard > Authentication > URL Configuration:

1. Set **Site URL** to the exact HTTPS production URL.
2. Add the exact production URL to **Redirect URLs** if it is not already allowed.
3. Keep the local Vite URL as an additional redirect only if local confirmation testing is needed.
4. If Vercel preview signups need email confirmation, add an appropriately scoped preview redirect pattern separately; prefer an exact production redirect for production.

Signup does not hardcode a host. Supabase uses the configured Site URL for email-confirmation redirects, and the browser client detects the returned session in the URL. Do not deploy until migration status and the production environment variables have been confirmed.

V1.2 does not change `vercel.json` or require additional Vercel environment variables. Apply migration `202608230002_add_frequent_expense_categories.sql`, then rebuild/redeploy so the manifest, icons, and generated service worker are published. Existing users may need to close and reopen the installed app once after an automatic service-worker update.

## Intentionally deferred

V1.2 does not include offline financial writes/background sync, push notifications, credit cards, debt, receipts/OCR, merchants, payment status, split/pending/recurring transactions, refund UX, holdings, broker/price APIs, automatic FX, bank integrations, budgets, goals, CSV import, or AI. Budgets and goals remain honest placeholders.
