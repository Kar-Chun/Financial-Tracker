# V1.4 budget verification

Apply `migrations/202608240001_add_monthly_budgets.sql` to the confirmed Supabase project, then use two normal authenticated browser sessions. Do not use a service-role key in the frontend.

1. As User A, call `upsert_monthly_budget('2026-08-01', 100000)` and add parent expense category limits through the Budgets page.
2. Record a direct Food expense and a Food child-category expense. Confirm both appear in Food spending and overall spending.
3. Record income and a transfer, soft-delete an expense, and use a foreign-currency account. Confirm none changes eligible budget spending.
4. Copy August to September. Confirm only limits are copied, September spending starts from its own transactions, and a second copy is rejected.
5. Archive a budgeted category. Confirm August remains readable and copying skips that category.
6. As User B, query both budget tables and confirm no User A rows are returned. Attempt updates/inserts directly and confirm browser-role permissions/RLS reject them.
7. As User B, call category-budget and copy RPCs with User A category/month knowledge. Confirm ownership validation rejects the operation and no User A data changes.
8. At a profile-timezone month boundary, confirm the current month, elapsed days, remaining days including today, safe daily amount, and pace status are correct.

The RPCs do not accept a user ID. Inspect `monthly_budgets` and `category_budgets` after each failed operation to confirm there are no cross-user or partial writes.
