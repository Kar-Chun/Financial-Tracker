import { createBrowserRouter, Navigate } from "react-router-dom"

import { AppShell } from "@/components/layout/app-shell"
import { RouteErrorPage } from "@/app/route-error-page"
import { ProtectedRoute, PublicOnlyRoute } from "@/features/auth/route-guards"

export const router = createBrowserRouter([
  {
    path: "/",
    errorElement: <RouteErrorPage />,
    lazy: async () => {
      const { WelcomePage } = await import("@/features/auth/welcome-page")
      return { Component: WelcomePage }
    },
  },
  {
    element: <PublicOnlyRoute />,
    errorElement: <RouteErrorPage />,
    children: [
      {
        path: "/login",
        lazy: async () => {
          const { LoginPage } = await import("@/features/auth/auth-page")
          return { Component: LoginPage }
        },
      },
      {
        path: "/signup",
        lazy: async () => {
          const { SignupPage } = await import("@/features/auth/auth-page")
          return { Component: SignupPage }
        },
      },
    ],
  },
  {
    element: <ProtectedRoute />,
    errorElement: <RouteErrorPage />,
    children: [
      {
        element: <AppShell />,
        children: [
          {
            path: "/dashboard",
            lazy: async () => {
              const { DashboardPage } = await import("@/features/dashboard/dashboard-page")
              return { Component: DashboardPage }
            },
          },
          {
            path: "/accounts",
            lazy: async () => {
              const { AccountsPage } = await import("@/features/accounts/accounts-page")
              return { Component: AccountsPage }
            },
          },
          {
            path: "/transactions",
            lazy: async () => {
              const { TransactionsPage } = await import("@/features/transactions/transactions-page")
              return { Component: TransactionsPage }
            },
          },
          {
            path: "/transactions/new",
            lazy: async () => {
              const { AddTransactionPage } = await import("@/features/transactions/add-transaction-page")
              return { Component: AddTransactionPage }
            },
          },
          {
            path: "/investments",
            lazy: async () => {
              const { InvestmentsPage } = await import("@/features/investments/investments-page")
              return { Component: InvestmentsPage }
            },
          },
          {
            path: "/investments/:accountId/setup",
            lazy: async () => {
              const { DetailedInvestmentSetupPage } = await import("@/features/investments/detailed-investment-setup-page")
              return { Component: DetailedInvestmentSetupPage }
            },
          },
          {
            path: "/investments/:accountId",
            lazy: async () => {
              const { InvestmentAccountPage } = await import("@/features/investments/investment-account-page")
              return { Component: InvestmentAccountPage }
            },
          },
          {
            path: "/investments/:accountId/holdings/:holdingId",
            lazy: async () => {
              const { HoldingDetailPage } = await import("@/features/investments/holding-detail-page")
              return { Component: HoldingDetailPage }
            },
          },
          {
            path: "/budgets",
            lazy: async () => {
              const { BudgetsPage } = await import("@/features/budgets/budgets-page")
              return { Component: BudgetsPage }
            },
          },
          {
            path: "/goals",
            lazy: async () => {
              const { GoalsPage } = await import("@/features/goals/goals-page")
              return { Component: GoalsPage }
            },
          },
          {
            path: "/goals/new",
            lazy: async () => {
              const { NewGoalPage } = await import("@/features/goals/new-goal-page")
              return { Component: NewGoalPage }
            },
          },
          {
            path: "/goals/:goalId",
            lazy: async () => {
              const { GoalDetailPage } = await import("@/features/goals/goal-detail-page")
              return { Component: GoalDetailPage }
            },
          },
          {
            path: "/analytics",
            lazy: async () => {
              const { AnalyticsPage } = await import("@/features/analytics/analytics-page")
              return { Component: AnalyticsPage }
            },
          },
          {
            path: "/settings",
            lazy: async () => {
              const { SettingsPage } = await import("@/features/settings/settings-page")
              return { Component: SettingsPage }
            },
          },
        ],
      },
    ],
  },
  { path: "*", element: <Navigate to="/" replace /> },
])
