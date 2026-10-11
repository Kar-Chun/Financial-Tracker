import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

import { latestFunctionDefinition } from "@/test/migrations"

const schema = readFileSync(resolve("supabase/migrations/202608240003_add_detailed_investment_ledger.sql"), "utf8")
const investmentRpcNames = [
  "preview_detailed_investment_conversion", "enable_detailed_investment_tracking", "upsert_investment_holding",
  "record_investment_trade", "update_investment_prices", "upsert_manual_fx_rate", "record_investment_cash_event",
]
const ledger = [...investmentRpcNames, "get_detailed_investment_value"]
  .map(latestFunctionDefinition).join("\n")
const integration = ["get_account_summaries", "refresh_snapshot_for_user", "upsert_investment_valuation"]
  .map(latestFunctionDefinition).join("\n")

describe("investment migration security and accounting invariants (static SQL checks)", () => {
  it("derives mutation ownership from auth and validates account/holding relationships", () => {
    for (const name of investmentRpcNames) expect(latestFunctionDefinition(name)).toContain("auth.uid()")
    const trade = latestFunctionDefinition("record_investment_trade")
    expect(trade).toContain("account_id = v_account.id and user_id = v_user_id")
    expect(trade).toContain("for update")
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
    expect(schema).toContain("investment_trades_immutable")
    expect(schema).toContain("investment_cash_events_immutable")
    expect(latestFunctionDefinition("prevent_investment_ledger_mutation")).toContain("raise exception 'Investment ledger entries are immutable. Record a controlled correction instead.'")
    expect(schema).toContain("grant execute on function public.preview_detailed_investment_conversion")
  })

  it("isolates investment activity from ordinary finance ledgers", () => {
    expect(ledger).not.toContain("insert into public.transactions")
    expect(ledger).not.toContain("insert into public.transaction_entries")
    expect(ledger).not.toContain("monthly_budgets")
    expect(ledger).not.toContain("goal_allocations")
    expect(ledger).toContain("perform public.refresh_snapshot_for_user(v_user_id)")
  })
})
