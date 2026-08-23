import { useMemo, useState } from "react"
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

import { formatSnapshotTooltipLabel, netWorthChartKeys, type NetWorthChartDatum } from "@/features/dashboard/net-worth-trend"
import { formatCurrency, formatSignedCurrency } from "@/lib/currency"
import { isValidIsoCalendarDate } from "@/lib/dates"
import { cn } from "@/lib/utils"
import type { NetWorthSnapshot } from "@/types/database"

type TrendPeriod = 30 | 90

export function NetWorthTrendCard({ snapshots, currencyCode, className }: { snapshots: NetWorthSnapshot[]; currencyCode: string; className?: string }) {
  const [period, setPeriod] = useState<TrendPeriod>(30)
  const chronological = useMemo(() => [...snapshots].reverse(), [snapshots])
  const datedSnapshots = useMemo(
    () => chronological.filter((snapshot) => isValidIsoCalendarDate(snapshot.snapshot_date)),
    [chronological],
  )
  const visible = useMemo(() => {
    const latestDate = datedSnapshots.at(-1)?.snapshot_date
    if (!latestDate) return []
    const cutoff = new Date(`${latestDate}T00:00:00Z`)
    cutoff.setUTCDate(cutoff.getUTCDate() - period + 1)
    return datedSnapshots.filter((snapshot) => new Date(`${snapshot.snapshot_date}T00:00:00Z`) >= cutoff)
  }, [datedSnapshots, period])
  const latest = chronological.at(-1)
  const firstVisible = visible[0]
  const latestVisible = visible.at(-1)
  const changeMinor = latestVisible && firstVisible && visible.length > 1
    ? latestVisible.total_value_base_minor - firstVisible.total_value_base_minor
    : null
  const changePercentage = changeMinor !== null && firstVisible.total_value_base_minor !== 0
    ? Math.abs((changeMinor / firstVisible.total_value_base_minor) * 100)
    : null
  const chartData: NetWorthChartDatum[] = visible.map((snapshot) => ({
    snapshotDate: snapshot.snapshot_date,
    totalValueMinor: snapshot.total_value_base_minor,
  }))

  return (
    <section className={cn("overflow-hidden rounded-[1.75rem] bg-card/35 py-5 sm:px-8 sm:py-8", className)} aria-labelledby="net-worth-heading">
      <div className="px-1 sm:px-0">
        <div className="flex items-center gap-2">
          <h2 id="net-worth-heading" className="eyebrow">Total net worth</h2>
          <span className="size-1.5 rounded-full bg-positive" aria-hidden="true" />
          <span className="text-[0.68rem] text-muted-foreground">Updated today</span>
        </div>
        <p className="mt-2 whitespace-nowrap font-serif text-[clamp(2.15rem,11.5vw,4.75rem)] leading-none font-normal tracking-[-0.055em] text-foreground tabular-nums">
          {formatCurrency(latest?.total_value_base_minor ?? 0, currencyCode)}
        </p>
        {changeMinor !== null && (
          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
            <span className={cn(
              "rounded-full px-2.5 py-1 font-semibold tabular-nums",
              changeMinor >= 0 ? "bg-positive/10 text-positive" : "bg-negative/10 text-negative",
            )}>
              {formatSignedCurrency(changeMinor, currencyCode)}
            </span>
            <span className="text-muted-foreground">
              {changePercentage !== null ? `${changePercentage.toFixed(1)}% ` : ""}over {period === 30 ? "1 month" : "3 months"}
            </span>
          </div>
        )}
      </div>

      <div className="mt-5 h-30 w-full sm:h-36" role="img" aria-label={`Net worth trend over ${period === 30 ? "one month" : "three months"}`}>
        {chartData.length > 1 ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: 2, bottom: 8, left: 2 }}>
              <XAxis dataKey={netWorthChartKeys.snapshotDate} hide />
              <YAxis hide domain={["dataMin", "dataMax"]} />
              <Tooltip
                cursor={{ stroke: "var(--border)", strokeDasharray: "3 3" }}
                contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: "0.75rem", color: "var(--foreground)" }}
                formatter={(value) => [formatCurrency(Number(value), currencyCode), "Net worth"]}
                labelFormatter={formatSnapshotTooltipLabel}
              />
              <Line type="monotone" dataKey={netWorthChartKeys.totalValueMinor} stroke="var(--primary)" strokeWidth={2.25} dot={false} activeDot={{ r: 4, fill: "var(--primary)", stroke: "var(--background)", strokeWidth: 2 }} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center border-b border-primary/40 text-xs text-muted-foreground">
            More daily snapshots will build your trend.
          </div>
        )}
      </div>

      <div className="mx-auto mt-2 grid max-w-xs grid-cols-2 gap-2 rounded-full bg-surface p-1">
        {([30, 90] as const).map((days) => (
          <button
            key={days}
            type="button"
            aria-pressed={period === days}
            onClick={() => setPeriod(days)}
            className={cn(
              "min-h-9 rounded-full px-4 text-xs font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-ring",
              period === days ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {days === 30 ? "1M" : "3M"}
          </button>
        ))}
      </div>
    </section>
  )
}
