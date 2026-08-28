import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const migration = readFileSync(resolve("supabase/migrations/202608280001_add_net_worth_history_reset.sql"), "utf8")
const schema = readFileSync(resolve("supabase/migrations/202608220001_create_finance_schema.sql"), "utf8")

describe("Net Worth history reset migration", () => {
  it("derives ownership from auth.uid and exposes only the authenticated no-argument RPC", () => {
    expect(migration).toContain("v_user_id uuid := auth.uid()")
    expect(migration).toContain("security definer\nset search_path = ''")
    expect(migration).not.toContain("p_user_id")
    expect(migration).toContain("grant execute on function public.reset_net_worth_history() to authenticated")
    expect(migration).not.toMatch(/grant\s+delete\s+on\s+table/iu)
  })

  it("deletes only the caller's snapshots and leaves every financial table untouched", () => {
    expect(migration).toContain("delete from public.net_worth_snapshots snapshot")
    expect(migration).toContain("where snapshot.user_id = v_user_id")
    for (const table of [
      "accounts", "transactions", "transaction_entries", "investment_valuations",
      "investment_holdings", "investment_trades", "investment_prices", "investment_cash_events",
      "monthly_budgets", "savings_goals", "goal_allocations",
    ]) {
      expect(migration).not.toContain(`delete from public.${table}`)
      expect(migration).not.toContain(`update public.${table}`)
    }
  })

  it("validates detailed values before deletion and reuses authoritative snapshot generation", () => {
    const validation = migration.indexOf("represented.base_value_available")
    const deletion = migration.indexOf("delete from public.net_worth_snapshots")
    expect(validation).toBeGreaterThan(-1)
    expect(validation).toBeLessThan(deletion)
    expect(migration).toContain("public.get_detailed_investment_value(account.id, v_local_date)")
    expect(migration).toContain("v_snapshot_id := public.refresh_snapshot_for_user(v_user_id)")
    expect(schema).toContain("unique (user_id, snapshot_date)")
  })
})
