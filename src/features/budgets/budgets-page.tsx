import { useState } from "react"
import { ChevronLeft, ChevronRight, Copy, LoaderCircle, Pencil, PiggyBank, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useProfile } from "@/features/auth/profile-service"
import { formatBudgetMonth, getCurrentMonthStart, shiftMonthStart } from "@/features/budgets/budget-dates"
import { CategoryBudgetDialog, MonthlyBudgetDialog } from "@/features/budgets/budget-form-dialogs"
import { useBudgetSummary, useCopyPreviousBudget, useRemoveCategoryBudget } from "@/features/budgets/budget-hooks"
import { getBudgetProgress } from "@/features/budgets/budget-logic"
import type { CategoryBudgetSummary, MonthlyBudgetSummary } from "@/features/budgets/budget-types"
import { useCategories } from "@/features/transactions/transactions-hooks"
import { formatCurrency } from "@/lib/currency"
import { getErrorMessage } from "@/lib/errors"
import { cn } from "@/lib/utils"

export function BudgetsPage() {
  const profileQuery = useProfile()
  const timezone = profileQuery.data?.timezone ?? "Asia/Singapore"
  const currentMonth = getCurrentMonthStart(timezone)
  const [monthOverride, setMonthOverride] = useState<string | null>(null)
  const selectedMonth = monthOverride ?? currentMonth
  const summaryQuery = useBudgetSummary(selectedMonth, Boolean(profileQuery.data))
  const categoriesQuery = useCategories()
  const [monthlyDialogOpen, setMonthlyDialogOpen] = useState(false)
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<CategoryBudgetSummary | null>(null)

  if (profileQuery.isLoading || summaryQuery.isLoading || categoriesQuery.isLoading) return <BudgetSkeleton />
  if (profileQuery.isError || summaryQuery.isError || categoriesQuery.isError || !summaryQuery.data || !profileQuery.data) {
    return <BudgetError onRetry={() => void summaryQuery.refetch()} />
  }

  const summary = summaryQuery.data
  const currencyCode = summary.currency_code

  return (
    <div className="mx-auto max-w-4xl space-y-6 sm:space-y-8">
      <header>
        <p className="eyebrow">Plan your spending</p>
        <div className="mt-2 flex items-center justify-between gap-3">
          <h1 className="text-3xl font-semibold tracking-tight">Budgets</h1>
          {summary.budget_exists && <Button variant="outline" size="sm" onClick={() => setMonthlyDialogOpen(true)}><Pencil /> Edit overall</Button>}
        </div>
      </header>

      <MonthNavigator monthStart={selectedMonth} onChange={setMonthOverride} />

      {summary.currency_mismatch ? (
        <Card className="border-amber-400/30"><CardContent className="py-7 text-sm text-amber-100">This historical budget uses a different currency from your current profile. Its limits are preserved, but they are not compared with current base-currency spending.</CardContent></Card>
      ) : summary.budget_exists ? (
        <BudgetOverview summary={summary} />
      ) : (
        <NoBudgetState summary={summary} onSet={() => setMonthlyDialogOpen(true)} onCopied={() => void summaryQuery.refetch()} />
      )}

      {summary.budget_exists && !summary.currency_mismatch && (
        <CategoryBudgetsSection
          summary={summary}
          onAdd={() => { setEditingCategory(null); setCategoryDialogOpen(true) }}
          onEdit={(budget) => { setEditingCategory(budget); setCategoryDialogOpen(true) }}
        />
      )}

      {summary.excluded_foreign_expense_count > 0 && (
        <p className="rounded-2xl bg-amber-400/8 px-4 py-3 text-sm leading-6 text-amber-100 ring-1 ring-amber-400/20">
          Some foreign-currency expenses are excluded because no trusted conversion rate is available.
        </p>
      )}

      {monthlyDialogOpen && <MonthlyBudgetDialog open onOpenChange={setMonthlyDialogOpen} monthStart={selectedMonth} currencyCode={currencyCode} currentAmountMinor={summary.overall_budget_minor} />}
      {categoryDialogOpen && <CategoryBudgetDialog
        open={categoryDialogOpen}
        onOpenChange={setCategoryDialogOpen}
        monthStart={selectedMonth}
        currencyCode={currencyCode}
        categories={categoriesQuery.data ?? []}
        currentUserId={profileQuery.data.id}
        usedCategoryIds={summary.category_budgets.map((budget) => budget.category_id)}
        editing={editingCategory ? { categoryId: editingCategory.category_id, categoryName: editingCategory.category_name, amountMinor: editingCategory.budget_minor } : null}
      />}
    </div>
  )
}

