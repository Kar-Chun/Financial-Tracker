// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { DashboardPage } from "@/features/dashboard/dashboard-page"

const state = vi.hoisted(() => ({ error: null as Error | null, missing: false, refetch: vi.fn() }))
beforeEach(() => { state.error = null; state.missing = false; state.refetch.mockReset() })

vi.mock("@/features/auth/profile-service", () => ({
  useProfile: () => ({
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
    data: { display_name: "Kar Chun", base_currency: "SGD", timezone: "Asia/Singapore" },
  }),
}))
vi.mock("@/features/dashboard/dashboard-hooks", () => ({
  useDashboard: () => ({
    isLoading: false,
    isError: Boolean(state.error),
    error: state.error,
    refetch: state.refetch,
    data: state.missing ? undefined : {
      accounts: [{ id: "bank", account_type: "bank", included_in_net_worth: true }],
      monthly: { incomeMinor: 0, expensesMinor: 0, netCashFlowMinor: 0 },
      dailySpending: { localDate: "2026-09-09", todayMinor: 0, sevenDayTotalMinor: 0, sevenDayAverageMinor: 0 },
      spendingGroups: [],
      transactions: [],
      snapshots: [],
    },
  }),
}))
vi.mock("@/features/budgets/budget-hooks", () => ({ useBudgetSummary: () => ({ isError: false, data: { budget_exists: true } }) }))
vi.mock("@/features/dashboard/net-worth-trend-card", () => ({
  NetWorthTrendCard: () => <section>Total net worth</section>,
}))
vi.mock("@/features/dashboard/account-overview", () => ({ AccountOverview: () => null }))
vi.mock("@/features/dashboard/recent-transactions-card", () => ({ RecentTransactionsCard: () => null }))
vi.mock("@/features/dashboard/monthly-budget-card", () => ({ MonthlyBudgetCard: () => <a href="/budgets">Monthly budget</a> }))
vi.mock("@/features/dashboard/metric-card", () => ({
  MetricCard: ({ label }: { label: string }) => <section>{label}</section>,
}))

describe("DashboardPage header", () => {
  it("keeps loaded metrics during a transient failure and retries on request", () => {
    state.error = new TypeError("Failed to fetch")
    render(<MemoryRouter><DashboardPage /></MemoryRouter>)
    expect(screen.getByText("Total net worth")).toBeInTheDocument()
    expect(screen.getByRole("status")).toHaveTextContent("Showing the latest loaded data")
    fireEvent.click(screen.getByRole("button", { name: "Try again" }))
    expect(state.refetch).toHaveBeenCalledOnce()
  })

  it("offers retry after an initial failure without inventing metrics", () => {
    state.error = new TypeError("Failed to fetch")
    state.missing = true
    render(<MemoryRouter><DashboardPage /></MemoryRouter>)
    expect(screen.getByText("Dashboard unavailable")).toBeInTheDocument()
    expect(screen.queryByText("Total net worth")).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Try again" }))
    expect(state.refetch).toHaveBeenCalledOnce()
  })

  it("starts with Net Worth and omits the decorative greeting and profile name", () => {
    render(<MemoryRouter><DashboardPage /></MemoryRouter>)

    expect(screen.getByText("Total net worth")).toBeInTheDocument()
    expect(screen.queryByText(/good morning/i)).not.toBeInTheDocument()
    expect(screen.queryByText("Kar Chun")).not.toBeInTheDocument()
    expect(screen.getByText("Today's spending")).toBeInTheDocument()
    expect(screen.getByText("Monthly spent")).toBeInTheDocument()
    expect(screen.queryByText(/monthly income/i)).not.toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Monthly budget" })).toHaveAttribute("href", "/budgets")
    expect(screen.queryByText("Net cash flow")).not.toBeInTheDocument()
  })
})
