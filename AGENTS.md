# Repository guidance

- Build the frontend with React, TypeScript, and Vite. Keep TypeScript strict and avoid `any`.
- Use Tailwind CSS and focused shadcn/ui components. Preserve the feature-based `src/features` structure and the `@/` alias.
- Supabase is the V1 backend. Row Level Security is mandatory for every financial table.
- Never expose or reference Supabase `service_role` credentials in frontend code. Only publishable browser credentials may use `VITE_` variables.
- Financial correctness takes priority over convenience. Do not use JavaScript floating-point values as the authoritative representation of ordinary currency; use integer minor units or an appropriate exact numeric representation.
- Transactions are the source of truth for bank/cash balances. Do not make major architectural changes without first understanding the complete financial data model.
- The versioned schema lives in `supabase/migrations`. Financial transaction, account, archive, valuation, and snapshot writes go through the validated RPCs; do not replace them with unrelated browser inserts.
- Bank/cash balances are opening balance plus non-deleted transaction entries. Investment values use the latest manual valuation plus transfer movements recorded after that valuation; a newer valuation resets the boundary to prevent double-counting.

- Consolidated totals include only bank/cash accounts already denominated in the profile base currency. Never treat foreign minor units as equivalent or add automatic FX without a designed migration.
- Soft-deleted transactions must remain excluded from normal reads, balances, metrics, and snapshots. Daily snapshots are timezone-aware upserts, not scheduled duplicates.
- Spending analytics is a ranged authenticated database aggregation of non-deleted expense transactions in the profile base currency. Transfers, income, adjustments, refunds, and unconverted foreign amounts stay excluded.
- Monthly budgets store limits only; spent amounts always derive from the same eligible-expense definition as Analytics. Budgets are independent calendar months with no rollover, category limits apply only to parent expense categories, and budget mutations use authenticated RPCs.
- Category mutations use validated RPCs. Categories have one nesting level, immutable type/parent, case-insensitive active sibling uniqueness, and archival rather than deletion so historical labels remain intact.
- The PWA service worker may cache only static application-shell assets. Never runtime-cache Supabase/Auth/private financial responses or add an offline financial mutation queue.
- Financial mutation services must refuse writes while offline. Mobile convenience preferences contain only user-scoped internal IDs and must be revalidated against the current RLS-filtered data before use.
- Prefer small, readable components and local state for simple UI concerns. Use TanStack Query for server state; do not introduce a global state library without a demonstrated need.
- Run `npm run lint` and `npm run build` after relevant changes, and fix failures before handoff.
