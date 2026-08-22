import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatCurrency } from "@/lib/currency"

const colors = ["bg-emerald-600", "bg-sky-500", "bg-amber-500", "bg-violet-500", "bg-slate-400"]

export function SpendingBreakdownCard({
  groups,
  currencyCode,
}: {
  groups: Array<{ label: string; amountMinor: number }>
  currencyCode: string
}) {
  const total = groups.reduce((sum, group) => sum + group.amountMinor, 0)

  return (
    <Card className="shadow-xs">
      <CardHeader className="border-b">
        <CardTitle>Spending breakdown</CardTitle>
        <p className="text-xs text-muted-foreground">Current month by parent category</p>
      </CardHeader>
      <CardContent className="space-y-5">
        {groups.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted-foreground">No expenses recorded this month.</p>
        ) : groups.slice(0, 5).map((group, index) => {
          const percentage = total === 0 ? 0 : Math.round((group.amountMinor / total) * 100)
          const color = colors[index % colors.length]
          return (
            <div key={group.label}>
              <div className="mb-2 flex items-center justify-between gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <span className={`size-2 rounded-full ${color}`} />
                  <span className="font-medium">{group.label}</span>
                </div>
                <span className="text-muted-foreground">{formatCurrency(group.amountMinor, currencyCode)}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div className={`h-full rounded-full ${color}`} style={{ width: `${percentage}%` }} />
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
