import { readFileSync } from "node:fs"
import { resolve } from "node:path"

import { describe, expect, it } from "vitest"

import { latestFunctionDefinition, migrationSources } from "@/test/migrations"

const migration = migrationSources.join("\n").toLowerCase()
const dashboard = latestFunctionDefinition("get_dashboard_data").toLowerCase()
const assistantRegistry = readFileSync(
  resolve("supabase/functions/financial-assistant/tools/tool-registry.ts"),
  "utf8",
)

function functionDefinition(name: string) {
  return latestFunctionDefinition(name).toLowerCase()
}

describe("authoritative eligible spending (static SQL checks; execute rollback SQL for database behavior)", () => {
  it("defines an authenticated Bank/Cash base-currency expense fact layer", () => {
    const facts = functionDefinition("get_eligible_expense_facts")

    expect(facts).toContain("v_user_id uuid := auth.uid()")
    expect(facts).not.toContain("p_user_id")
    expect(facts).toContain("transaction_record.user_id = v_user_id")
    expect(facts).toContain("transaction_record.transaction_type = 'expense'")
    expect(facts).toContain("transaction_record.deleted_at is null")
    expect(facts).toContain("transaction_record.transaction_date between p_start_date and p_end_date")
    expect(facts).toContain("account.user_id = v_user_id")
    expect(facts).toContain("account.currency_code = v_base_currency")
    expect(facts).toContain("(-entry.amount_minor)::bigint")
    expect(facts).toContain("coalesce(parent.id, category.id)")
    expect(facts).not.toContain("archived_at is null")
    expect(facts).toContain("account.account_type in ('bank', 'cash')")
  })

  it("migrates Analytics, Budgets, Dashboard, and AI spending reads", () => {
    const analytics = functionDefinition("get_spending_analytics")
    expect(analytics).toContain("from public.get_eligible_expense_facts(p_start_date, p_end_date)")
    expect(analytics).toContain("from public.get_eligible_expense_facts(p_previous_start_date, p_previous_end_date)")
    expect(functionDefinition("get_monthly_budget_summary")).toContain(
      "from public.get_eligible_expense_facts(p_month_start, v_month_end)",
    )
    expect(functionDefinition("get_ai_financial_overview")).toContain(
      "from public.get_eligible_expense_facts(v_month_start, v_today)",
    )
    expect(dashboard).toContain("v_analytics := public.get_spending_analytics(")
    expect(assistantRegistry).toContain('rpc(context, "get_spending_analytics"')
    expect(assistantRegistry).toContain('rpc(context, "get_monthly_budget_summary"')
  })

  it("keeps consumer-specific date windows and foreign warning semantics", () => {
    const analytics = functionDefinition("get_spending_analytics")
    const budget = functionDefinition("get_monthly_budget_summary")
    const overview = functionDefinition("get_ai_financial_overview")

    expect(analytics).toContain("p_start_date, p_end_date")
    expect(analytics).toContain("p_previous_start_date, p_previous_end_date")
    expect(budget).toContain("p_month_start, v_month_end")
    expect(overview).toContain("v_month_start, v_today")
    expect(analytics).toContain("'excluded_foreign_expense_count'")
    expect(budget).toContain("'excluded_foreign_expense_count'")
    expect(overview).toContain("transaction_record.transaction_type in ('income', 'expense')")
    expect(overview).toContain("'excluded_foreign_transaction_count'")
  })

  it("keeps the fact layer internal and search-path hardened", () => {
    expect(functionDefinition("get_eligible_expense_facts")).toContain("security definer\nset search_path = ''")
    expect(migration).toMatch(/revoke all on function public\.get_eligible_expense_facts\(date, date\)\s+from public, anon, authenticated/)
    expect(migration).not.toContain("grant execute on function public.get_eligible_expense_facts")
    expect(migration).not.toMatch(/\bexecute\s+(?:format\s*\(|\()/u)
  })
})
