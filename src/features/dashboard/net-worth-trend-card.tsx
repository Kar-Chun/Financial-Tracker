import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatCurrency } from "@/lib/currency"
import { formatShortDate } from "@/lib/dates"
import { cn } from "@/lib/utils"
import type { NetWorthSnapshot } from "@/types/database"

export function NetWorthTrendCard({ snapshots, currencyCode, className }: { snapshots: NetWorthSnapshot[]; currencyCode: string; className?: string }) {
  const chronological = [...snapshots].reverse()
  const values = chronological.map((snapshot) => snapshot.total_value_base_minor)
  const min = Math.min(...values, 0)
  const max = Math.max(...values, 1)
  const range = Math.max(max - min, 1)

  return (
    <Card className={cn("shadow-xs xl:col-span-2", className)}>
      <CardHeader className="border-b">
        <CardTitle>Net worth trend</CardTitle>
        <p className="text-xs text-muted-foreground">Daily snapshots when you use Ledgerly</p>
      </CardHeader>
      <CardContent>
        {chronological.length === 0 ? (
          <EmptyChart message="Your first daily snapshot will appear here." />
        ) : (
          <>
            <div
              className="flex h-52 items-end gap-1.5 rounded-lg bg-linear-to-b from-primary/10 to-transparent px-3 pt-6"
              role="img"
              aria-label="Daily net worth snapshot trend"
            >
              {chronological.map((snapshot) => {
                const height = 20 + ((snapshot.total_value_base_minor - min) / range) * 80
                return (
                  <div key={snapshot.id} className="group relative flex h-full min-w-1 flex-1 items-end">
                    <div className="w-full rounded-t-sm bg-primary/80" style={{ height: `${height}%` }} />
                    <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden -translate-x-1/2 rounded bg-slate-950 px-2 py-1 text-xs whitespace-nowrap text-white group-hover:block">
                      {formatShortDate(snapshot.snapshot_date)} · {formatCurrency(snapshot.total_value_base_minor, currencyCode)}
                    </span>
                  </div>
                )
              })}
            </div>
            <div className="mt-3 flex justify-between text-xs text-muted-foreground">
              <span>{formatShortDate(chronological[0].snapshot_date)}</span>
              <span>{formatShortDate(chronological[chronological.length - 1].snapshot_date)}</span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

function EmptyChart({ message }: { message: string }) {
  return <div className="grid h-52 place-items-center rounded-lg border border-dashed text-sm text-muted-foreground">{message}</div>
}
