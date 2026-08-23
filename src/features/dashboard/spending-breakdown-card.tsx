import { formatCurrency } from "@/lib/currency"
import { cn } from "@/lib/utils"

const colors = ["bg-chart-1", "bg-chart-2", "bg-chart-3", "bg-chart-4", "bg-chart-5"]

export function SpendingBreakdownCard({
  groups,
  currencyCode,
  className,
}: {
  groups: Array<{ label: string; amountMinor: number }>
  currencyCode: string
  className?: string
}) {
  const total = groups.reduce((sum, group) => sum + group.amountMinor, 0)

  return (
    <section className={className} aria-labelledby="spending-heading">
      <div className="mb-3 px-1">
        <h2 id="spending-heading" className="section-heading">This month by category</h2>
      </div>
      <div className="space-y-5 rounded-2xl bg-card/55 p-4 ring-1 ring-white/4 sm:p-5">
        {groups.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">No expenses recorded this month.</p>
        ) : groups.slice(0, 5).map((group, index) => {
          const percentage = total === 0 ? 0 : Math.round((group.amountMinor / total) * 100)
          const color = colors[index % colors.length]
          return (
            <div key={group.label}>
              <div className="mb-2 flex items-center justify-between gap-4 text-sm">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className={`size-2 rounded-full ${color}`} aria-hidden="true" />
                  <span className="truncate font-medium">{group.label}</span>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{formatCurrency(group.amountMinor, currencyCode)} · {percentage}%</span>
              </div>
              <div className="h-1 overflow-hidden rounded-full bg-surface">
                <div className={cn("h-full rounded-full", color)} style={{ width: `${percentage}%` }} />
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
