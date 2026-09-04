// @vitest-environment jsdom

import { render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { describe, expect, it, vi } from "vitest"

import { DashboardPage } from "@/features/dashboard/dashboard-page"

vi.mock("@/features/auth/profile-service", () => ({
  useProfile: () => ({
    isLoading: false,
    isError: false,
    data: { display_name: "Kar Chun", base_currency: "SGD", timezone: "Asia/Singapore" },
  }),
}))
vi.mock("@/features/dashboard/dashboard-hooks", () => ({
  useDashboard: () => ({
    isLoading: false,
    isError: false,
    data: {
      accounts: [{ id: "bank", account_type: "bank", included_in_net_worth: true }],
      monthly: { incomeMinor: 0, expensesMinor: 0, netCashFlowMinor: 0 },
      spendingGroups: [],
      transactions: [],
      snapshots: [],
    },
  }),
}))
vi.mock("@/features/budgets/budget-hooks", () => ({ useBudgetSummary: () => ({ isError: true }) }))
vi.mock("@/features/goals/goals-hooks", () => ({ useSavingsGoals: () => ({ isError: true }) }))
vi.mock("@/features/dashboard/net-worth-trend-card", () => ({
  NetWorthTrendCard: () => <section>Total net worth</section>,
}))
vi.mock("@/features/dashboard/account-overview", () => ({ AccountOverview: () => null }))
vi.mock("@/features/dashboard/recent-transactions-card", () => ({ RecentTransactionsCard: () => null }))
vi.mock("@/features/dashboard/investments-card", () => ({ InvestmentsCard: () => null }))
vi.mock("@/features/dashboard/spending-breakdown-card", () => ({ SpendingBreakdownCard: () => null }))
vi.mock("@/features/dashboard/metric-card", () => ({ MetricCard: () => null }))

describe("DashboardPage header", () => {
  it("starts with Net Worth and omits the decorative greeting and profile name", () => {
    render(<MemoryRouter><DashboardPage /></MemoryRouter>)

    expect(screen.getByText("Total net worth")).toBeInTheDocument()
    expect(screen.queryByText(/good morning/i)).not.toBeInTheDocument()
    expect(screen.queryByText("Kar Chun")).not.toBeInTheDocument()
  })
})
