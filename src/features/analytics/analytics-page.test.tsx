// @vitest-environment jsdom

import { fireEvent, render, screen, within } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { AnalyticsPage } from "@/features/analytics/analytics-page"
import type { SpendingAnalytics } from "@/features/analytics/analytics-types"

const hooks = vi.hoisted(() => ({ analytics: vi.fn() }))
vi.mock("@/features/analytics/analytics-hooks", () => ({ useSpendingAnalytics: hooks.analytics }))
vi.mock("@/features/auth/profile-service", () => ({ useProfile: () => ({ data: { timezone: "Asia/Singapore", base_currency: "SGD" } }) }))

const data: SpendingAnalytics = {
  period: { start_date: "2026-09-01", end_date: "2026-09-03", previous_start_date: "2026-08-01", previous_end_date: "2026-08-03", trend_granularity: "day" },
  summary: { total_spent_minor: 3_000, average_daily_spend_minor: 1_000, expense_count: 2, largest_category_name: "Food" },
  previous_summary: { total_spent_minor: 2_000, expense_count: 1 },
  categories: [{ category_id: "food", name: "Food", amount_minor: 3_000, previous_amount_minor: 2_000, direct_amount_minor: 1_000, subcategories: [{ category_id: "drinks", name: "Drinks", amount_minor: 2_000 }] }],
  trend: [{ bucket_date: "2026-09-01", amount_minor: 1_000 }, { bucket_date: "2026-09-02", amount_minor: 0 }, { bucket_date: "2026-09-03", amount_minor: 2_000 }],
  excluded_foreign_expense_count: 0,
}

beforeEach(() => {
  hooks.analytics.mockReset().mockReturnValue({ data })
})

