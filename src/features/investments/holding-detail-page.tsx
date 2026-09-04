import { ArrowLeft } from "lucide-react"
import { Link, Navigate, useParams } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useDetailedInvestment } from "@/features/investments/investments-hooks"
import { multiplyDecimalToMinorUnits } from "@/features/investments/investment-logic"
import { formatCurrency, formatSignedCurrency, getMinorUnitDigits } from "@/lib/currency"
import { formatShortDate } from "@/lib/dates"

export function HoldingDetailPage() {
  const { accountId, holdingId } = useParams()
  const query = useDetailedInvestment(accountId)
  if (query.isLoading) return <Skeleton className="h-[35rem] rounded-3xl" />

  const holding = query.data?.holdings.find((item) => item.id === holdingId)
  if (!accountId || !holding || !query.data) {
    return <Navigate to={accountId ? `/investments/${accountId}` : "/investments"} replace />
  }

  const currency = query.data.account.currency_code
  const priceHistory = query.data.prices.filter((item) => item.holding_id === holding.id)
  const activity = [
    ...query.data.trades
      .filter((item) => item.holding_id === holding.id)
      .map((item) => ({
        id: item.id,
        date: item.trade_date,
        title: item.trade_type === "opening_position" ? "Opening position" : item.trade_type === "buy" ? "Buy" : "Sell",
        detail: `${item.quantity} @ ${formatInvestmentPrice(item.unit_price, currency)}`,
      })),
    ...query.data.cash_events
      .filter((item) => item.holding_id === holding.id)
      .map((item) => ({
        id: item.id,
        date: item.event_date,
        title: "Dividend",
        detail: formatSignedCurrency(item.amount_minor, currency),
      })),
    ...priceHistory.map((item) => ({
      id: item.id,
      date: item.priced_at,
      title: "Manual price",
      detail: formatInvestmentPrice(item.price, currency),
    })),
  ].sort((left, right) => right.date.localeCompare(left.date))

  return (
    <div className="mx-auto max-w-2xl space-y-7">
      <header className="flex items-center gap-3">
        <Button
          size="icon"
          variant="ghost"
          aria-label="Back to investment account"
          render={<Link to={`/investments/${accountId}`} />}
        >
          <ArrowLeft />
        </Button>
        <div>
          <p className="eyebrow">Holding</p>
          <h1 className="text-2xl font-semibold">{holding.symbol}</h1>
          <p className="text-sm text-muted-foreground">{holding.name}</p>
        </div>
      </header>

      <section className="rounded-3xl bg-card/65 p-5 ring-1 ring-white/5">
        <dl className="grid grid-cols-2 gap-5">
          <Metric
            label="Quantity"
            value={new Intl.NumberFormat("en-SG", { maximumFractionDigits: 10 }).format(holding.quantity)}
          />
          <Metric
            label="Average cost"
            value={holding.average_cost_minor === null ? "—" : formatCurrency(holding.average_cost_minor, currency)}
          />
          <Metric
            label="Current price"
            value={holding.latest_price === null ? "Price needed" : formatInvestmentPrice(holding.latest_price, currency)}
          />
          <Metric
            label="Market value"
            value={holding.market_value_minor === null ? "—" : formatCurrency(holding.market_value_minor, currency)}
          />
          <Metric label="Cost basis" value={formatCurrency(holding.cost_basis_minor, currency)} />
          <Metric
            label="Unrealised"
            value={holding.unrealized_gain_minor === null ? "—" : formatSignedCurrency(holding.unrealized_gain_minor, currency)}
          />
        </dl>
      </section>

      <section>
        <h2 className="section-heading mb-3">Activity</h2>
        <div className="overflow-hidden rounded-2xl bg-card/55 ring-1 ring-white/5">
          {activity.map((item, index) => (
            <div
              key={item.id}
              className={`flex justify-between gap-4 px-4 py-3 ${index ? "border-t border-border/25" : ""}`}
            >
              <div>
                <p className="text-sm font-medium">{item.title}</p>
                <p className="text-xs text-muted-foreground">{formatShortDate(item.date)}</p>
              </div>
              <p className="text-sm tabular-nums">{item.detail}</p>
            </div>
          ))}
          {activity.length === 0 && (
            <p className="p-6 text-center text-sm text-muted-foreground">No holding activity.</p>
          )}
        </div>
      </section>
    </div>
  )
}

function formatInvestmentPrice(value: number, currencyCode: string) {
  const minorScale = 10 ** getMinorUnitDigits(currencyCode)
  const minorValue = multiplyDecimalToMinorUnits("1", value.toString(), minorScale)
  if (
    minorValue === null
    || minorValue > BigInt(Number.MAX_SAFE_INTEGER)
    || minorValue < BigInt(Number.MIN_SAFE_INTEGER)
  ) {
    return `${currencyCode} ${value}`
  }
  return formatCurrency(Number(minorValue), currencyCode)
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 break-words font-semibold tabular-nums">{value}</dd>
    </div>
  )
}
