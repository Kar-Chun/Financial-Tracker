import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const migration = readFileSync(resolve("supabase/migrations/202608270001_add_safe_account_lifecycle.sql"), "utf8")
const investmentIntegration = readFileSync(resolve("supabase/migrations/202608240004_integrate_detailed_investment_values.sql"), "utf8")

describe("safe account lifecycle migration", () => {
  it("keeps archive on the existing authoritative represented-value formulas", () => {
    expect(migration).toContain("from public.get_account_summaries() summary")
    expect(migration).toContain("from public.get_detailed_investment_value(v_account.id, v_local_date) represented")
    expect(migration).toContain("v_account.opening_balance_minor")
    expect(migration).toContain("transaction_record.deleted_at is null")
    expect(migration).toContain("Account represented value must be zero before archiving.")
  })

  it("derives archive, restore, and deletion ownership from auth.uid", () => {
    expect(migration.match(/v_user_id uuid := auth\.uid\(\)/g)).toHaveLength(3)
    expect(migration.match(/account\.user_id = v_user_id/g)?.length).toBeGreaterThanOrEqual(4)
    expect(migration.match(/security definer\nset search_path = ''/g)).toHaveLength(3)
    expect(migration).not.toContain("p_user_id")
  })

  it("blocks active financial history before permanent deletion", () => {
    const activeCheck = migration.indexOf("transaction_record.deleted_at is null")
    const accountDelete = migration.indexOf("delete from public.accounts account")
    expect(activeCheck).toBeGreaterThan(-1)
    expect(accountDelete).toBeGreaterThan(activeCheck)
    expect(migration).toContain("Account is used by %s active transaction%s.")
    expect(migration).not.toContain("delete from public.transactions transaction_record\n    where transaction_record.deleted_at is null")
  })

  it("purges only complete already-soft-deleted transaction structures", () => {
    expect(migration).toContain("transaction_record.deleted_at is not null")
    expect(migration).toContain("delete from public.transactions transaction_record")
    expect(migration).not.toContain("delete from public.transaction_entries")
  })

  it("removes only target-account Simple and Detailed investment data", () => {
    for (const table of [
      "investment_prices",
      "investment_trades",
      "investment_cash_events",
      "investment_holdings",
      "investment_valuations",
    ]) {
      expect(migration).toContain(`delete from public.${table}`)
    }
    expect(migration).toContain("trade.account_id = v_account.id")
    expect(migration).toContain("cash_event.account_id = v_account.id")
    expect(migration).toContain("holding.account_id = v_account.id")
    expect(migration).not.toContain("delete from public.manual_fx_rates")
    expect(migration).not.toContain("delete from public.categories")
    expect(migration).not.toContain("delete from public.monthly_budgets")
    expect(migration).not.toContain("delete from public.savings_goals")
  })

  it("preserves append-only ledgers except inside the exact scoped delete RPC", () => {
    expect(migration).toContain("current_setting('finance_tracker.account_delete_user_id', true) = old.user_id::text")
    expect(migration).toContain("current_setting('finance_tracker.account_delete_account_id', true) = old.account_id::text")
    expect(migration).toContain("raise exception 'Investment ledger entries are immutable")
  })

  it("refreshes today's snapshot but does not rewrite historical snapshots", () => {
    expect(migration.match(/perform public\.refresh_snapshot_for_user\(v_user_id\)/g)).toHaveLength(3)
    expect(migration).not.toContain("delete from public.net_worth_snapshots")
    expect(migration).not.toContain("update public.net_worth_snapshots")
  })

  it("keeps direct table deletes unavailable and grants only the lifecycle RPCs", () => {
    expect(migration).toContain("grant execute on function public.restore_account(uuid) to authenticated")
    expect(migration).toContain("grant execute on function public.delete_account_permanently(uuid) to authenticated")
    expect(migration).not.toMatch(/grant\s+delete\s+on\s+table/iu)
    expect(migration).not.toMatch(/grant\s+all\s+on\s+table/iu)
  })

  it("keeps archived accounts out of active summaries and selectors", () => {
    expect(investmentIntegration).toContain("where account.user_id = auth.uid() and account.archived_at is null")
  })
})
