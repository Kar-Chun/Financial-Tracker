import type { LucideIcon } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { formatCurrency } from "@/lib/currency"

type MetricCardProps = {
  label: string
  amountMinor: number
  currencyCode: string
  helper: string
  icon: LucideIcon
}

export function MetricCard({ label, amountMinor, currencyCode, helper, icon: Icon }: MetricCardProps) {
  return (
    <Card className="py-0 shadow-xs">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Icon className="size-4.5" />
          </span>
        </div>
        <p className="mt-4 text-2xl font-semibold tracking-tight">
          {formatCurrency(amountMinor, currencyCode)}
        </p>
        <p className="mt-2 text-xs text-muted-foreground">{helper}</p>
      </CardContent>
    </Card>
  )
}
