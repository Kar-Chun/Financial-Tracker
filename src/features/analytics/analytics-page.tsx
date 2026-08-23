import { ArrowDownRight, ArrowUpRight, CalendarDays, ChartNoAxesCombined, ReceiptText, Tags } from "lucide-react"
import { useMemo, useState } from "react"
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { useSpendingAnalytics } from "@/features/analytics/analytics-hooks"
import { getCategoryPercentage, getSpendingComparison, getSpendingInsights } from "@/features/analytics/analytics-logic"
import {
  analyticsPeriodOptions,
  getAnalyticsPeriod,
  getDateInTimeZone,
  type AnalyticsPeriodPreset,
} from "@/features/analytics/analytics-periods"
import type { SpendingAnalytics } from "@/features/analytics/analytics-types"
import { useProfile } from "@/features/auth/profile-service"
import { formatCurrency } from "@/lib/currency"
import { cn } from "@/lib/utils"

export function AnalyticsPage() {
  const [preset, setPreset] = useState<AnalyticsPeriodPreset>("this_month")
  const profileQuery = useProfile()
  const selectedPeriod = useMemo(() => {
    if (!profileQuery.data) return null
    return getAnalyticsPeriod(preset, getDateInTimeZone(profileQuery.data.timezone))
  }, [preset, profileQuery.data])
  const analyticsQuery = useSpendingAnalytics(preset, selectedPeriod)
  const currency = profileQuery.data?.base_currency ?? "SGD"

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-primary">Spending insights</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Analytics</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Understand how much you spend, where it goes, and how it compares with an equivalent previous period.
          </p>
        </div>
        <Select items={analyticsPeriodOptions} value={preset} onValueChange={(value) => setPreset(value as AnalyticsPeriodPreset)}>
          <SelectTrigger className="w-full sm:w-48"><CalendarDays /><SelectValue /></SelectTrigger>
          <SelectContent>
            {analyticsPeriodOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </header>

      {profileQuery.isLoading || analyticsQuery.isLoading ? <AnalyticsSkeleton /> : profileQuery.isError || analyticsQuery.isError || !analyticsQuery.data ? (
        <Card className="border-destructive/30">
          <CardContent className="py-12 text-center">
            <p className="font-medium">Spending analytics could not be loaded.</p>
            <p className="mt-1 text-sm text-muted-foreground">Try again after checking your connection and migration status.</p>
          </CardContent>
        </Card>
      ) : analyticsQuery.data.summary.total_spent_minor === 0 ? (
        <EmptyAnalytics excludedForeignExpenseCount={analyticsQuery.data.excluded_foreign_expense_count} />
      ) : (
        <AnalyticsContent data={analyticsQuery.data} currency={currency} />
      )}
    </div>
  )
}

function AnalyticsContent({ data, currency }: { data: SpendingAnalytics; currency: string }) {
  const comparison = getSpendingComparison(data.summary.total_spent_minor, data.previous_summary.total_spent_minor)
  const insights = getSpendingInsights(data, currency)
  const compactNumber = new Intl.NumberFormat("en-SG", { notation: "compact", maximumFractionDigits: 1 })
  const chartData = data.trend.map((point) => ({
    ...point,
    label: formatBucket(point.bucket_date, data.period.trend_granularity),
  }))

  return (
    <>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Total Spent" value={formatCurrency(data.summary.total_spent_minor, currency)} detail={<ComparisonLabel comparison={comparison} />} icon={ReceiptText} />
        <MetricCard label="Average Daily Spend" value={formatCurrency(data.summary.average_daily_spend_minor, currency)} detail="Across every day in the selected period" icon={CalendarDays} />
        <MetricCard label="Largest Category" value={data.summary.largest_category_name ?? "—"} detail="Parent-category aggregation" icon={Tags} />
        <MetricCard label="Number of Expenses" value={data.summary.expense_count.toLocaleString("en-SG")} detail="Recorded expense transactions" icon={ChartNoAxesCombined} />
      </section>

      {data.excluded_foreign_expense_count > 0 && (
        <div className="rounded-lg border border-amber-400/20 bg-amber-400/5 px-4 py-3 text-sm text-amber-100">
          {data.excluded_foreign_expense_count} foreign-currency expense{data.excluded_foreign_expense_count === 1 ? " was" : "s were"} excluded because V1.1 does not perform automatic FX conversion.
        </div>
      )}

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(20rem,1fr)]">
        <Card>
          <CardHeader><CardTitle>Spending over time</CardTitle></CardHeader>
          <CardContent>
            <div className="h-72 w-full" role="img" aria-label="Bar chart of spending over time">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={28} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} />
                  <YAxis tickLine={false} axisLine={false} tickFormatter={(value: number) => compactNumber.format(value / 100)} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} />
                  <Tooltip
                    cursor={{ fill: "color-mix(in oklch, var(--accent) 35%, transparent)" }}
                    contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: "0.625rem", color: "var(--popover-foreground)" }}
                    formatter={(value) => [formatCurrency(Number(value), currency), "Spent"]}
                    labelStyle={{ color: "var(--muted-foreground)" }}
                  />
                  <Bar dataKey="amount_minor" name="Spent" fill="var(--primary)" radius={[5, 5, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Deterministic insights</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {insights.map((insight) => <p key={insight} className="rounded-lg border bg-muted/30 p-3 text-sm leading-6">{insight}</p>)}
          </CardContent>
        </Card>
      </section>

      <SpendingByCategory data={data} currency={currency} />
    </>
  )
}

