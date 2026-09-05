import { LoaderCircle } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { InvestmentActionError, InvestmentActionField } from "@/features/investments/actions/investment-action-field"
import { normalizeInvestmentDecimal } from "@/features/investments/investment-logic"
import { useUpdatePrices } from "@/features/investments/investments-hooks"
import type { DetailedHolding } from "@/features/investments/investment-types"
import { getErrorMessage } from "@/lib/errors"

type PricesDialogProps = {
  accountId: string
  currencyCode: string
  holdings: DetailedHolding[]
  onOpenChange: (open: boolean) => void
  open: boolean
  today: string
}

export function PricesDialog({ accountId, currencyCode, today, holdings, open, onOpenChange }: PricesDialogProps) {
  const mutation = useUpdatePrices()
  const activeHoldings = holdings.filter((item) => !item.archived_at)
  const [date, setDate] = useState(today)
  const [prices, setPrices] = useState<Record<string, string>>(() => (
    Object.fromEntries(activeHoldings.map((item) => [item.id, item.latest_price?.toString() ?? ""]))
  ))
  const [error, setError] = useState<string | null>(null)

  const submit = () => {
    const updates = activeHoldings.map((item) => ({
      holding_id: item.id,
      price: normalizeInvestmentDecimal(prices[item.id] ?? ""),
    }))
    if (updates.some((item) => item.price === null)) {
      setError("Enter a positive current price for every active holding within the database-supported precision.")
      return
    }
    mutation.mutate(
      { accountId, pricedAt: date, prices: updates.filter(isValidPriceUpdate) },
      {
        onSuccess: () => {
          toast.success("Holding prices updated.")
          onOpenChange(false)
        },
        onError: (cause) => setError(getErrorMessage(cause, "Prices could not be updated.")),
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Update prices</DialogTitle>
          <DialogDescription>Manual prices are stored historically. No market-data API is used.</DialogDescription>
        </DialogHeader>
        <div className="max-h-[65svh] space-y-4 overflow-y-auto pr-1">
          <InvestmentActionField label="Price date" htmlFor="price-date">
            <Input id="price-date" data-mobile-date className="w-full min-w-0" type="date" max={today} value={date} onChange={(event) => setDate(event.target.value)} />
          </InvestmentActionField>
          {activeHoldings.map((holding) => (
            <InvestmentActionField key={holding.id} label={`${holding.symbol} · ${holding.name} (${currencyCode})`} htmlFor={`price-${holding.id}`}>
              <Input id={`price-${holding.id}`} inputMode="decimal" value={prices[holding.id] ?? ""} onChange={(event) => setPrices((items) => ({ ...items, [holding.id]: event.target.value }))} />
            </InvestmentActionField>
          ))}
          <InvestmentActionError message={error} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={mutation.isPending}>
            {mutation.isPending && <LoaderCircle className="animate-spin" />}Save prices
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function isValidPriceUpdate(value: { holding_id: string; price: string | null }): value is { holding_id: string; price: string } {
  return value.price !== null
}
