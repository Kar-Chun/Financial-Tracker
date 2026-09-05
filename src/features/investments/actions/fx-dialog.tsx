import { LoaderCircle } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { InvestmentActionError, InvestmentActionField } from "@/features/investments/actions/investment-action-field"
import { normalizeInvestmentDecimal } from "@/features/investments/investment-logic"
import { useSaveManualFx } from "@/features/investments/investments-hooks"
import { getErrorMessage } from "@/lib/errors"

type FxDialogProps = {
  baseCurrency: string
  fromCurrency: string
  onOpenChange: (open: boolean) => void
  open: boolean
  today: string
}

export function FxDialog({ fromCurrency, baseCurrency, today, open, onOpenChange }: FxDialogProps) {
  const mutation = useSaveManualFx()
  const [rate, setRate] = useState("")
  const [date, setDate] = useState(today)
  const [error, setError] = useState<string | null>(null)

  const submit = () => {
    const normalizedRate = normalizeInvestmentDecimal(rate, { maximumDecimals: 12 })
    if (!normalizedRate) {
      setError("Enter a positive direct FX rate within the database-supported precision.")
      return
    }
    mutation.mutate(
      { fromCurrency, rate: normalizedRate, rateDate: date },
      {
        onSuccess: () => {
          toast.success("Manual FX rate updated.")
          onOpenChange(false)
        },
        onError: (cause) => setError(getErrorMessage(cause, "The FX rate could not be saved.")),
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Update {fromCurrency} → {baseCurrency}</DialogTitle>
          <DialogDescription>Enter how many {baseCurrency} one {fromCurrency} is worth. This rate is only for valuation, never transfer conversion.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <InvestmentActionField label={`1 ${fromCurrency} = ${baseCurrency}`} htmlFor="manual-fx-rate">
            <Input id="manual-fx-rate" inputMode="decimal" value={rate} onChange={(event) => setRate(event.target.value)} />
          </InvestmentActionField>
          <InvestmentActionField label="Rate date" htmlFor="manual-fx-date">
            <Input id="manual-fx-date" data-mobile-date className="w-full min-w-0" type="date" max={today} value={date} onChange={(event) => setDate(event.target.value)} />
          </InvestmentActionField>
          <InvestmentActionError message={error} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={mutation.isPending}>
            {mutation.isPending && <LoaderCircle className="animate-spin" />}Save rate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
