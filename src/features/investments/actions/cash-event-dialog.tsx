import { useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { InvestmentActionError, InvestmentActionField } from "@/features/investments/actions/investment-action-field"
import { useRecordCashEvent } from "@/features/investments/investments-hooks"
import type { DetailedHolding } from "@/features/investments/investment-types"
import { parseCurrencyToMinor } from "@/lib/currency"
import { getErrorMessage } from "@/lib/errors"

type CashEventDialogProps = {
  accountId: string
  currencyCode: string
  holdings: DetailedHolding[]
  onOpenChange: (open: boolean) => void
  open: boolean
  today: string
  type: "dividend" | "cash_adjustment"
}

export function CashEventDialog({ accountId, currencyCode, today, holdings, type, open, onOpenChange }: CashEventDialogProps) {
  const mutation = useRecordCashEvent()
  const [holdingId, setHoldingId] = useState<string | null>(holdings[0]?.id ?? null)
  const [amount, setAmount] = useState("")
  const [date, setDate] = useState(today)
  const [note, setNote] = useState("")
  const [error, setError] = useState<string | null>(null)

  const submit = () => {
    try {
      const amountMinor = parseCurrencyToMinor(amount, currencyCode, { allowNegative: type === "cash_adjustment" })
      if ((type === "dividend" && amountMinor <= 0) || amountMinor === 0) throw new Error("Enter a valid non-zero amount.")
      if (!note.trim()) throw new Error("A short note or reason is required.")
      mutation.mutate(
        {
          accountId,
          holdingId: type === "dividend" ? holdingId : null,
          eventType: type,
          amountMinor,
          eventDate: date,
          note,
        },
        {
          onSuccess: () => {
            toast.success(type === "dividend" ? "Dividend recorded." : "Broker cash adjusted.")
            onOpenChange(false)
          },
          onError: (cause) => setError(getErrorMessage(cause, "The cash event could not be saved.")),
        },
      )
    } catch (cause) {
      setError(getErrorMessage(cause, "Check the amount."))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{type === "dividend" ? "Record dividend" : "Adjust broker cash"}</DialogTitle>
          <DialogDescription>
            {type === "dividend"
              ? "Dividends increase broker cash but do not enter ordinary income analytics."
              : "Use only for reconciliation, not as a substitute for an account transfer."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {type === "dividend" && (
            <InvestmentActionField label="Holding">
              <Select
                value={holdingId}
                onValueChange={setHoldingId}
                items={holdings.map((item) => ({ value: item.id, label: `${item.symbol} · ${item.name}` }))}
              >
                <SelectTrigger aria-label="Holding" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {holdings.map((item) => <SelectItem key={item.id} value={item.id}>{item.symbol} · {item.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </InvestmentActionField>
          )}
          <InvestmentActionField label={`Amount (${currencyCode})`} htmlFor={`${type}-amount`}>
            <Input
              id={`${type}-amount`}
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder={type === "cash_adjustment" ? "Use - for a reduction" : "0.00"}
            />
          </InvestmentActionField>
          <InvestmentActionField label="Date" htmlFor={`${type}-date`}>
            <Input id={`${type}-date`} data-mobile-date className="w-full min-w-0" type="date" max={today} value={date} onChange={(event) => setDate(event.target.value)} />
          </InvestmentActionField>
          <InvestmentActionField label={type === "dividend" ? "Note / source" : "Reason"} htmlFor={`${type}-note`}>
            <Input id={`${type}-note`} value={note} onChange={(event) => setNote(event.target.value)} />
          </InvestmentActionField>
          <InvestmentActionError message={error} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={mutation.isPending}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
