import { BanknoteArrowDown, BanknoteArrowUp, TrendingUp, WalletCards } from "lucide-react"
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
import { getMonthlySummary, groupExpensesByParent } from "@/features/dashboard/dashboard-logic"
import { MetricCard } from "@/features/dashboard/metric-card"
import { InvestmentsCard } from "@/features/dashboard/investments-card"
import { NetWorthTrendCard } from "@/features/dashboard/net-worth-trend-card"
import { RecentTransactionsCard } from "@/features/dashboard/recent-transactions-card"
import { SpendingBreakdownCard } from "@/features/dashboard/spending-breakdown-card"
import { SavingsGoalsCard } from "@/features/dashboard/savings-goals-card"
import { useSavingsGoals } from "@/features/goals/goals-hooks"
import { getDateInputInTimeZone } from "@/lib/dates"
import { cn } from "@/lib/utils"

export function DashboardPage() {
  const dashboardQuery = useDashboard()
  const profileQuery = useProfile()
  const profile = profileQuery.data
  const currencyCode = profile?.base_currency ?? "SGD"
  const timezone = profile?.timezone ?? "Asia/Singapore"
  const budgetQuery = useBudgetSummary(getCurrentMonthStart(timezone), Boolean(profile))
  const goalsQuery = useSavingsGoals(false, Boolean(profile))

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
  const monthly = getMonthlySummary(transactions, currencyCode)
  const spendingGroups = groupExpensesByParent(transactions, categories, currencyCode)
  const foreignAccounts = accounts.filter((account) => account.account_type !== "investment" && !account.included_in_net_worth)
  const todayDate = getDateInputInTimeZone(timezone)

  if (accounts.length === 0) {
    return (
      <div className="space-y-7">
        <Card className="border-0 bg-card/60 shadow-none ring-1 ring-white/5">
          <CardContent className="flex min-h-80 flex-col items-center justify-center text-center">
            <WalletCards className="size-10 text-primary" />
            <h2 className="mt-5 text-xl font-semibold">Start with your first account</h2>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              Add a bank, cash, or investment account. Your dashboard will then use real balances only.
            </p>
            <Link className={cn(buttonVariants(), "mt-5")} to="/accounts">Add an account</Link>
          </CardContent>
        </Card>
        {!budgetQuery.isError && <MonthlyBudgetCard summary={budgetQuery.data} />}
        {!goalsQuery.isError && <SavingsGoalsCard summary={goalsQuery.data} />}
      </div>
    )
  }

  return (
    <div className="space-y-7 sm:space-y-8">
      <NetWorthTrendCard snapshots={snapshots} currencyCode={currencyCode} />

      {foreignAccounts.length > 0 && (
        <div className="rounded-2xl bg-amber-400/8 px-4 py-3 text-sm leading-6 text-amber-100 ring-1 ring-amber-400/20">
          {foreignAccounts.length} foreign-currency bank/cash {foreignAccounts.length === 1 ? "account is" : "accounts are"} shown in native currency but excluded from consolidated {currencyCode} net worth. No FX conversion is performed.
        </div>
      )}

      <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3" aria-label="Monthly financial summary">
        <MetricCard label="Monthly income" amountMinor={monthly.incomeMinor} currencyCode={currencyCode} helper="Transfers excluded" icon={BanknoteArrowDown} tone="positive" />
        <MetricCard label="Monthly spent" amountMinor={monthly.expensesMinor} currencyCode={currencyCode} helper="Recorded expenses" icon={BanknoteArrowUp} tone="negative" />
        <MetricCard className="col-span-2 lg:col-span-1" label="Net cash flow" amountMinor={monthly.netCashFlowMinor} currencyCode={currencyCode} helper="Income minus expenses" icon={TrendingUp} showSign />
      </section>

      {!budgetQuery.isError && <MonthlyBudgetCard summary={budgetQuery.data} />}

      <section className="grid gap-7 xl:grid-cols-[minmax(20rem,0.9fr)_minmax(0,1.1fr)]">
        <AccountOverview accounts={accounts} baseCurrency={currencyCode} />
        <RecentTransactionsCard transactions={transactions} todayDate={todayDate} />
      </section>

      {!goalsQuery.isError && <SavingsGoalsCard summary={goalsQuery.data} />}

      <InvestmentsCard accounts={accounts} baseCurrency={currencyCode} />

      <SpendingBreakdownCard groups={spendingGroups} currencyCode={currencyCode} />
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div className="space-y-7">
      <Skeleton className="h-72 w-full rounded-[1.75rem]" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {[0, 1, 2].map((item) => <Skeleton key={item} className="h-32 rounded-2xl" />)}
      </div>
      <Skeleton className="h-80 rounded-2xl" />
    </div>
  )
}
