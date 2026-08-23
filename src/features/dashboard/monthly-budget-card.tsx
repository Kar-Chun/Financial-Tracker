import { ArrowRight, PiggyBank } from "lucide-react"
import { Link } from "react-router-dom"

import { getBudgetProgress } from "@/features/budgets/budget-logic"
import type { MonthlyBudgetSummary } from "@/features/budgets/budget-types"
import { formatCurrency } from "@/lib/currency"
import { cn } from "@/lib/utils"

export function MonthlyBudgetCard({ summary }: { summary: MonthlyBudgetSummary | undefined }) {
  if (!summary) return null
  if (!summary.budget_exists || summary.overall_budget_minor === null) {
    return (
      <Link to="/budgets" className="group flex items-center justify-between gap-4 rounded-2xl bg-surface-elevated px-5 py-5 ring-1 ring-white/5 transition-colors hover:bg-accent/50">
        <div className="flex min-w-0 items-center gap-3"><span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/12 text-primary"><PiggyBank className="size-5" /></span><div><p className="font-semibold">Monthly budget</p><p className="mt-1 text-sm text-muted-foreground">No budget set · Set a spending target</p></div></div><ArrowRight className="size-5 shrink-0 text-primary transition-transform group-hover:translate-x-0.5" />
      </Link>
    )
  }
  const progress = getBudgetProgress(summary.spent_minor, summary.overall_budget_minor)
  const over = (summary.over_budget_minor ?? 0) > 0
  return (
    <Link to="/budgets" className="group block rounded-2xl bg-surface-elevated p-5 ring-1 ring-white/5 transition-colors hover:bg-accent/50">
      <div className="flex items-center justify-between gap-3"><p className="font-semibold">Monthly budget</p><ArrowRight className="size-5 text-primary transition-transform group-hover:translate-x-0.5" /></div>
      <p className="mt-3 text-lg font-semibold">{formatCurrency(summary.spent_minor, summary.currency_code)} <span className="text-sm font-normal text-muted-foreground">/ {formatCurrency(summary.overall_budget_minor, summary.currency_code)}</span></p>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-primary/12"><div className={cn("h-full rounded-full", over ? "bg-destructive" : "bg-primary")} style={{ width: `${progress.visualPercentage}%` }} /></div>
      <p className={cn("mt-2 text-sm", over ? "text-destructive" : "text-muted-foreground")}>{over ? `${formatCurrency(summary.over_budget_minor ?? 0, summary.currency_code)} over budget` : `${formatCurrency(summary.remaining_minor ?? 0, summary.currency_code)} remaining`} · {paceLabel(summary.pace_status)}</p>
    </Link>
  )
}

function paceLabel(status: MonthlyBudgetSummary["pace_status"]) {
  return ({ no_budget: "No budget", not_started: "Not started", on_track: "On track", ahead_of_pace: "Ahead of pace", within_budget: "Within budget", over_budget: "Over budget" })[status]
}
