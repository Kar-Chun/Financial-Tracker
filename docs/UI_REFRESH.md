# Ledgerly UI refresh: route coverage and verification

The current Dashboard, Transactions, and Analytics implementation was the visual baseline. The working tree was clean at the start of this follow-up; no previous redesign was reverted. This pass changes presentation, not the financial model.

## Route inventory

Classification: A = canonical Phase A; B = remaining full-page adaptation; C = form/detail adaptation; D = minor/utility adaptation; E = public/auth.

| Route | Class | Final status / treatment |
| --- | --- | --- |
| / | E | Adapted: serif hero, quieter branding, compact principles list, existing signup/login CTAs and safe areas. |
| /login | E | Adapted: uncluttered form, shared controls, safe-area-aware layout. Existing login and return destination preserved. |
| /signup | E | Adapted: same form system; email-confirmation state preserved. |
| /dashboard | A | Preserved: no page edits. Net Worth, average-only Today's Spending, budget, accounts and three recent rows remain. |
| /transactions | A | Preserved: no page edits. Filters, date groups, editing and keyset pagination remain. Shared control/overlay styling applies. |
| /analytics | A | Preserved: no page edits. Current periods, metrics, charts and category breakdown remain. |
| /transactions/new | C | Adapted: content title, pill-style type control, Note immediately after Amount, shared field spacing. Sticky save, date styling and autocomplete preserved. |
| /accounts | B | Adapted: compact divided account rows, tinted square icons, quieter archived section. Existing editing, valuation and lifecycle actions remain. |
| /budgets | B | Adapted: compact month navigator, overview, two-column guidance, divided category limits and smaller empty/error states. |
| /goals | B | Adapted: open available-cash hero, compact summaries/progress rows, discoverable archived goals. |
| /goals/new | C | Adapted: focused entry title and shared form rhythm; sticky save and safe-area treatment preserved. |
| /goals/:goalId | C | Adapted: open title/progress area, compact guidance and ledger-style allocation history; allocation/edit/archive/restore actions retained. |
| /investments | B | Adapted: open portfolio hero, compact account list, subdued supporting explanation and empty state. |
| /investments/:accountId | C | Adapted: consistent title/value hierarchy, shared value tiles, divided holdings/activity, quieter reconciliation/lifecycle sections. |
| /investments/:accountId/setup | C | Adapted: content-first setup page, shared field rhythm and compact opening-position/preview surfaces. |
| /investments/:accountId/holdings/:holdingId | C | Adapted: content title, compact metrics and divided activity. Existing exact display helpers retained. |
| /assistant | B | Adapted: quieter title, compact suggested-question chips, restrained message surfaces and existing sticky composer. |
| /settings | B | Adapted: native-feeling profile/category/install/history sections; explicit profile label associations; all existing actions retained. |
| * | D | Existing redirect to / unchanged; no invented not-found feature. |
| Route error boundary (no URL) | D | Compact shared surface, typography and safe-area spacing; safe error message/retry behavior unchanged. |
| Auth-loading guard (no URL) | D | Background alignment only; auth gating unchanged. |

There are **18 real page routes**, plus the wildcard redirect and shared utility states. There is no separate /more, /profile, /categories, or Bank/Cash account-detail route in the actual router. No such route was invented.

## Major overlays and embedded workflows

| Workflow | Treatment |
| --- | --- |
| More sheet | Grouped Plan / Money / Insights / Account rows with icons and chevrons; same six destinations. Existing UserMenu still provides profile/session context and Sign out. |
| UserMenu / desktop sidebar | Kept existing navigation and auth/session behavior; no decorative shared header added. |
| Edit Transaction | Shared field, control and dialog adaptation. One existing transaction controller remains shared with Add. |
| Transaction Note autocomplete | Existing compact dropdown and keyboard behavior retained; no service/hook changes. |
| Account create/edit and Simple valuation | Shared field spacing, subtle controls and dialog chrome; all fields retained. |
| Account archive/permanent deletion | Shared alert-dialog adaptation only; zero-value rule, warnings and DELETE confirmation unchanged. |
| Overall/category budget dialogs | Shared form rhythm/controls and dialog shell; limits and copy behavior unchanged. |
| Goal edit and allocation/reduction | Shared form/dialog styling; date, Note, positive human-entered reduction amount and confirmation behavior unchanged. |
| Investment Buy/Sell | Shared dialog/controls plus restrained cash-preview surface; existing precision and validation retained. |
| Holding metadata / manual prices / manual FX / dividend / cash adjustment | Adapted through shared controls, InvestmentActionField and dialog primitives. Existing specialized bodies and scroll areas retained. |
| Category create/rename/archive/restore | Compact hierarchy and Expense/Income filter pills; shared dialog styling; parent/child semantics unchanged. |
| Net Worth history reset | Quieter Settings section and shared alert-dialog treatment; typed RESET guard unchanged. |
| Install/confirmation/error/loading states | Shared navy/control/overlay styling, with compact empty states where appropriate. Existing install behavior retained. |

## Shared system

Reused PageTitle, SectionHeader, FilterPill, insight-surface, ledger-interactive, buttonVariants and existing semantic colors/fonts. Added only ValueSummary (accepts already-formatted text, no financial math) and small CSS utilities for form fields, value heroes and settings sections. Form controls share subtle surfaces. Long labels/amounts wrap rather than forcing width.

Real navigation links use Link plus the existing buttonVariants when button-like styling is needed. They remain links rather than buttons with a substituted element. No generic form engine or new dependency was introduced.

No fake institutions, charts, comparisons, account totals, marketing claims or new navigation destinations were copied from the concept.

## Behavior and performance freeze

