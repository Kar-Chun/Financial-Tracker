import { createBrowserRouter, Navigate } from "react-router-dom"

import { AppShell } from "@/components/layout/app-shell"
import { ProtectedRoute, PublicOnlyRoute } from "@/features/auth/route-guards"

export const router = createBrowserRouter([
  {
    path: "/",
    lazy: async () => {
      const { WelcomePage } = await import("@/features/auth/welcome-page")
      return { Component: WelcomePage }
    },
  },
  {
    element: <PublicOnlyRoute />,
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
            path: "/investments",
            lazy: async () => {
              const { InvestmentsPage } = await import("@/features/investments/investments-page")
              return { Component: InvestmentsPage }
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
