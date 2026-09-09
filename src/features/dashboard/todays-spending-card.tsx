import { TrendingUp } from "lucide-react"
import { Link } from "react-router-dom"

import { Card, CardContent } from "@/components/ui/card"
import { getTodaySpendingTransactionsHref } from "@/features/dashboard/daily-spending"
import { formatCurrency } from "@/lib/currency"

type TodaysSpendingCardProps = {
  averageMinor: number
  currencyCode: string
  localDate: string
  todayMinor: number
}

export function TodaysSpendingCard({ averageMinor, currencyCode, localDate, todayMinor }: TodaysSpendingCardProps) {
  return (
    <Link
      className="group col-span-2 rounded-2xl outline-none focus-visible:ring-3 focus-visible:ring-ring/35 lg:col-span-1"
      to={getTodaySpendingTransactionsHref(localDate)}
      aria-label={`Today's spending. View eligible expenses for ${localDate}.`}
    >
      <Card className="h-full border-0 bg-card/80 py-0 shadow-none ring-1 ring-white/4 transition-colors group-hover:bg-card group-focus-visible:ring-primary/40">
        <CardContent className="min-w-0 p-4 sm:p-5">
          <div className="flex items-start justify-between gap-2">
            <p className="eyebrow leading-5">Today's spending</p>
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <TrendingUp className="size-4" aria-hidden="true" />
            </span>
          </div>
          <p className="mt-3 whitespace-nowrap text-[clamp(1rem,5vw,1.5rem)] font-semibold tracking-tight tabular-nums">
            {formatCurrency(todayMinor, currencyCode)}
          </p>
          <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
            7-day avg {formatCurrency(averageMinor, currencyCode)}/day
          </p>
        </CardContent>
      </Card>
    </Link>
  )
}
