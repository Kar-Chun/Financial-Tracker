# V1.5 savings-goal verification

Apply `migrations/202608240002_add_savings_goals.sql` to the confirmed Supabase project, then test with normal authenticated sessions. Never put a service-role key in the browser.

## Accounting isolation

1. Record User A's account balances, transaction/entry counts, current net worth snapshot, monthly budget spending, Analytics spending, and cash flow.
2. Create a goal and allocate, reduce, archive, and restore it.
3. Confirm none of the recorded financial values or row counts changed. Only `savings_goals` and `goal_allocations` should change; goal RPCs never call transaction or snapshot functions.
4. Confirm base-currency active Bank and Cash equal `available_cash_minor`; investments, archived accounts, and unconverted foreign Bank/Cash are excluded.
5. Over-allocate and confirm it produces a negative `unallocated_cash_minor` warning without changing account balances.

## Ownership and RLS

1. Create User A and User B with separate normal browser sessions.
2. As User A, create a goal and allocation history.
3. As User B, query `savings_goals` and `goal_allocations`; confirm no User A rows are returned.
4. As User B, attempt direct insert/update/delete operations; confirm table privileges/RLS reject them.
5. As User B, call `get_savings_goal_detail`, `upsert_savings_goal`, `set_savings_goal_archived`, and `record_goal_allocation` using User A's goal ID. Confirm every operation is rejected or returns no data and User A's rows remain unchanged.
6. Confirm create RPC arguments contain no `user_id` or `currency_code`, and the saved currency comes from User B's own profile.
7. Attempt a reduction greater than the current allocation and two concurrent reductions. Confirm the goal-row lock and insert trigger prevent a negative cumulative allocation.
8. Archive a positively allocated goal. Confirm its history remains readable, its amount leaves the active allocation total, and restoring includes it again.

