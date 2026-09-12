// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { formatCurrency } from "@/lib/currency"
import { BudgetsPage } from "@/features/budgets/budgets-page"
import { getCurrentMonthStart, shiftMonthStart } from "@/features/budgets/budget-dates"
import type { MonthlyBudgetSummary } from "@/features/budgets/budget-types"

const mocks = vi.hoisted(() => ({ summary: vi.fn(), save: vi.fn(), copy: vi.fn() }))
vi.mock("@/features/auth/profile-service", () => ({ useProfile: () => ({ data: { id: "owner", timezone: "Asia/Singapore" } }) }))
vi.mock("@/features/transactions/transactions-hooks", () => ({ useCategories: () => ({ data: [] }) }))
vi.mock("@/features/budgets/budget-hooks", () => ({
  useBudgetSummary: mocks.summary,
  useSaveMonthlyBudget: () => ({ mutate: mocks.save, isPending: false }),
  useSaveCategoryBudget: () => ({ mutate: vi.fn(), isPending: false }),
  useRemoveCategoryBudget: () => ({ mutate: vi.fn(), isPending: false }),
  useCopyPreviousBudget: () => ({ mutate: mocks.copy, isPending: false }),
}))

const summary: MonthlyBudgetSummary = {
  month_start: "2026-09-01", month_end: "2026-09-30", period_status: "current",
  budget_exists: true, previous_budget_exists: true, budget_id: "budget", currency_code: "SGD",
  currency_mismatch: false, overall_budget_minor: 10000, spent_minor: 11000, remaining_minor: -1000,
  over_budget_minor: 1000, days_in_month: 30, elapsed_days: 12, remaining_days_including_today: 19,
  safe_daily_spend_minor: 0, expected_spend_minor: 4000, pace_status: "over_budget",
  category_budgets: [], excluded_foreign_expense_count: 0,
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.summary.mockReturnValue({ data: summary })
})

describe("Budgets refreshed presentation", () => {
  it("keeps actual over-budget guidance, capped progress, and the edit action", () => {
    render(<MemoryRouter><BudgetsPage /></MemoryRouter>)
    expect(screen.getByRole("heading", { name: "Budgets" })).toBeInTheDocument()
    expect(screen.getByText(`${formatCurrency(1000)} over budget`)).toBeInTheDocument()
    expect(screen.getByText("110% used")).toBeInTheDocument()
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "100")
    fireEvent.click(screen.getByRole("button", { name: /Edit overall/ }))
    const amount = screen.getByLabelText("Monthly budget")
    expect(amount).toHaveValue("100.00")
    fireEvent.change(amount, { target: { value: "150.00" } })
    fireEvent.click(screen.getByRole("button", { name: "Save budget" }))
    expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({ amountMinor: 15000 }), expect.any(Object))
  })

  it("preserves month navigation without changing the summary query contract", () => {
    render(<MemoryRouter><BudgetsPage /></MemoryRouter>)
    const current = getCurrentMonthStart("Asia/Singapore")
    fireEvent.click(screen.getByRole("button", { name: "Previous month" }))
    expect(mocks.summary).toHaveBeenLastCalledWith(shiftMonthStart(current, -1), true)
    fireEvent.click(screen.getByRole("button", { name: "Next month" }))
    expect(mocks.summary).toHaveBeenLastCalledWith(current, true)
  })

  it("keeps the empty-state create/copy actions without fake budget metrics", () => {
    mocks.summary.mockReturnValue({ data: { ...summary, budget_exists: false, overall_budget_minor: null } })
    render(<MemoryRouter><BudgetsPage /></MemoryRouter>)
    expect(screen.getByRole("button", { name: "Set monthly budget" })).toBeInTheDocument()
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: /Copy previous month/ }))
    expect(mocks.copy).toHaveBeenCalledWith({ sourceMonthStart: "2026-08-01", destinationMonthStart: "2026-09-01" }, expect.any(Object))
  })
})
