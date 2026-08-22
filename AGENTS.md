# Repository guidance

- Build the frontend with React, TypeScript, and Vite. Keep TypeScript strict and avoid `any`.
- Use Tailwind CSS and focused shadcn/ui components. Preserve the feature-based `src/features` structure and the `@/` alias.
- Supabase is the V1 backend. Row Level Security is mandatory for every financial table.
- Never expose or reference Supabase `service_role` credentials in frontend code. Only publishable browser credentials may use `VITE_` variables.
- Financial correctness takes priority over convenience. Do not use JavaScript floating-point values as the authoritative representation of ordinary currency; use integer minor units or an appropriate exact numeric representation.
- Transactions are the source of truth for bank/cash balances. Do not make major architectural changes without first understanding the complete financial data model.
- The versioned schema lives in `supabase/migrations`. Financial transaction, account, archive, valuation, and snapshot writes go through the validated RPCs; do not replace them with unrelated browser inserts.
- Bank/cash balances are opening balance plus non-deleted transaction entries. Investment net worth uses only the latest manual base valuation, never investment entries.
- Consolidated totals include only bank/cash accounts already denominated in the profile base currency. Never treat foreign minor units as equivalent or add automatic FX without a designed migration.
- Soft-deleted transactions must remain excluded from normal reads, balances, metrics, and snapshots. Daily snapshots are timezone-aware upserts, not scheduled duplicates.
- Prefer small, readable components and local state for simple UI concerns. Use TanStack Query for server state; do not introduce a global state library without a demonstrated need.
- Run `npm run lint` and `npm run build` after relevant changes, and fix failures before handoff.