describe("Analytics presentation", () => {
  it("renders the returned metrics and keeps category details accessible as text", () => {
    render(<AnalyticsPage />)
    expect(screen.getByRole("heading", { name: "Analytics" })).toBeInTheDocument()
    expect(screen.getAllByText("$30.00").length).toBeGreaterThan(0)
    expect(screen.getByText("$10.00")).toBeInTheDocument()
    expect(screen.getByText("Expense Count")).toBeInTheDocument()
    expect(screen.getByText("2")).toBeInTheDocument()
    expect(screen.getByRole("img", { name: "Bar chart of spending over time" })).toBeInTheDocument()
    const donut = screen.getByRole("img", { name: "Donut chart of spending by category" })
    expect(within(donut).getByText("$30.00")).toBeInTheDocument()
    expect(within(donut).getByText("Total spent")).toBeInTheDocument()
    const category = screen.getByRole("button", { name: /Food.*100%/ })
    fireEvent.click(category)
    expect(category).toHaveAttribute("aria-expanded", "true")
    expect(screen.getByText("Food (direct)")).toBeInTheDocument()
    expect(screen.getByText("Drinks")).toBeInTheDocument()
    expect(screen.getByText("$20.00")).toBeInTheDocument()
    fireEvent.click(category)
    expect(screen.queryByText("Food (direct)")).not.toBeInTheDocument()
  })

  it.each([
    ["This Month", "this_month"], ["Last Month", "last_month"],
    ["Last 3 Months", "last_3_months"], ["Last 6 Months", "last_6_months"], ["This Year", "this_year"],
  ])("keeps the existing %s period contract", (label, preset) => {
    render(<AnalyticsPage />)
    fireEvent.click(screen.getByRole("button", { name: label }))
    expect(screen.getByRole("button", { name: label })).toHaveAttribute("aria-pressed", "true")
    expect(hooks.analytics).toHaveBeenLastCalledWith(preset, expect.objectContaining({ startDate: expect.any(String), endDate: expect.any(String) }))
    expect(screen.getByRole("group", { name: "Analytics period" }).querySelectorAll("button")).toHaveLength(5)
  })

  it("keeps the no-spending state and exclusion explanation", () => {
    hooks.analytics.mockReturnValue({ data: { ...data, summary: { ...data.summary, total_spent_minor: 0 }, excluded_foreign_expense_count: 2 } })
    render(<AnalyticsPage />)
    expect(screen.getByText("No base-currency spending recorded for this period.")).toBeInTheDocument()
    expect(screen.getByText(/2 foreign-currency expenses were excluded/)).toBeInTheDocument()
    expect(screen.queryByRole("img")).not.toBeInTheDocument()
  })

  it("shows a compact ordinary empty state and retains period controls", () => {
    hooks.analytics.mockReturnValue({ data: { ...data, summary: { ...data.summary, total_spent_minor: 0 } } })
    render(<AnalyticsPage />)
    expect(screen.getByText("No spending recorded for this period yet.")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Last Month" })).toBeEnabled()
    expect(screen.queryByRole("img", { name: /Donut/ })).not.toBeInTheDocument()
  })

  it("lists all categories in spending order with exact amounts and presentation percentages", () => {
    const names = ["A very long historical category name that must remain readable", "Shopping", "Other", "Education", "Transport", "Entertainment"]
    const amounts = [10499, 10037, 5250, 2773, 2000, 780]
    const categories = names.map((name, index) => ({
      category_id: name, name, amount_minor: amounts[index], previous_amount_minor: 0,
      direct_amount_minor: amounts[index], subcategories: [],
    }))
    hooks.analytics.mockReturnValue({ data: { ...data, categories: [...categories].reverse(), summary: { ...data.summary, total_spent_minor: 31339 } } })
    render(<AnalyticsPage />)
    const rows = within(screen.getByRole("list", { name: "Category breakdown" })).getAllByRole("listitem")
    expect(rows).toHaveLength(6)
    names.forEach((name, index) => expect(within(rows[index]).getByText(name)).toBeInTheDocument())
    expect(within(rows[0]).getByText("$104.99")).toBeInTheDocument()
    expect(within(rows[0]).getByText("33.5%")).toBeInTheDocument()
    expect(within(rows[5]).getByText("$7.80")).toBeInTheDocument()
    expect(within(rows[5]).getByText("2.5%")).toBeInTheDocument()
    expect(within(screen.getByRole("img", { name: /Donut/ })).getByText("$313.39")).toBeInTheDocument()
    expect(screen.getByText("Period insights")).toBeInTheDocument()
  })

  it("updates the donut total and category list together when the period changes", () => {
    const previous = { ...data, categories: [{ ...data.categories[0], name: "Transport", amount_minor: 500, direct_amount_minor: 500, subcategories: [] }], summary: { ...data.summary, total_spent_minor: 500 } }
    hooks.analytics.mockImplementation((preset: string) => ({ data: preset === "last_month" ? previous : data }))
    render(<AnalyticsPage />)
    expect(within(screen.getByRole("img", { name: /Donut/ })).getByText("$30.00")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Last Month" }))
    expect(within(screen.getByRole("img", { name: /Donut/ })).getByText("$5.00")).toBeInTheDocument()
    const list = screen.getByRole("list", { name: "Category breakdown" })
    expect(within(list).getByText("Transport")).toBeInTheDocument()
    expect(within(list).queryByText("Food")).not.toBeInTheDocument()
    expect(within(list).getByText("100%")).toBeInTheDocument()
  })

  it("keeps tiny categories and totals parent amounts without double-counting children", () => {
    hooks.analytics.mockReturnValue({ data: { ...data, categories: [
      ...data.categories,
      { category_id: "tiny", name: "Tiny category", amount_minor: 1, previous_amount_minor: 0, direct_amount_minor: 1, subcategories: [] },
    ], summary: { ...data.summary, total_spent_minor: 3001 } } })
    render(<AnalyticsPage />)
    expect(within(screen.getByRole("img", { name: /Donut/ })).getByText("$30.01")).toBeInTheDocument()
    const row = screen.getByRole("button", { name: /Tiny category/ })
    expect(within(row).getByText("$0.01")).toBeInTheDocument()
    expect(within(row).getByText("0%")).toBeInTheDocument()
  })
})
