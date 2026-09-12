import type { LucideIcon } from "lucide-react"

import { MetricTile } from "@/components/shared/finance-ui"
import { formatCurrency, formatSignedCurrency } from "@/lib/currency"

type MetricCardProps = {
  label: string
  amountMinor: number
  currencyCode: string
  helper: string
  icon: LucideIcon
  className?: string
  showSign?: boolean
}

export function MetricCard({ label, amountMinor, currencyCode, helper, icon, className, showSign = false }: MetricCardProps) {
  const value = showSign ? formatSignedCurrency(amountMinor, currencyCode) : formatCurrency(amountMinor, currencyCode)
  return <MetricTile label={label} value={value} detail={helper} icon={icon} className={className} />
}
