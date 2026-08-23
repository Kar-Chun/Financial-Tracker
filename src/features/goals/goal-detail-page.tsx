import { ArrowLeft, Archive, CalendarDays, Pencil, RotateCcw } from "lucide-react"
import { useState } from "react"
import { Link, Navigate, useParams } from "react-router-dom"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { useProfile } from "@/features/auth/profile-service"
import { AllocationDialog } from "@/features/goals/allocation-dialog"
import { GoalForm } from "@/features/goals/goal-form"
import { formatGoalPercent, getGoalProgress, getRequiredMonthly } from "@/features/goals/goal-logic"
import { useSavingsGoalDetail, useSetSavingsGoalArchived } from "@/features/goals/goals-hooks"
import { formatCurrency, formatSignedCurrency } from "@/lib/currency"
import { formatLongDate, formatShortDate, getDateInputInTimeZone } from "@/lib/dates"
import { getErrorMessage } from "@/lib/errors"
import { cn } from "@/lib/utils"

export function GoalDetailPage() {
  const { goalId } = useParams()
  const query = useSavingsGoalDetail(goalId)
  const profileQuery = useProfile()
  const archiveMutation = useSetSavingsGoalArchived()
  const [allocationOperation, setAllocationOperation] = useState<"allocate" | "reduce" | null>(null)
  const [editing, setEditing] = useState(false)
  if (!goalId) return <Navigate to="/goals" replace />
  if (query.isLoading || profileQuery.isLoading) return <div className="mx-auto max-w-3xl space-y-5"><Skeleton className="h-12 w-48" /><Skeleton className="h-72 rounded-3xl" /><Skeleton className="h-48 rounded-2xl" /></div>
  if (query.isError || !query.data || !profileQuery.data) return <Card className="border-destructive/30"><CardContent className="py-12 text-center"><h1 className="text-lg font-semibold">Goal unavailable</h1><p className="mt-2 text-sm text-muted-foreground">It may have been removed or belongs to another user.</p><Button className="mt-5" variant="outline" render={<Link to="/goals" />}>Back to goals</Button></CardContent></Card>

  const goal = query.data
  const progress = getGoalProgress(goal.allocated_minor, goal.target_amount_minor)
  const today = getDateInputInTimeZone(profileQuery.data.timezone)
  const guidance = getRequiredMonthly({ remainingMinor: goal.remaining_minor, targetDate: goal.target_date, localToday: today, reached: goal.reached })
  const archived = Boolean(goal.archived_at)
  const setArchived = () => {
    if (!archived && goal.allocated_minor > 0 && !window.confirm(`Archive ${goal.name}? Its ${formatCurrency(goal.allocated_minor, goal.currency_code)} allocation will become unallocated in the planning view. No real money moves.`)) return
    archiveMutation.mutate({ goalId: goal.id, archived: !archived }, {
      onSuccess: () => toast.success(archived ? "Savings goal restored." : "Savings goal archived."),
      onError: (cause) => toast.error(getErrorMessage(cause, "The savings goal could not be updated.")),
    })
  }

  return <div className="mx-auto max-w-3xl space-y-6">
    <header className="flex items-center justify-between gap-3"><Button variant="ghost" size="sm" render={<Link to="/goals" />}><ArrowLeft /> Goals</Button><div className="flex gap-2"><Button variant="outline" size="sm" disabled={archived} onClick={() => setEditing(true)}><Pencil /> Edit</Button><Button variant="outline" size="sm" disabled={archiveMutation.isPending} onClick={setArchived}>{archived ? <RotateCcw /> : <Archive />}{archived ? "Restore" : "Archive"}</Button></div></header>

    <section className="rounded-[1.75rem] bg-surface-elevated p-5 ring-1 ring-white/5 sm:p-8">
      {archived && <p className="mb-4 inline-flex rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">Archived goal</p>}
      <h1 className="break-words text-3xl font-semibold tracking-tight sm:text-4xl">{goal.name}</h1>
      {goal.note && <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">{goal.note}</p>}
      <div className="mt-7 flex min-w-0 flex-wrap items-baseline gap-2"><span className="break-words text-[clamp(1.8rem,8vw,3rem)] font-semibold">{formatCurrency(goal.allocated_minor, goal.currency_code)}</span><span className="text-muted-foreground">/ {formatCurrency(goal.target_amount_minor, goal.currency_code)}</span></div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-primary/12"><div className={cn("h-full rounded-full", goal.reached ? "bg-positive" : "bg-primary")} style={{ width: `${progress.visualPercentage}%` }} /></div>
      <div className="mt-3 flex flex-wrap justify-between gap-2 text-sm"><span>{formatGoalPercent(progress.percentage)}</span><span className={goal.reached ? "text-positive" : "text-muted-foreground"}>{goal.reached ? "Goal reached" : `${formatCurrency(goal.remaining_minor, goal.currency_code)} remaining`}</span></div>
      {!goal.reached && goal.target_date && <div className="mt-6 rounded-2xl bg-surface px-4 py-4 ring-1 ring-border/25"><p className="flex items-center gap-2 text-sm font-medium"><CalendarDays className="size-4 text-primary" /> Target {formatLongDate(goal.target_date)}</p><p className="mt-2 text-sm text-muted-foreground">{guidance.targetDatePassed ? "Target date passed" : guidance.requiredMonthlyMinor !== null ? `About ${formatCurrency(guidance.requiredMonthlyMinor, goal.currency_code)}/month needed` : ""}</p></div>}
      {!archived && <div className="mt-7 grid grid-cols-2 gap-3"><Button className="h-12" onClick={() => setAllocationOperation("allocate")}>Allocate</Button><Button className="h-12" variant="outline" disabled={goal.allocated_minor <= 0} onClick={() => setAllocationOperation("reduce")}>Reduce allocation</Button></div>}
    </section>

    <section className="space-y-3"><div><p className="eyebrow">Allocation history</p><h2 className="mt-1 text-xl font-semibold">Virtual planning entries</h2></div>{goal.allocations.length === 0 ? <div className="rounded-2xl bg-surface px-4 py-8 text-center text-sm text-muted-foreground ring-1 ring-border/25">No allocation history yet.</div> : <div className="overflow-hidden rounded-2xl bg-surface-elevated ring-1 ring-white/5">{goal.allocations.map((allocation) => <div key={allocation.id} className="flex min-w-0 items-center justify-between gap-4 border-b border-border/20 px-4 py-4 last:border-0"><div className="min-w-0"><p className="break-words font-medium">{allocation.note || (allocation.amount_minor > 0 ? "Allocation" : "Reduced allocation")}</p><p className="mt-1 text-sm text-muted-foreground">{formatShortDate(allocation.allocation_date)}</p></div><span className={cn("shrink-0 font-medium", allocation.amount_minor > 0 ? "text-positive" : "text-destructive")}>{formatSignedCurrency(allocation.amount_minor, goal.currency_code)}</span></div>)}</div>}</section>

    {allocationOperation && <AllocationDialog open onOpenChange={(open) => { if (!open) setAllocationOperation(null) }} goalId={goal.id} goalName={goal.name} currencyCode={goal.currency_code} operation={allocationOperation} initialDate={today} />}
    {editing && <Dialog open onOpenChange={setEditing}><DialogContent><DialogHeader><DialogTitle>Edit savings goal</DialogTitle><DialogDescription>Changing the target does not alter existing allocation history.</DialogDescription></DialogHeader><GoalForm currencyCode={goal.currency_code} goal={goal} onCancel={() => setEditing(false)} onSaved={() => setEditing(false)} /></DialogContent></Dialog>}
  </div>
}