function MonthNavigator({ monthStart, onChange }: { monthStart: string; onChange: (value: string) => void }) {
  return (
    <div className="grid grid-cols-[3rem_1fr_3rem] items-center rounded-2xl bg-surface-elevated px-2 py-2 ring-1 ring-white/5" aria-label="Budget month">
      <Button variant="ghost" size="icon" aria-label="Previous month" onClick={() => onChange(shiftMonthStart(monthStart, -1))}><ChevronLeft /></Button>
      <div className="text-center text-base font-semibold">{formatBudgetMonth(monthStart)}</div>
      <Button variant="ghost" size="icon" aria-label="Next month" onClick={() => onChange(shiftMonthStart(monthStart, 1))}><ChevronRight /></Button>
    </div>
  )
}

function BudgetOverview({ summary }: { summary: MonthlyBudgetSummary }) {
  const budget = summary.overall_budget_minor ?? 0
  const progress = getBudgetProgress(summary.spent_minor, budget)
  const overBudget = (summary.over_budget_minor ?? 0) > 0
  return (
    <section className="rounded-[1.75rem] bg-surface-elevated p-5 ring-1 ring-white/5 sm:p-7">
      <p className="eyebrow">Monthly budget</p>
      <div className="mt-4 flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="text-[clamp(1.75rem,8vw,3.25rem)] font-semibold tracking-tight text-foreground">{formatCurrency(summary.spent_minor, summary.currency_code)}</span>
        <span className="text-base text-muted-foreground">/ {formatCurrency(budget, summary.currency_code)}</span>
      </div>
      <BudgetProgress value={progress.visualPercentage} overBudget={overBudget} />
      <div className="mt-3 flex flex-wrap justify-between gap-2 text-sm">
        <span>{formatPercentage(progress.percentageUsed)} used</span>
        <span className={overBudget ? "text-destructive" : "text-muted-foreground"}>{overBudget ? `${formatCurrency(summary.over_budget_minor ?? 0, summary.currency_code)} over budget` : `${formatCurrency(summary.remaining_minor ?? 0, summary.currency_code)} remaining`}</span>
      </div>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <Guidance label={summary.period_status === "current" ? "Safe to spend" : "Month status"} value={getGuidanceValue(summary)} helper={getGuidanceHelper(summary)} />
        <Guidance label="Spending pace" value={paceLabel(summary.pace_status)} helper={paceHelper(summary)} tone={summary.pace_status === "over_budget" ? "negative" : summary.pace_status === "on_track" || summary.pace_status === "within_budget" ? "positive" : "neutral"} />
      </div>
    </section>
  )
}

function Guidance({ label, value, helper, tone = "neutral" }: { label: string; value: string; helper: string; tone?: "neutral" | "positive" | "negative" }) {
  return <div className="rounded-2xl bg-surface px-4 py-4 ring-1 ring-border/25"><p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">{label}</p><p className={cn("mt-2 text-lg font-semibold", tone === "positive" && "text-positive", tone === "negative" && "text-destructive")}>{value}</p><p className="mt-1 text-xs text-muted-foreground">{helper}</p></div>
}

