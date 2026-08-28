# Net Worth history reset verification

Apply `202608280001_add_net_worth_history_reset.sql` to a confirmed test project, then use two authenticated users.

1. Give User A several `net_worth_snapshots` rows and record their current account, transaction, investment, budget, and savings-goal row counts.
2. Give User B at least two snapshot rows and record their IDs and values.
3. As User A, call `select public.reset_net_worth_history();` through the authenticated client/RPC.
4. Confirm User A now has exactly one snapshot for their profile-timezone local date and that its total matches `public.refresh_net_worth_snapshot()` / current Dashboard totals.
5. Confirm every recorded non-snapshot row count and value for User A is unchanged.
6. Confirm User B's snapshot rows are unchanged.
7. Call the RPC again as User A and confirm there is still exactly one snapshot for today.
8. Remove a required price or direct FX rate from an active Detailed investment in test data. Confirm the RPC rejects before deleting User A's existing history.
9. Call the RPC without an authenticated session and confirm it is rejected.
10. In the app, go offline and confirm Settings blocks the reset without queueing or replaying it.
