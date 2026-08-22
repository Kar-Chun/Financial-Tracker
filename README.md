# Ledgerly

Ledgerly is a secure V1 personal finance tracker for answering three daily questions: how much money do I have, what income or expense happened today, and where is my money being spent?

## V1 capabilities

- Email/password signup, login, persistent sessions, email-confirmation handling, protected routes, and logout
- User profiles with display name, locked base currency, and timezone
- Active bank, cash, and investment accounts with edit and archive flows
- Calculated bank/cash balances from opening balance plus transaction entries
- Income, expense, and same-currency transfer creation, editing, history, filtering, and soft deletion
- Default income/expense categories and one-level subcategories created for every user
- Manual total investment valuations in native and base currency
- Real dashboard metrics, current-month parent-category spending, recent transactions, and daily net-worth snapshots
- Explicit exclusion warnings for foreign-currency bank/cash values that cannot safely be consolidated

## Stack and architecture

- React 19, strict TypeScript, and Vite
- Tailwind CSS and focused shadcn/ui components
- React Router protected/public-only route guards
- TanStack Query for server state and mutation invalidation
- React Hook Form and Zod for forms
- Supabase Auth, Postgres, RPC functions, and Row Level Security
- Vitest and React Testing Library

Frontend code remains feature-based under `src/features`. Supabase queries and mutations live in small feature services/hooks instead of page components. The database contract is versioned under `supabase/migrations`.

## Environment variables

Create `.env.local` with the browser-safe values from Supabase Project Settings > API:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

`.env.local` is ignored by Git. Never place a Supabase `service_role` key, database password, or access token in frontend environment variables.

## Project structure

```text
src/
├── app/                 # Router and top-level providers
├── components/          # Reusable layout, shared, and shadcn UI components
├── features/            # Auth, accounts, transactions, dashboard, and placeholders
├── lib/                 # Supabase, currency, date, error, and styling utilities
├── test/                # Shared Vitest setup
└── types/               # Database and finance contracts
supabase/
├── migrations/          # Versioned schema, functions, RLS, and grants
└── RLS_VERIFICATION.md  # Manual two-user isolation procedure
```

## Apply the Supabase migrations

The migration files must be applied in filename order.

### Supabase CLI

The CLI is not required as a project dependency and Docker is not needed for a remote push:

```bash
npx supabase@latest login
npx supabase@latest link --project-ref YOUR_PROJECT_REF
npx supabase@latest db push
```

Confirm the project reference before approving the push. This repository has not been linked automatically.

### Supabase SQL Editor

Alternatively, open the Supabase SQL Editor and run these files in order:

1. `supabase/migrations/202608220001_create_finance_schema.sql`
2. `supabase/migrations/202608220002_create_financial_functions.sql`
3. `supabase/migrations/202608220003_enable_rls_and_grants.sql`
4. `supabase/migrations/202608220004_fix_investment_transfer_accounting.sql`

Do not recreate tables manually in the Table Editor.

## Authentication behaviour

New Auth users receive a `public.profiles` row and default categories through a database trigger. If email confirmation is enabled, signup shows a confirmation message and no protected route is opened until an active session exists. Authenticated users are redirected away from `/login` and `/signup`; unauthenticated users are redirected to `/login` for application routes.

## Money and balance model

Ordinary currency is stored as `BIGINT` integer minor units: SGD 1.00 is `100`, and SGD 12.50 is `1250`. User input is parsed as strings with integer/`BigInt` arithmetic rather than `parseFloat(input) * 100`.

Bank and cash balances are calculated as:

```text
opening_balance_minor + non-deleted transaction entries through today
```

Income creates one positive entry, expense creates one negative entry, and transfers create two opposite entries inside one atomic PostgreSQL RPC. The browser never supplies or controls `user_id`.

## Investment valuation model

V1 does not track holdings or market prices. Each investment account has manual dated valuations containing:

- Native value in the account currency
- Manually supplied value in the profile base currency

The latest valuation on or before today is the investment value baseline. Transfers recorded after that valuation are treated as unvalued movements until the next manual valuation:

- Native transfer movements adjust the displayed native investment value.
- When the investment currency matches the profile base currency, the same movement also adjusts consolidated net worth.
- For foreign-currency investments, the manually supplied base value remains unchanged because V1 does not invent an FX rate.
- Saving a newer manual valuation resets the transfer adjustment boundary, so earlier contributions are not counted twice.

This preserves net worth when money moves between base-currency bank/cash and investment accounts without treating investment transaction entries as market performance.

## Multi-currency limitation

There is no automatic FX conversion. Foreign-currency bank/cash balances remain visible in native currency but are excluded from consolidated base-currency net worth, monthly totals, and spending aggregation. Foreign investment transfers update native value only; their base value remains the latest manual `base_value_minor` until the user supplies another valuation.

## Daily snapshots

At most one `net_worth_snapshots` row exists per user and local calendar date. Financial RPCs refresh today's row, and dashboard loading refreshes it again so missed updates self-heal. The profile timezone determines the local date. There is no cron job and no artificial row for unused days.

## Security and RLS verification

RLS is enabled on every public V1 table. Direct financial mutations are revoked from browser roles; validated `SECURITY DEFINER` RPCs use an empty `search_path`, derive ownership from `auth.uid()`, and reject cross-user, archived, invalid-category, and cross-currency references.

Follow [supabase/RLS_VERIFICATION.md](supabase/RLS_VERIFICATION.md) after migration to test User A/User B isolation and RPC ownership checks.

## Development and validation

```bash
npm install
npm run dev
npm test
npm run lint
npm run build
git diff --check
```

## Intentionally deferred

V1 does not include credit cards, debt, receipts/OCR, merchants, payment status, split/pending/recurring transactions, holdings, broker or stock-price APIs, automatic FX, bank integrations, budgets, goals, CSV import, AI, notifications, or scheduled jobs. The budget, goals, and analytics routes remain honest placeholders.