function CategoryBudgetsSection({ summary, onAdd, onEdit }: { summary: MonthlyBudgetSummary; onAdd: () => void; onEdit: (budget: CategoryBudgetSummary) => void }) {
  const categoryTotal = summary.category_budgets.reduce((total, item) => total + item.budget_minor, 0)
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3"><div><p className="eyebrow">Category budgets</p><h2 className="mt-1 text-xl font-semibold">Optional limits</h2></div><Button variant="outline" size="sm" onClick={onAdd}><Plus /> Add</Button></div>
      {categoryTotal > (summary.overall_budget_minor ?? 0) && <p className="rounded-xl bg-amber-400/8 px-4 py-3 text-sm text-amber-100 ring-1 ring-amber-400/20">Your category budgets total {formatCurrency(categoryTotal, summary.currency_code)}, above the {formatCurrency(summary.overall_budget_minor ?? 0, summary.currency_code)} overall budget.</p>}
      {summary.category_budgets.length === 0 ? <div className="rounded-2xl bg-surface-elevated px-5 py-8 text-center text-sm text-muted-foreground ring-1 ring-white/5">No category limits set. Your overall monthly budget still tracks all eligible expenses.</div> : summary.category_budgets.map((budget) => <CategoryBudgetRow key={budget.id} budget={budget} currencyCode={summary.currency_code} onEdit={() => onEdit(budget)} monthStart={summary.month_start} />)}
    </section>
  )
}

function CategoryBudgetRow({ budget, currencyCode, onEdit, monthStart }: { budget: CategoryBudgetSummary; currencyCode: string; onEdit: () => void; monthStart: string }) {
  const removeMutation = useRemoveCategoryBudget()
  const progress = getBudgetProgress(budget.spent_minor, budget.budget_minor)
  const over = budget.remaining_minor < 0
  const remove = () => {
    if (!window.confirm(`Remove the ${budget.category_name} budget limit? Transactions and the category will not be deleted.`)) return
    removeMutation.mutate({ monthStart, categoryId: budget.category_id }, {
      onSuccess: () => toast.success("Category budget removed."),
      onError: (cause) => toast.error(getErrorMessage(cause, "The category budget could not be removed.")),
    })
  }
  return (
    <div className="rounded-2xl bg-surface-elevated p-4 ring-1 ring-white/5 sm:p-5">
      <div className="flex min-w-0 items-start justify-between gap-3"><div className="min-w-0"><h3 className="truncate font-semibold">{budget.category_name}{budget.category_archived && <span className="ml-2 text-xs font-normal text-muted-foreground">Archived</span>}</h3><p className="mt-1 text-sm text-muted-foreground">{formatCurrency(budget.spent_minor, currencyCode)} / {formatCurrency(budget.budget_minor, currencyCode)}</p></div><div className="flex shrink-0"><Button variant="ghost" size="icon-sm" aria-label={`Edit ${budget.category_name} budget`} disabled={budget.category_archived} onClick={onEdit}><Pencil /></Button><Button variant="ghost" size="icon-sm" aria-label={`Remove ${budget.category_name} budget`} disabled={removeMutation.isPending} onClick={remove}>{removeMutation.isPending ? <LoaderCircle className="animate-spin" /> : <Trash2 />}</Button></div></div>
      <BudgetProgress value={progress.visualPercentage} overBudget={over} />
      <p className={cn("mt-2 text-sm", over ? "text-destructive" : "text-muted-foreground")}>{over ? `${formatCurrency(Math.abs(budget.remaining_minor), currencyCode)} over limit` : `${formatCurrency(budget.remaining_minor, currencyCode)} remaining`}</p>
    </div>
  )
}

function BudgetProgress({ value, overBudget }: { value: number; overBudget: boolean }) {
  return <div className="mt-4 h-2 overflow-hidden rounded-full bg-primary/12" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value)}><div className={cn("h-full rounded-full transition-[width]", overBudget ? "bg-destructive" : "bg-primary")} style={{ width: `${value}%` }} /></div>
}

