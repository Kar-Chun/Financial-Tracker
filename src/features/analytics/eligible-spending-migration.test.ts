import { readFileSync } from "node:fs"
import { resolve } from "node:path"

import { describe, expect, it } from "vitest"

const migration = readFileSync(
  resolve("supabase/migrations/202609040002_centralize_eligible_spending.sql"),
  "utf8",
).toLowerCase()
const dashboardMigration = readFileSync(
  resolve("supabase/migrations/202609040001_add_bounded_dashboard_and_transaction_reads.sql"),
  "utf8",
).toLowerCase()
const assistantRegistry = readFileSync(
  resolve("supabase/functions/financial-assistant/tools/tool-registry.ts"),
  "utf8",
)

function functionDefinition(name: string) {
  const start = migration.indexOf(`create or replace function public.${name}`)
  const next = migration.indexOf("create or replace function public.", start + 1)
  expect(start, `${name} must be defined`).toBeGreaterThanOrEqual(0)
  return migration.slice(start, next < 0 ? migration.length : next)
}

describe("authoritative eligible-spending migration", () => {
  it("defines one authenticated base-currency expense fact layer", () => {
    const facts = functionDefinition("get_eligible_expense_facts")

    expect(facts).toContain("v_user_id uuid := auth.uid()")
    expect(facts).not.toContain("p_user_id")
    expect(facts).toContain("transaction_record.user_id = v_user_id")
    expect(facts).toContain("transaction_record.transaction_type = 'expense'")
    expect(facts).toContain("transaction_record.deleted_at is null")
    expect(facts).toContain("account.user_id = v_user_id")
    expect(facts).toContain("account.currency_code = v_base_currency")
    expect(facts).toContain("(-entry.amount_minor)::bigint")
    expect(facts).toContain("coalesce(parent.id, category.id)")
    expect(facts).not.toContain("archived_at is null")
    expect(facts).not.toContain("account_type")
  })

  it("migrates Analytics, Budgets, Dashboard, and AI spending reads", () => {
    expect(functionDefinition("get_spending_analytics").match(/from public\.get_eligible_expense_facts/g)).toHaveLength(2)
    expect(functionDefinition("get_monthly_budget_summary")).toContain(
      "from public.get_eligible_expense_facts(p_month_start, v_month_end)",
    )
    expect(functionDefinition("get_ai_financial_overview")).toContain(
      "from public.get_eligible_expense_facts(v_month_start, v_today)",
    )
    expect(dashboardMigration).toContain("v_analytics := public.get_spending_analytics(")
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
    expect(migration).toContain("security definer\nset search_path = ''")
    expect(migration).toContain(
      "revoke all on function public.get_eligible_expense_facts(date, date)\n  from public, anon, authenticated",
    )
    expect(migration).not.toContain("grant execute on function public.get_eligible_expense_facts")
    expect(migration).not.toMatch(/\bexecute\s+(?:format\s*\(|\()/u)
  })
})

type ExpenseFixture = {
  date: string
  transactionType: "expense" | "income" | "transfer" | "refund" | "adjustment"
  deleted: boolean
  currency: string
  entryMinor: number
  categoryId: string | null
  parentCategoryId: string | null
  categoryArchived?: boolean
}

const fixtures: ExpenseFixture[] = [
  { date: "2026-09-02", transactionType: "expense", deleted: false, currency: "SGD", entryMinor: -1_000, categoryId: "food", parentCategoryId: null },
  { date: "2026-09-03", transactionType: "expense", deleted: false, currency: "SGD", entryMinor: -500, categoryId: "eating-out", parentCategoryId: "food" },
  { date: "2026-09-04", transactionType: "expense", deleted: false, currency: "SGD", entryMinor: -250, categoryId: "archived", parentCategoryId: null, categoryArchived: true },
  { date: "2026-09-01", transactionType: "expense", deleted: false, currency: "SGD", entryMinor: -700, categoryId: null, parentCategoryId: null },
  { date: "2026-08-31", transactionType: "expense", deleted: false, currency: "SGD", entryMinor: -900, categoryId: "food", parentCategoryId: null },
  { date: "2026-09-02", transactionType: "income", deleted: false, currency: "SGD", entryMinor: 5_000, categoryId: null, parentCategoryId: null },
  { date: "2026-09-02", transactionType: "transfer", deleted: false, currency: "SGD", entryMinor: -2_000, categoryId: null, parentCategoryId: null },
  { date: "2026-09-02", transactionType: "refund", deleted: false, currency: "SGD", entryMinor: 100, categoryId: "food", parentCategoryId: null },
  { date: "2026-09-02", transactionType: "adjustment", deleted: false, currency: "SGD", entryMinor: -100, categoryId: null, parentCategoryId: null },
  { date: "2026-09-02", transactionType: "expense", deleted: true, currency: "SGD", entryMinor: -300, categoryId: "food", parentCategoryId: null },
  { date: "2026-09-02", transactionType: "expense", deleted: false, currency: "USD", entryMinor: -400, categoryId: "food", parentCategoryId: null },
]

function eligibleFacts(startDate: string, endDate: string) {
  return fixtures
    .filter((item) => isEligible(item, startDate, endDate))
    .map((item) => ({
      amountMinor: -item.entryMinor,
      rootCategoryId: item.parentCategoryId ?? item.categoryId,
      categoryArchived: item.categoryArchived ?? false,
    }))
}

function isEligible(item: ExpenseFixture, startDate: string, endDate: string) {
  return item.transactionType === "expense"
    && !item.deleted
    && item.currency === "SGD"
    && item.date >= startDate
    && item.date <= endDate
}

describe("eligible-spending regression fixture", () => {
  it("produces one identical total for every same-period consumer", () => {
    const facts = eligibleFacts("2026-09-01", "2026-09-30")
    const total = facts.reduce((sum, item) => sum + item.amountMinor, 0)
    const consumerTotals = {
      analytics: total,
      budgetActual: total,
      dashboardExpenses: total,
      aiMonthlyExpenses: total,
    }

    expect(consumerTotals).toEqual({
      analytics: 2_450,
      budgetActual: 2_450,
      dashboardExpenses: 2_450,
      aiMonthlyExpenses: 2_450,
    })
  })

  it("excludes income, transfers, refunds, adjustments, deleted expenses, and foreign expenses", () => {
    const excluded = fixtures.filter((item) =>
      item.transactionType !== "expense" || item.deleted || item.currency !== "SGD",
    )

    expect(excluded.map((item) => item.transactionType)).toEqual([
      "income",
      "transfer",
      "refund",
      "adjustment",
      "expense",
      "expense",
    ])
    expect(excluded.every((item) => !isEligible(item, "2026-09-01", "2026-09-30"))).toBe(true)
  })

  it("rolls child spending into its parent and retains archived historical categories", () => {
    const facts = eligibleFacts("2026-09-01", "2026-09-30")
    const byParent = Map.groupBy(facts, (fact) => fact.rootCategoryId)

    expect(byParent.get("food")?.reduce((sum, item) => sum + item.amountMinor, 0)).toBe(1_500)
    expect(byParent.get("archived")?.[0]).toMatchObject({ amountMinor: 250, categoryArchived: true })
  })

  it("respects the caller's calendar boundary without inventing timestamp conversion", () => {
    expect(eligibleFacts("2026-09-01", "2026-09-30").some((item) => item.amountMinor === 700)).toBe(true)
    expect(eligibleFacts("2026-08-01", "2026-08-31").some((item) => item.amountMinor === 900)).toBe(true)
    expect(eligibleFacts("2026-09-01", "2026-09-30").some((item) => item.amountMinor === 900)).toBe(false)
  })
})
