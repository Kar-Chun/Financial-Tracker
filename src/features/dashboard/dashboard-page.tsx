import { BanknoteArrowDown, BanknoteArrowUp, Landmark, PiggyBank, TrendingUp, WalletCards } from "lucide-react"
import { Link } from "react-router-dom"

import { buttonVariants } from "@/components/ui/button-variants"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useProfile } from "@/features/auth/profile-service"
import { useDashboard } from "@/features/dashboard/dashboard-hooks"
import { getMonthlySummary, groupExpensesByParent } from "@/features/dashboard/dashboard-logic"
import { MetricCard } from "@/features/dashboard/metric-card"
import { NetWorthTrendCard } from "@/features/dashboard/net-worth-trend-card"
import { RecentTransactionsCard } from "@/features/dashboard/recent-transactions-card"
import { SpendingBreakdownCard } from "@/features/dashboard/spending-breakdown-card"
import { formatLongDate, getTodayDateInput } from "@/lib/dates"
import { cn } from "@/lib/utils"

export function DashboardPage() {
  const dashboardQuery = useDashboard()
  const profileQuery = useProfile()
  const profile = profileQuery.data
  const currencyCode = profile?.base_currency ?? "SGD"

  if (dashboardQuery.isLoading || profileQuery.isLoading) return <DashboardSkeleton />
  if (dashboardQuery.isError || profileQuery.isError || !dashboardQuery.data) {
    return (
      <Card className="border-destructive/30">
        <CardContent className="py-12 text-center">
          <h1 className="text-lg font-semibold">Dashboard unavailable</h1>
          <p className="mt-2 text-sm text-muted-foreground">Check your connection and ensure the V1 migrations are applied.</p>
        </CardContent>
      </Card>
    )
  }

  const { accounts, transactions, categories, snapshots } = dashboardQuery.data
  const latest = snapshots[0]
  const monthly = getMonthlySummary(transactions, currencyCode)
  const spendingGroups = groupExpensesByParent(transactions, categories, currencyCode)
  const foreignAccounts = accounts.filter((account) => account.account_type !== "investment" && !account.included_in_net_worth)
  const displayName = profile?.display_name?.split(" ")[0] ?? "there"

  if (accounts.length === 0) {
    return (
      <div className="space-y-6">
        <DashboardHeader displayName={displayName} />
        <Card className="border-dashed bg-card/60 shadow-none">
          <CardContent className="flex min-h-80 flex-col items-center justify-center text-center">
            <WalletCards className="size-10 text-primary" />
            <h2 className="mt-5 text-xl font-semibold">Start with your first account</h2>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              Add a bank, cash, or investment account. Your dashboard will then use real balances only.
            </p>
            <Link className={cn(buttonVariants(), "mt-5")} to="/accounts">Add an account</Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  const metrics = [
    { label: "Net Worth", amountMinor: latest?.total_value_base_minor ?? 0, helper: `In ${currencyCode}, excluding unconverted cash`, icon: PiggyBank, className: "order-1 xl:order-none" },
    { label: "Bank + Cash", amountMinor: (latest?.bank_value_base_minor ?? 0) + (latest?.cash_value_base_minor ?? 0), helper: "Base-currency accounts only", icon: WalletCards, className: "order-5 xl:order-none" },
    { label: "Investments", amountMinor: latest?.investment_value_base_minor ?? 0, helper: "Manual values plus later base-currency transfers", icon: Landmark, className: "order-6 xl:order-none" },
    { label: "Monthly Income", amountMinor: monthly.incomeMinor, helper: "Transfers and unconverted currencies excluded", icon: BanknoteArrowDown, className: "order-3 xl:order-none" },
    { label: "Monthly Expenses", amountMinor: monthly.expensesMinor, helper: "Reserved types and unconverted currencies excluded", icon: BanknoteArrowUp, className: "order-2 xl:order-none" },
    { label: "Net Cash Flow", amountMinor: monthly.netCashFlowMinor, helper: "Income minus expenses", icon: TrendingUp, className: "order-4 xl:order-none" },
  ]

  return (
    <div className="space-y-6">
      <DashboardHeader displayName={displayName} />
      {foreignAccounts.length > 0 && (
        <div className="rounded-xl border border-amber-400/25 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
          {foreignAccounts.length} foreign-currency bank/cash {foreignAccounts.length === 1 ? "account is" : "accounts are"} shown in native currency but excluded from consolidated {currencyCode} net worth. No FX conversion is performed.
        </div>
      )}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-label="Financial summary">
        {metrics.map((metric) => <MetricCard key={metric.label} {...metric} currencyCode={currencyCode} />)}
      </section>
      <section className="grid gap-4 xl:grid-cols-3" aria-label="Financial insights">
        <NetWorthTrendCard className="order-2 xl:order-1" snapshots={snapshots} currencyCode={currencyCode} />
        <SpendingBreakdownCard className="order-3 xl:order-2" groups={spendingGroups} currencyCode={currencyCode} />
        <RecentTransactionsCard className="order-1 xl:order-3" transactions={transactions} />
      </section>
    </div>
  )
}

function DashboardHeader({ displayName }: { displayName: string }) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-sm font-medium text-primary">Financial overview</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Good day, {displayName}</h1>
        <p className="mt-1 text-sm text-muted-foreground">Your balances and activity from real account data.</p>
      </div>
      <p className="text-sm text-muted-foreground">As of {formatLongDate(getTodayDateInput())}</p>
    </header>
  )
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-20 w-full rounded-xl" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((item) => <Skeleton key={item} className="h-36 rounded-xl" />)}
      </div>
      <Skeleton className="h-80 rounded-xl" />
    </div>
  )
}
