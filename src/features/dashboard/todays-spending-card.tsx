import { TrendingUp } from "lucide-react"
import { Link } from "react-router-dom"

import { MetricTile } from "@/components/shared/finance-ui"
import { getTodaySpendingTransactionsHref } from "@/features/dashboard/daily-spending"
import { formatCurrency } from "@/lib/currency"

type TodaysSpendingCardProps = {
  averageMinor: number
  currencyCode: string
  localDate: string
  todayMinor: number
}

export function TodaysSpendingCard({ averageMinor, currencyCode, localDate, todayMinor }: TodaysSpendingCardProps) {
  return <Link
    className="min-w-0 rounded-xl outline-none hover:bg-accent/30 focus-visible:ring-2 focus-visible:ring-ring"
    to={getTodaySpendingTransactionsHref(localDate)}
    aria-label={`Today's spending. View eligible expenses for ${localDate}.`}
  >
    <MetricTile
      label="Today's spending"
      value={formatCurrency(todayMinor, currencyCode)}
      icon={TrendingUp}
      detail={`7-day avg ${formatCurrency(averageMinor, currencyCode)}/day`}
    />
  </Link>
}
