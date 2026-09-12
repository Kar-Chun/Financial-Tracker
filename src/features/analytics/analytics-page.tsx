import { ArrowDownRight, ArrowUpRight, CalendarDays, ChartNoAxesCombined, ReceiptText, Tags } from "lucide-react"
import { useMemo, useState } from "react"
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

import { FilterPill, MetricTile, PageTitle, SectionHeader } from "@/components/shared/finance-ui"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
    <div className="space-y-5">
      <PageTitle eyebrow="Spending insights" title="Analytics" description="Understand where your money goes." />
      <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:thin]" role="group" aria-label="Analytics period">
        {analyticsPeriodOptions.map((option) => (
          <FilterPill key={option.value} active={preset === option.value} onClick={() => setPreset(option.value)}>{option.label}</FilterPill>
        ))}
      </div>

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
      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <MetricTile label="Total Spent" value={formatCurrency(data.summary.total_spent_minor, currency)} detail={<ComparisonLabel comparison={comparison} />} icon={ReceiptText} />
        <MetricTile label="Average Daily Spend" value={formatCurrency(data.summary.average_daily_spend_minor, currency)} detail="Includes zero-spending days" icon={CalendarDays} />
        <MetricTile label="Largest Category" value={data.summary.largest_category_name ?? "—"} detail="Includes subcategories" icon={Tags} />
        <MetricTile label="Expense Count" value={data.summary.expense_count.toLocaleString("en-SG")} detail="In this period" icon={ChartNoAxesCombined} />
      </section>

      {data.excluded_foreign_expense_count > 0 && (
        <div className="rounded-2xl bg-amber-400/8 px-4 py-3 text-sm text-amber-100 ring-1 ring-amber-400/20">
          {data.excluded_foreign_expense_count} foreign-currency expense{data.excluded_foreign_expense_count === 1 ? " was" : "s were"} excluded because V1.1 does not perform automatic FX conversion.
        </div>
      )}

      <section className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(20rem,1fr)]">
        <Card className="min-w-0 gap-3 rounded-xl border-0 bg-transparent py-0 shadow-none ring-0">
          <CardHeader className="px-0"><CardTitle>Spending trend</CardTitle></CardHeader>
          <CardContent className="px-0">
            <div className="h-48 w-full sm:h-60" role="img" aria-label="Bar chart of spending over time">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 8, right: 4, left: -24, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="var(--border)" strokeOpacity={0.45} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={28} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
                  <YAxis tickLine={false} axisLine={false} tickFormatter={(value: number) => compactNumber.format(value / 100)} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
                  <Tooltip
                    cursor={{ fill: "color-mix(in oklch, var(--accent) 35%, transparent)" }}
                    contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: "0.625rem", color: "var(--popover-foreground)" }}
                    formatter={(value) => [formatCurrency(Number(value), currency), "Spent"]}
                    labelStyle={{ color: "var(--muted-foreground)" }}
                  />
                  <Bar dataKey="amount_minor" name="Spent" fill="var(--primary)" radius={[2, 2, 0, 0]} maxBarSize={28} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <SpendingByCategory data={data} currency={currency} />
      </section>

      <Card className="min-w-0 gap-3 rounded-xl border-0 bg-transparent py-0 shadow-none ring-0">
        <CardHeader className="px-0"><CardTitle>Period insights</CardTitle></CardHeader>
        <CardContent className="insight-surface divide-y divide-border/25 px-4">
          {insights.map((insight) => <p key={insight} className="py-3 text-sm leading-6 text-secondary-foreground">{insight}</p>)}
        </CardContent>
      </Card>
    </>
  )
}

function SpendingByCategory({ data, currency }: { data: SpendingAnalytics; currency: string }) {
  const [expanded, setExpanded] = useState<string | null>(null)
  return (
    <Card className="min-w-0 gap-3 rounded-xl border-0 bg-transparent py-0 shadow-none ring-0">
      <CardHeader className="px-0"><SectionHeader id="category-spending-heading" title="Spending by category" /></CardHeader>
      <CardContent className="divide-y divide-border/25 border-y border-border/30 px-0">
        {data.categories.map((category) => {
          const key = category.category_id ?? "uncategorised"
          const percentage = getCategoryPercentage(category.amount_minor, data.summary.total_spent_minor)
          const canExpand = category.subcategories.length > 0 || category.direct_amount_minor > 0
          const isExpanded = expanded === key
          return (
            <div key={key} className="min-w-0">
              <button type="button" disabled={!canExpand} onClick={() => setExpanded(isExpanded ? null : key)} aria-expanded={canExpand ? isExpanded : undefined} className="grid min-h-16 w-full grid-cols-[minmax(0,1fr)_auto] gap-4 rounded-lg py-3 text-left focus-visible:outline-2 focus-visible:outline-ring disabled:cursor-default">
                <div className="min-w-0">
                  <div className="flex items-center justify-between gap-4">
                    <span className="break-words text-sm font-medium">{category.name}</span>
                    <span className="text-sm font-semibold tabular-nums sm:hidden">{percentage}%</span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${percentage}%` }} />
                  </div>
                </div>
                <div className="max-w-[40vw] text-right sm:max-w-64">
                  <p className="text-sm font-semibold tabular-nums [overflow-wrap:anywhere]">{formatCurrency(category.amount_minor, currency)}</p>
                  <p className="hidden text-xs text-muted-foreground sm:block">{percentage}% of total</p>
                </div>
              </button>
              {isExpanded && (
                <div className="border-t border-border/25 px-4 py-3">
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
  return <span className={cn("inline-flex items-center gap-1", decrease ? "text-positive" : "text-negative")}>{decrease ? <ArrowDownRight className="size-3.5" /> : <ArrowUpRight className="size-3.5" />}{comparison.percentage}% {decrease ? "less" : "more"} vs previous period</span>
}

function EmptyAnalytics({ excludedForeignExpenseCount }: { excludedForeignExpenseCount: number }) {
  const title = excludedForeignExpenseCount > 0
    ? "No base-currency spending recorded for this period."
    : "No spending recorded for this period yet."
  return <Card className="insight-surface py-0"><CardContent className="px-5 py-8 text-center"><div className="mx-auto flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><ChartNoAxesCombined className="size-5" /></div><h2 className="mt-4 font-semibold">{title}</h2><p className="mt-1 text-sm text-muted-foreground">{excludedForeignExpenseCount > 0 ? `${excludedForeignExpenseCount} foreign-currency expense${excludedForeignExpenseCount === 1 ? " was" : "s were"} excluded because automatic FX conversion is unavailable.` : "Add an expense to start seeing your spending insights."}</p></CardContent></Card>
}

function AnalyticsSkeleton() {
  return <div className="space-y-6"><div className="grid grid-cols-2 gap-3 xl:grid-cols-4">{Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-32 rounded-xl" />)}</div><Skeleton className="h-52 rounded-xl" /><Skeleton className="h-52 rounded-xl" /></div>
}

function formatBucket(value: string, granularity: "day" | "month") {
  return new Intl.DateTimeFormat("en-SG", granularity === "month" ? { month: "short", year: "2-digit", timeZone: "UTC" } : { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`))
}