function SpendingByCategory({ data, currency }: { data: SpendingAnalytics; currency: string }) {
  const [expanded, setExpanded] = useState<string | null>(null)
  return (
    <Card>
      <CardHeader><CardTitle>Spending by Category</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {data.categories.map((category) => {
          const key = category.category_id ?? "uncategorised"
          const percentage = getCategoryPercentage(category.amount_minor, data.summary.total_spent_minor)
          const canExpand = category.subcategories.length > 0 || category.direct_amount_minor > 0
          const isExpanded = expanded === key
          return (
            <div key={key} className="overflow-hidden rounded-lg border bg-muted/15">
              <button type="button" disabled={!canExpand} onClick={() => setExpanded(isExpanded ? null : key)} className="grid w-full grid-cols-[minmax(0,1fr)_auto] gap-4 p-4 text-left disabled:cursor-default">
                <div className="min-w-0">
                  <div className="flex items-center justify-between gap-4">
                    <span className="truncate font-medium">{category.name}</span>
                    <span className="text-sm font-semibold tabular-nums sm:hidden">{percentage}%</span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${percentage}%` }} />
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold tabular-nums">{formatCurrency(category.amount_minor, currency)}</p>
                  <p className="hidden text-xs text-muted-foreground sm:block">{percentage}% of total</p>
                </div>
              </button>
              {isExpanded && (
                <div className="border-t px-4 py-3">
                  {category.direct_amount_minor > 0 && <CategoryDetail label={`${category.name} (direct)`} value={category.direct_amount_minor} currency={currency} />}
                  {category.subcategories.map((subcategory) => <CategoryDetail key={subcategory.category_id} label={subcategory.name} value={subcategory.amount_minor} currency={currency} />)}
                </div>
              )}
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}

function CategoryDetail({ label, value, currency }: { label: string; value: number; currency: string }) {
  return <div className="flex items-center justify-between gap-4 py-2 text-sm"><span className="text-muted-foreground">{label}</span><span className="font-medium tabular-nums">{formatCurrency(value, currency)}</span></div>
}

function ComparisonLabel({ comparison }: { comparison: ReturnType<typeof getSpendingComparison> }) {
  if (comparison.direction === "no_prior") return <span>No prior spending to compare</span>
  if (comparison.direction === "same") return <span>Unchanged vs previous period</span>
  const decrease = comparison.direction === "decrease"
  return <span className={cn("inline-flex items-center gap-1", decrease ? "text-emerald-400" : "text-rose-400")}>{decrease ? <ArrowDownRight className="size-3.5" /> : <ArrowUpRight className="size-3.5" />}{comparison.percentage}% {decrease ? "less" : "more"} vs previous period</span>
}

function MetricCard({ label, value, detail, icon: Icon }: { label: string; value: string; detail: React.ReactNode; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <Card><CardContent className="pt-6"><div className="flex items-start justify-between gap-4"><div className="min-w-0"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-2 truncate text-2xl font-semibold tracking-tight">{value}</p></div><div className="rounded-lg bg-primary/10 p-2 text-primary"><Icon className="size-4" /></div></div><div className="mt-3 text-xs text-muted-foreground">{detail}</div></CardContent></Card>
  )
}

function EmptyAnalytics({ excludedForeignExpenseCount }: { excludedForeignExpenseCount: number }) {
  const title = excludedForeignExpenseCount > 0
    ? "No base-currency spending recorded for this period."
    : "No spending recorded for this period yet."
  return <Card><CardContent className="py-16 text-center"><div className="mx-auto flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><ChartNoAxesCombined className="size-5" /></div><h2 className="mt-4 font-semibold">{title}</h2><p className="mt-1 text-sm text-muted-foreground">{excludedForeignExpenseCount > 0 ? `${excludedForeignExpenseCount} foreign-currency expense${excludedForeignExpenseCount === 1 ? " was" : "s were"} excluded because automatic FX conversion is unavailable.` : "Add an expense to start seeing your spending insights."}</p></CardContent></Card>
}

function AnalyticsSkeleton() {
  return <div className="space-y-6"><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-36 rounded-xl" />)}</div><Skeleton className="h-80 rounded-xl" /><Skeleton className="h-80 rounded-xl" /></div>
}

function formatBucket(value: string, granularity: "day" | "month") {
  return new Intl.DateTimeFormat("en-SG", granularity === "month" ? { month: "short", year: "2-digit", timeZone: "UTC" } : { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`))
}
