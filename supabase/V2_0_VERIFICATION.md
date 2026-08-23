# V2 detailed investment verification

Apply `202608240003_add_detailed_investment_ledger.sql` and then `202608240004_integrate_detailed_investment_values.sql` to a confirmed test project. Use publishable-key browser sessions; never put a service-role key in the frontend.

## Accounting flow

1. Confirm an existing Simple account still equals its latest manual valuation plus only transfers after that valuation.
2. Create a USD investment account. Set a Simple value, then choose **Enable detailed tracking**.
3. Opening state: US$1,000 broker cash and 2 CSPX at US$500 average cost / US$550 current price. Preview and confirm US$2,100 native value.
4. Confirm historical Simple valuations remain stored but are no longer included in this account's current value.
5. Set direct USD → SGD to 1.28. Confirm native US$2,100 and base S$2,688; remove/omit FX in a fresh account and confirm no 1:1 base value is shown.
6. Buy 0.5 CSPX at US$560 with US$2 fee. Confirm cash falls US$282, quantity becomes 2.5, basis includes the fee, and ordinary transactions/budgets/Analytics do not change.
7. Sell 0.25 CSPX. Confirm quantity, proceeds less fee, weighted-average basis removal, and realised gain. Attempt an oversell and confirm rejection.
8. Attempt a buy above broker cash and confirm rejection. Repeat from two sessions if practical to confirm account/holding locking prevents concurrent overspend/oversell.
9. Transfer same-currency cash into the Detailed account. Confirm source falls, broker cash rises, and net worth is neutral. Confirm a pre-boundary transfer is not added again.
10. Record a dividend. Confirm broker cash increases while ordinary monthly income remains unchanged.
11. Update a holding price and manual FX rate. Confirm represented net worth and today's snapshot update in place, with at most one snapshot for the local day.
12. Confirm Budget, Analytics, Goals, and unrelated account balances are unchanged by opening positions, buys, sells, dividends, prices, and FX except that consolidated net worth uses the represented portfolio value exactly once.

## Two-user/RLS checks

Create User A and User B. Under User A create/convert a Detailed account and add a holding, trade, price, cash event, and FX rate. With User B's authenticated browser session:

1. Direct selects of every new table return no User A rows.
2. `get_detailed_investment_account(User A account id)` is rejected.
3. Conversion, holding, buy/sell, price, dividend/adjustment RPCs using User A IDs are rejected.
4. User B cannot update User A's FX pair or spoof `user_id` (mutation RPCs expose no user-id argument).
5. Direct insert/update/delete on ledger tables is denied; only validated RPCs can write.

Also inspect policies in Supabase Database > Policies and confirm RLS is enabled for `manual_fx_rates`, `investment_holdings`, `investment_trades`, `investment_prices`, and `investment_cash_events`.
