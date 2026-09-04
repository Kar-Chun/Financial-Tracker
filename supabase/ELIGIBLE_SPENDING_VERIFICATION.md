# Eligible spending verification

Apply `migrations/202609040002_centralize_eligible_spending.sql` only after every earlier migration. Use disposable authenticated users and normal JWT-backed calls; the internal fact function is intentionally not browser-executable.

For User A, create in one calendar month:

- a base-currency expense directly under an expense parent;
- a base-currency expense under one of its children;
- an expense using a category that is subsequently archived;
- income, a transfer, a refund, and an adjustment;
- an expense that is subsequently soft-deleted;
- an expense in a foreign-currency account;
- expenses on each side of the user's profile-timezone month boundary.

For the same completed date range, verify that Analytics total spending, Budget `spent_minor`, Dashboard monthly expenses, and the AI spending/overview read model return the same eligible expense total. Confirm the parent total includes direct and child spending, the archived historical category remains readable, and income/transfers/refunds/adjustments/deleted/foreign expenses remain excluded. Confirm existing foreign-exclusion warning counts retain their current labels.

As User B, call Analytics, Budget, Dashboard, and AI overview RPCs and confirm no User A facts appear. Also confirm `public.get_eligible_expense_facts(date, date)` cannot be invoked directly by the authenticated browser role. Inspect grants and verify only the existing public read RPCs are executable.
