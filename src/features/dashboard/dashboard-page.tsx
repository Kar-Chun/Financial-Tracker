import { BanknoteArrowUp, WalletCards } from "lucide-react"
import { Link } from "react-router-dom"

import { buttonVariants } from "@/components/ui/button-variants"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useProfile } from "@/features/auth/profile-service"
import { AccountOverview } from "@/features/dashboard/account-overview"
import { useDashboard } from "@/features/dashboard/dashboard-hooks"
import { MonthlyBudgetCard } from "@/features/dashboard/monthly-budget-card"
import { useBudgetSummary } from "@/features/budgets/budget-hooks"
import { getCurrentMonthStart } from "@/features/budgets/budget-dates"
import { MetricCard } from "@/features/dashboard/metric-card"
import { NetWorthTrendCard } from "@/features/dashboard/net-worth-trend-card"
import { RecentTransactionsCard } from "@/features/dashboard/recent-transactions-card"
import { TodaysSpendingCard } from "@/features/dashboard/todays-spending-card"
import { cn } from "@/lib/utils"

export function DashboardPage() {
  const dashboardQuery = useDashboard()
  const profileQuery = useProfile()
  const profile = profileQuery.data
  const currencyCode = profile?.base_currency ?? "SGD"
  const timezone = profile?.timezone ?? "Asia/Singapore"
  const budgetQuery = useBudgetSummary(getCurrentMonthStart(timezone), Boolean(profile))

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

  const { accounts, dailySpending, monthly, transactions, snapshots } = dashboardQuery.data
  const foreignAccounts = accounts.filter((account) => account.account_type !== "investment" && !account.included_in_net_worth)

  if (accounts.length === 0) {
    return (
      <div className="space-y-7">
        <Card className="border-0 bg-card/60 shadow-none ring-1 ring-white/5">
          <CardContent className="flex min-h-56 flex-col items-center justify-center text-center">
            <WalletCards className="size-10 text-primary" />
            <h2 className="mt-5 text-xl font-semibold">Start with your first account</h2>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              Add a bank, cash, or investment account. Your dashboard will then use real balances only.
            </p>
            <Link className={cn(buttonVariants(), "mt-5")} to="/accounts">Add an account</Link>
          </CardContent>
        </Card>
        {!budgetQuery.isError && <MonthlyBudgetCard summary={budgetQuery.data} />}
      </div>
    )
  }

  return (
    <div className="space-y-5 sm:space-y-7">
      <NetWorthTrendCard snapshots={snapshots} currencyCode={currencyCode} />

      {foreignAccounts.length > 0 && (
        <div className="rounded-2xl bg-amber-400/8 px-4 py-3 text-sm leading-6 text-amber-100 ring-1 ring-amber-400/20">
          {foreignAccounts.length} foreign-currency bank/cash {foreignAccounts.length === 1 ? "account is" : "accounts are"} shown in native currency but excluded from consolidated {currencyCode} net worth. No FX conversion is performed.
        </div>
      )}

      <section className="grid grid-cols-2 gap-3 sm:gap-4" aria-label="Monthly financial summary">
        <MetricCard label="Monthly spent" amountMinor={monthly.expensesMinor} currencyCode={currencyCode} helper="This calendar month" icon={BanknoteArrowUp} />
        <TodaysSpendingCard
          averageMinor={dailySpending.sevenDayAverageMinor}
          currencyCode={currencyCode}
          localDate={dailySpending.localDate}
          todayMinor={dailySpending.todayMinor}
        />
      </section>

      {!budgetQuery.isError && <MonthlyBudgetCard summary={budgetQuery.data} />}

      <section className="grid gap-5 xl:grid-cols-[minmax(20rem,0.9fr)_minmax(0,1.1fr)]">
        <AccountOverview accounts={accounts} baseCurrency={currencyCode} />
        <RecentTransactionsCard transactions={transactions} todayDate={dailySpending.localDate} />
      </section>
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div className="space-y-7">
      <Skeleton className="h-56 w-full rounded-xl" />
      <div className="grid grid-cols-2 gap-3">
        {[0, 1].map((item) => <Skeleton key={item} className="h-32 rounded-2xl" />)}
      </div>
      <Skeleton className="h-80 rounded-2xl" />
    </div>
  )
}
