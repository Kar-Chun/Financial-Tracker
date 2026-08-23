import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const ledger = readFileSync(resolve("supabase/migrations/202608240003_add_detailed_investment_ledger.sql"), "utf8")
const integration = readFileSync(resolve("supabase/migrations/202608240004_integrate_detailed_investment_values.sql"), "utf8")

describe("V2 investment migration security and accounting invariants", () => {
  it("enables ownership RLS on every new user financial table", () => {
    for (const table of ["manual_fx_rates", "investment_holdings", "investment_trades", "investment_prices", "investment_cash_events"]) {
      expect(ledger).toContain(`alter table public.${table} enable row level security`)
      expect(ledger).toContain(`create policy ${table}_select_own`)
    }
    expect(ledger).not.toMatch(/grant\s+(insert|update|delete|all)\s+on table/iu)
  })

  it("derives mutation ownership from auth and validates account/holding relationships", () => {
    expect(ledger.match(/auth\.uid\(\)/gu)?.length).toBeGreaterThanOrEqual(8)
    expect(ledger).toContain("account_id = v_account.id and user_id = v_user_id")
    expect(ledger).toContain("for update")
  })

  it("keeps Simple and Detailed formulas mutually exclusive", () => {
    expect(integration).toContain("account.investment_tracking_mode = 'detailed'")
    expect(integration).toContain("account.investment_tracking_mode = 'simple'")
    expect(integration).toContain("coalesce(latest.native_value_minor, 0) + later_transfers.amount_minor")
    expect(integration).toContain("Detailed accounts are valued from broker cash and holdings")
  })

  it("uses only post-boundary transfers in detailed broker cash", () => {
    expect(ledger).toContain("transaction_record.transaction_date > context.detailed_started_on")
    expect(ledger).toContain("transaction_record.created_at > context.detailed_started_at")
  })

  it("uses direct manual FX and never a foreign 1:1 fallback", () => {
    expect(ledger).toContain("fx.from_currency = context.currency_code")
    expect(ledger).toContain("fx.to_currency = context.base_currency")
    expect(ledger).toContain("when rate is not null then round")
    expect(ledger).toContain("else null")
  })

  it("keeps immutable activity ledgers and authenticated RPC-only writes", () => {
    expect(ledger).toContain("investment_trades_immutable")
    expect(ledger).toContain("investment_cash_events_immutable")
    expect(ledger).toContain("raise exception 'Investment ledger entries are immutable. Record a controlled correction instead.'")
    expect(ledger).toContain("grant execute on function public.preview_detailed_investment_conversion")
  })

  it("isolates investment activity from ordinary finance ledgers", () => {
    expect(ledger).not.toContain("insert into public.transactions")
    expect(ledger).not.toContain("insert into public.transaction_entries")
    expect(ledger).not.toContain("monthly_budgets")
    expect(ledger).not.toContain("goal_allocations")
    expect(ledger).toContain("perform public.refresh_snapshot_for_user(v_user_id)")
  })
})
