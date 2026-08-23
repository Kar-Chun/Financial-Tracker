import { ArrowRight, Target } from "lucide-react"
import { Link } from "react-router-dom"

import { GoalProgress } from "@/features/goals/goal-progress"
import type { SavingsGoalsSummary } from "@/features/goals/goal-types"

export function SavingsGoalsCard({ summary }: { summary: SavingsGoalsSummary | undefined }) {
  if (!summary) return null
  const goals = summary.goals.filter((goal) => !goal.archived_at).slice(0, 2)
  return <section className="rounded-2xl bg-surface-elevated p-5 ring-1 ring-white/5">
    <div className="flex items-center justify-between gap-4"><div><p className="eyebrow">Savings goals</p><h2 className="mt-1 text-lg font-semibold">What you are saving toward</h2></div><Link to="/goals" className="flex shrink-0 items-center gap-1 text-sm font-medium text-primary">View all <ArrowRight className="size-4" /></Link></div>
    {goals.length === 0 ? <Link to="/goals/new" className="mt-4 flex items-center gap-3 rounded-xl bg-surface px-4 py-4 text-sm text-muted-foreground ring-1 ring-border/25"><Target className="size-5 text-primary" /><span><strong className="font-medium text-foreground">No goals yet.</strong> Create a savings target.</span></Link> : <div className="mt-5 grid gap-5 sm:grid-cols-2">{goals.map((goal) => <GoalProgress key={goal.id} goal={goal} compact />)}</div>}
  </section>
}
