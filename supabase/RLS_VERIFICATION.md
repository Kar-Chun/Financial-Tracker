# Manual RLS verification

Run this after applying all migrations. Use disposable test accounts and data only.

## Prepare two users

1. Sign up User A and User B through the application. Confirm both emails if confirmation is enabled.
2. Sign in as User A and create a bank account, cash account, expense category transaction, and income transaction.
3. In Supabase Dashboard, copy the two user UUIDs from Authentication > Users and User A's account/category UUIDs from the Table Editor. Do not copy any access tokens or secret keys.

The SQL Editor normally runs with elevated privileges and bypasses RLS. The blocks below explicitly switch to the `authenticated` role and set the simulated JWT subject. Replace only the placeholder UUIDs.

## User B cannot select User A's data

```sql
begin;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"USER_B_UUID","role":"authenticated"}',
  true
);

select count(*) as visible_user_a_accounts
from public.accounts
where user_id = 'USER_A_UUID';

select count(*) as visible_user_a_transactions
from public.transactions
where user_id = 'USER_A_UUID';
rollback;
```

Both counts must be `0`.

## User B cannot update User A's account

Run this as a separate block because the expected permission error aborts the transaction:

```sql
begin;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"USER_B_UUID","role":"authenticated"}',
  true
);

update public.accounts
set name = 'Unauthorized change'
where id = 'USER_A_ACCOUNT_UUID';
rollback;
```

Expected result: permission denied, or zero rows affected. Confirm User A's account name did not change.

## User B cannot reference User A's account in an RPC

```sql
begin;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"USER_B_UUID","role":"authenticated"}',
  true
);

select public.upsert_financial_transaction(
  p_transaction_type := 'expense',
  p_amount_minor := 100,
  p_account_id := 'USER_A_ACCOUNT_UUID',
  p_transaction_date := current_date,
  p_category_id := 'USER_A_CATEGORY_UUID'
);
rollback;
```

Expected result: `Source account not found.` No transaction or entry may be created.

## User B cannot reference User A's category

Use a bank/cash account owned by User B so the account check succeeds first:

```sql
begin;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"USER_B_UUID","role":"authenticated"}',
  true
);

select public.upsert_financial_transaction(
  p_transaction_type := 'expense',
  p_amount_minor := 100,
  p_account_id := 'USER_B_ACCOUNT_UUID',
  p_transaction_date := current_date,
  p_category_id := 'USER_A_CATEGORY_UUID'
);
rollback;
```

Expected result: `Category not found.` No transaction or entry may be created.

Finally, sign back in as each user through the application and confirm only that user's accounts, transactions, valuations, snapshots, and profile are visible.