No changes to migrations, schema/types, RPCs, services, query hooks, financial logic helpers, auth-provider/cache isolation, router, AppShell, dependency manifests, or PWA build configuration.

- Dashboard still calls bounded get_dashboard_data; its preview still renders at most three transactions.
- Transactions still use 40-row keyset pages and server-side filters.
- Note suggestions remain bounded to three, start at two non-whitespace characters and use the existing debounce/query-key logic.
- Investment decimal parsing/persistence and server-side accounting remain untouched.
- Four mobile tabs, navigation height/safe-area variables and separate FAB positioning are unchanged.
- No new database/API calls, assets, dependencies or environment variables.
- No remote deployment was performed.

## Verification

Baseline: 305 tests in 66 files passed; lint, production/PWA build and git diff --check passed.

Final code verification: 319 tests in 70 files passed; lint, TypeScript/Vite build, PWA generation and git diff --check passed. Fourteen behavioral tests were added across auth submissions, Budgets, Goals, Settings and More. Existing transaction/autocomplete, investment action, lifecycle, auth-isolation and finance regression tests remain passing.

Read-only HTTP smoke checks: all 18 route URLs (representative detail IDs) and a wildcard URL returned HTTP 200 and the local SPA root. These checks validate route delivery, not authenticated browser rendering.

Browser skill setup found no connected browser. **No 390/393/430px screenshots, computed-layout checks, real Safari, standalone PWA or desktop visual verification could be performed.** Component tests and CSS inspection are not a substitute for that final visual pass.

Scope/security checks: no backend/service/query-hook/financial-helper diff; no credential-like additions found in the tracked diff; .env.local remains ignored. Existing static-only PWA configuration is unchanged.

## Manual device pass before release

Use Safari and the installed PWA at available iPhone widths near 390, 393 and 430px, plus desktop:

1. Check public branding, login/signup, confirmation, and keyboard clearance.
2. Check all routes in the inventory for long names, large amounts and horizontal overflow.
3. Add Expense/Income/Transfer; confirm Note suggestions still select Note + valid Category only. Test date selection and sticky Save with the keyboard open.
4. Edit an existing transaction. Check archived labels, filters, load more, Today's Spending drill-through and the three-row Dashboard preview.
5. Open Accounts and investment details. Use only test records to exercise edit, zero-value archive, restore and typed permanent-delete protection.
6. Navigate budget months; edit limits and inspect remaining/over-budget guidance.
7. Create/edit a goal; allocate/reduce, inspect history, archive/restore and over-allocation.
8. Open Detailed setup, Buy/Sell, manual prices/FX and cash-event dialogs. Check long quantities, scrolling and cancel/validation behavior without changing real investment data just to test styling.
9. Use Assistant, clear the conversation and check composer clearance. Check offline messaging without queued writes.
10. Open More, Settings and Sign out. Verify all four tabs, active state, home-indicator safe area, FAB separation, and content scroll clearance.
11. Check Settings profile labels, category hierarchy and destructive confirmations; cancel unless intentionally operating on test history.
12. Reopen the PWA after deployment; confirm the new static shell loads and real financial totals remain unchanged.

## Deployment

Frontend only. Review and commit the UI diff, then push the current branch through the existing Vercel deployment workflow (build: npm run build; output: dist). No Supabase migration, Edge Function deployment or new environment variable is needed. Close/reopen installed PWAs after the normal service-worker update.

Recommended complete-redesign commit message:

`style: unify Ledgerly screens with the Phase A mobile design`

## Files changed in this follow-up

- `src/app/route-error-page.tsx`
- `src/components/layout/mobile-bottom-navigation.test.tsx`
- `src/components/layout/mobile-bottom-navigation.tsx`
- `src/components/shared/finance-ui.tsx`
- `src/components/shared/pwa-install-card.tsx`
- `src/components/ui/alert-dialog.tsx`
- `src/components/ui/dialog.tsx`
- `src/components/ui/input.tsx`
- `src/components/ui/select.tsx`
- `src/components/ui/sheet.tsx`
- `src/components/ui/textarea.tsx`
- `src/features/accounts/account-form-dialog.tsx`
- `src/features/accounts/accounts-view.tsx`
- `src/features/accounts/valuation-dialog.tsx`
- `src/features/assistant/assistant-page.tsx`
- `src/features/auth/auth-form-actions.test.tsx`
- `src/features/auth/auth-page.tsx`
- `src/features/auth/route-guards.tsx`
- `src/features/auth/welcome-page.tsx`
- `src/features/budgets/budget-form-dialogs.tsx`
- `src/features/budgets/budgets-page.test.tsx`
- `src/features/budgets/budgets-page.tsx`
- `src/features/categories/category-management.tsx`
- `src/features/goals/allocation-dialog.tsx`
- `src/features/goals/goal-detail-page.tsx`
- `src/features/goals/goal-form.tsx`
- `src/features/goals/goal-progress.tsx`
- `src/features/goals/goals-page.tsx`
- `src/features/goals/goals-pages.test.tsx`
- `src/features/goals/new-goal-page.tsx`
- `src/features/investments/actions/investment-action-field.tsx`
- `src/features/investments/actions/trade-dialog.tsx`
- `src/features/investments/detailed-investment-setup-page.tsx`
- `src/features/investments/holding-detail-page.tsx`
- `src/features/investments/investment-account-page.tsx`
- `src/features/investments/investments-page.tsx`
- `src/features/settings/net-worth-history-reset.tsx`
- `src/features/settings/settings-page.test.tsx`
- `src/features/settings/settings-page.tsx`
- `src/features/transactions/add-transaction-page.tsx`
- `src/features/transactions/transaction-form-fields.tsx`
- `src/index.css`
- `docs/UI_REFRESH.md` (this inventory and verification record)
