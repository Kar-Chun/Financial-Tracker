# V1.1 manual verification

Apply all migrations first, including `202608230001_add_spending_analytics_and_category_management.sql`. Use disposable users and data. Supabase SQL Editor normally has elevated privileges, so the security checks explicitly simulate `authenticated`.

## Product and calculation checks

As User A:

1. Record base-currency expenses directly under a parent and under two subcategories.
2. Record income and a same-currency transfer in the same period, then soft-delete one expense.
3. Confirm Analytics includes only the remaining expenses, children roll into the parent, percentages are sensible, and income/transfers are absent.
4. Confirm This Month compares the same elapsed prior-month days, Last Month uses complete months, and an empty period has no fake total/chart.
5. Create an expense parent/child, use the child, rename it, and confirm history shows the renamed label.
6. Archive the child and confirm it leaves new expense choices while history keeps it. Restore it and confirm it is selectable again.
7. Confirm duplicate active names, a grandchild, and archiving a parent with active children are rejected.

## User B cannot mutate User A's category

Replace placeholders with disposable Auth/category UUIDs:

```sql
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"USER_B_UUID","role":"authenticated"}', true);

select public.upsert_category(
  p_name := 'Unauthorized rename',
  p_category_type := 'expense',
  p_parent_id := null,
  p_category_id := 'USER_A_CATEGORY_UUID'
);
rollback;
```

Expected: `Category not found.` Repeat with `set_category_archived('USER_A_CATEGORY_UUID', true)` and expect the same result.

## User B cannot use User A's category as parent

```sql
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"USER_B_UUID","role":"authenticated"}', true);

select public.upsert_category(
  p_name := 'Unauthorized child',
  p_category_type := 'expense',
  p_parent_id := 'USER_A_CATEGORY_UUID',
  p_category_id := null
);
rollback;
```

Expected: `Parent category not found.` No category is created.

## Analytics identity comes from the JWT

While simulating User B, call:

```sql
select public.get_spending_analytics(
  p_start_date := date '2026-08-01',
  p_end_date := date '2026-08-31',
  p_previous_start_date := date '2026-07-01',
  p_previous_end_date := date '2026-07-31',
  p_trend_granularity := 'day'
);
```

The result must contain only User B's totals; the function has no `user_id` parameter. Sign in as each user and confirm Analytics/Settings show only that user's data.
