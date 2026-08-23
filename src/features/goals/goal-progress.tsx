import { Link } from "react-router-dom"

import { formatGoalPercent, getGoalProgress } from "@/features/goals/goal-logic"
import type { SavingsGoalSummary } from "@/features/goals/goal-types"
import { formatCurrency } from "@/lib/currency"
import { cn } from "@/lib/utils"

export function GoalProgress({ goal, compact = false, linked = true }: { goal: SavingsGoalSummary; compact?: boolean; linked?: boolean }) {
  const progress = getGoalProgress(goal.allocated_minor, goal.target_amount_minor)
  const content = (
    <div className={cn("min-w-0", !compact && "rounded-2xl bg-surface-elevated p-4 ring-1 ring-white/5 sm:p-5")}>
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0"><h3 className="break-words font-semibold text-foreground">{goal.name}</h3><p className="mt-1 text-sm text-muted-foreground">{formatCurrency(goal.allocated_minor, goal.currency_code)} / {formatCurrency(goal.target_amount_minor, goal.currency_code)}</p></div>
        <span className={cn("shrink-0 text-sm font-medium", goal.reached ? "text-positive" : "text-primary")}>{formatGoalPercent(progress.percentage)}</span>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-primary/12" role="progressbar" aria-label={`${goal.name} progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress.visualPercentage)}>
        <div className={cn("h-full rounded-full", goal.reached ? "bg-positive" : "bg-primary")} style={{ width: `${progress.visualPercentage}%` }} />
      </div>
      {!compact && <p className="mt-3 text-sm text-muted-foreground">{goal.reached ? "Goal reached" : goal.target_date_passed ? "Target date passed" : goal.required_monthly_minor !== null ? `About ${formatCurrency(goal.required_monthly_minor, goal.currency_code)}/month needed` : `${formatCurrency(goal.remaining_minor, goal.currency_code)} remaining`}</p>}
    </div>
  )
  return linked ? <Link className="block rounded-2xl outline-none focus-visible:ring-3 focus-visible:ring-ring" to={`/goals/${goal.id}`}>{content}</Link> : content
}
