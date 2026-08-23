import type { LucideIcon } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { formatCurrency, formatSignedCurrency } from "@/lib/currency"
import { cn } from "@/lib/utils"

type MetricCardProps = {
  label: string
  amountMinor: number
  currencyCode: string
  helper: string
  icon: LucideIcon
  className?: string
  tone?: "positive" | "negative" | "neutral"
  showSign?: boolean
}

export function MetricCard({ label, amountMinor, currencyCode, helper, icon: Icon, className, tone = "neutral", showSign = false }: MetricCardProps) {
  const value = showSign ? formatSignedCurrency(amountMinor, currencyCode) : formatCurrency(amountMinor, currencyCode)
  return (
    <Card className={cn("border-0 bg-card/80 py-0 shadow-none ring-1 ring-white/4", className)}>
      <CardContent className="min-w-0 p-4 sm:p-5">
        <div className="flex items-start justify-between gap-2">
          <p className="eyebrow leading-5">{label}</p>
          <span className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-full",
            tone === "positive" ? "bg-positive/10 text-positive" : tone === "negative" ? "bg-negative/10 text-negative" : "bg-primary/10 text-primary",
          )}>
            <Icon className="size-4" aria-hidden="true" />
          </span>
        </div>
        <p className={cn(
          "mt-3 whitespace-nowrap text-[clamp(1rem,5vw,1.5rem)] font-semibold tracking-tight tabular-nums",
          showSign && amountMinor > 0 && "text-positive",
          showSign && amountMinor < 0 && "text-negative",
        )}>
          {value}
        </p>
        <p className="mt-1.5 text-xs leading-5 text-muted-foreground">{helper}</p>
      </CardContent>
    </Card>
  )
}
