import { buttonVariants } from "@/components/ui/button-variants"
import { PageTitle, SectionHeader, ValueSummary } from "@/components/shared/finance-ui"

import { ArrowRight, PiggyBank, Plus, Target } from "lucide-react"
import { Link } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { GoalProgress } from "@/features/goals/goal-progress"
import { useSavingsGoals } from "@/features/goals/goals-hooks"
import { formatCurrency } from "@/lib/currency"

export function GoalsPage() {
  const query = useSavingsGoals(true)
  if (query.isLoading) return <GoalsSkeleton />
  if (query.isError || !query.data) return <Card className="border-destructive/30"><CardContent className="py-6 text-center"><h1 className="text-lg font-semibold">Savings goals unavailable</h1><p className="mt-2 text-sm text-muted-foreground">Check your connection and ensure the V1.5 migration is applied.</p><Button className="mt-5" variant="outline" onClick={() => void query.refetch()}>Try again</Button></CardContent></Card>

  const { currency_code: currency, available_cash_minor: available, total_allocated_minor: allocated, unallocated_cash_minor: unallocated, goals } = query.data
  const active = goals.filter((goal) => !goal.archived_at)
  const archived = goals.filter((goal) => goal.archived_at)
  const otherCurrencyGoals = active.filter((goal) => goal.currency_code !== currency)
  const overAllocated = unallocated < 0

  return <div className="mx-auto max-w-5xl space-y-5 sm:space-y-6">
    <header className="flex flex-wrap items-end justify-between gap-3"><PageTitle title="Savings Goals" /><Link to="/goals/new" data-slot="button" className={buttonVariants({  })}><Plus /> Create goal</Link></header>

    <section className="min-w-0 border-b border-border/30 pb-5" aria-label="Available cash">
      <p className="eyebrow">Available cash</p>
      <p className="value-hero">{formatCurrency(available, currency)}</p>
      <p className="mt-1 text-sm text-muted-foreground">Eligible base-currency Bank + Cash</p>
      <div className="mt-4 grid grid-cols-2 gap-3"><ValueSummary label="Allocated to active goals" value={formatCurrency(allocated, currency)} /><ValueSummary label={overAllocated ? "Over-allocated" : "Unallocated cash"} value={formatCurrency(Math.abs(unallocated), currency)} tone={overAllocated ? "negative" : undefined} /></div>
      {overAllocated && <p className="mt-4 rounded-xl bg-amber-400/8 px-4 py-3 text-sm text-amber-100 ring-1 ring-amber-400/20">Goals exceed available cash by {formatCurrency(Math.abs(unallocated), currency)}. This is a planning warning; no account balance was changed.</p>}
      {query.data.foreign_liquid_account_count > 0 && <p className="mt-4 text-xs leading-5 text-muted-foreground">Foreign-currency bank/cash balances are excluded because no trusted FX conversion is available.</p>}
      {otherCurrencyGoals.length > 0 && <p className="mt-2 text-xs leading-5 text-muted-foreground">Allocations for historical goals in another currency are shown on those goals but excluded from the {currency} allocation summary.</p>}
    </section>

    <section className="space-y-3"><div className="flex items-center justify-between"><SectionHeader id="active-goals" title="Your goals" /><span className="text-sm text-muted-foreground">{active.length}</span></div>
      {active.length === 0 ? <EmptyGoals /> : <div className="grid gap-3 lg:grid-cols-2">{active.map((goal) => <GoalProgress key={goal.id} goal={goal} />)}</div>}
    </section>

    {archived.length > 0 && <section className="space-y-3"><SectionHeader id="archived-goals" title="Archived goals" /><div className="grid gap-3 lg:grid-cols-2">{archived.map((goal) => <Link key={goal.id} to={`/goals/${goal.id}`} className="flex min-w-0 items-center justify-between gap-4 ledger-interactive border-b border-border/25 px-1 py-3"><div className="min-w-0"><p className="break-words font-medium">{goal.name}</p><p className="mt-1 text-sm text-muted-foreground">{formatCurrency(goal.allocated_minor, goal.currency_code)} allocated historically</p></div><ArrowRight className="size-5 shrink-0 text-muted-foreground" /></Link>)}</div></section>}
  </div>
}

function EmptyGoals() { return <div className="insight-surface flex min-h-48 flex-col items-center justify-center px-4 py-5 text-center"><span className="flex size-10 items-center justify-center rounded-lg bg-surface-elevated text-brand-secondary"><Target /></span><h3 className="mt-5 text-xl font-semibold">No savings goals yet</h3><p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">Create a goal for something you want to save towards.</p><Link to="/goals/new" data-slot="button" className={buttonVariants({ className: "mt-5" })}><PiggyBank /> Create savings goal</Link></div> }
function GoalsSkeleton() { return <div className="mx-auto max-w-5xl space-y-5"><Skeleton className="h-12 w-56" /><Skeleton className="h-52 rounded-xl" /><Skeleton className="h-40 rounded-2xl" /></div> }