function NoBudgetState({ summary, onSet, onCopied }: { summary: MonthlyBudgetSummary; onSet: () => void; onCopied: () => void }) {
  const copyMutation = useCopyPreviousBudget()
  const copy = () => copyMutation.mutate({ sourceMonthStart: shiftMonthStart(summary.month_start, -1), destinationMonthStart: summary.month_start }, {
    onSuccess: (result) => { const skipped = result.skipped_category_count; toast.success(skipped ? `Budget copied. ${skipped} archived category limit skipped.` : "Previous month budget copied."); onCopied() },
    onError: (cause) => toast.error(getErrorMessage(cause, "The previous budget could not be copied.")),
  })
  return <Card className="border-0 bg-card/60 shadow-none ring-1 ring-white/5"><CardContent className="flex min-h-72 flex-col items-center justify-center px-5 text-center"><PiggyBank className="size-10 text-primary" /><h2 className="mt-5 text-xl font-semibold">No budget set for {formatBudgetMonth(summary.month_start).replace(/ \d{4}$/, "")}</h2><p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">Set a monthly spending target to track your spending, remaining allowance, and pace.</p><div className="mt-5 flex flex-wrap justify-center gap-3"><Button onClick={onSet}>Set monthly budget</Button>{summary.previous_budget_exists && <Button variant="outline" disabled={copyMutation.isPending} onClick={copy}>{copyMutation.isPending ? <LoaderCircle className="animate-spin" /> : <Copy />}Copy previous month</Button>}</div></CardContent></Card>
}

function getGuidanceValue(summary: MonthlyBudgetSummary) {
  if (summary.period_status === "current") return `${formatCurrency(summary.safe_daily_spend_minor ?? 0, summary.currency_code)}/day`
  if (summary.period_status === "future") return "Not started"
  return (summary.over_budget_minor ?? 0) > 0 ? `${formatCurrency(summary.over_budget_minor ?? 0, summary.currency_code)} over` : `${formatCurrency(summary.remaining_minor ?? 0, summary.currency_code)} unused`
}

function getGuidanceHelper(summary: MonthlyBudgetSummary) {
  if (summary.period_status === "current") return `${summary.remaining_days_including_today} calendar days including today`
  if (summary.period_status === "future") return "Guidance begins when the month starts"
  return "Final performance; unused budget does not roll over"
}

function paceLabel(status: MonthlyBudgetSummary["pace_status"]) {
  return ({ no_budget: "No budget", not_started: "Not started", on_track: "On track", ahead_of_pace: "Spending ahead of pace", within_budget: "Within budget", over_budget: "Over budget" })[status]
}

function paceHelper(summary: MonthlyBudgetSummary) {
  if (summary.period_status !== "current" || summary.expected_spend_minor === null) return summary.period_status === "past" ? "Final month result" : "No current pace comparison"
  const difference = Math.abs(summary.spent_minor - summary.expected_spend_minor)
  return `${formatCurrency(difference, summary.currency_code)} ${summary.spent_minor <= summary.expected_spend_minor ? "under" : "above"} expected spend to date`
}

function formatPercentage(value: number) { return `${new Intl.NumberFormat("en-SG", { maximumFractionDigits: 1 }).format(value)}%` }
function BudgetError({ onRetry }: { onRetry: () => void }) { return <Card className="border-destructive/30"><CardContent className="py-12 text-center"><h1 className="text-lg font-semibold">Budgets unavailable</h1><p className="mt-2 text-sm text-muted-foreground">Check your connection and ensure the V1.4 migration is applied.</p><Button className="mt-5" variant="outline" onClick={onRetry}>Try again</Button></CardContent></Card> }
function BudgetSkeleton() { return <div className="mx-auto max-w-4xl space-y-5"><Skeleton className="h-12 w-48" /><Skeleton className="h-16 rounded-2xl" /><Skeleton className="h-80 rounded-[1.75rem]" /><Skeleton className="h-40 rounded-2xl" /></div> }
