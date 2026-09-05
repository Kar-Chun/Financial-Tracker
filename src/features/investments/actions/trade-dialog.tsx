import { LoaderCircle } from "lucide-react"
import { useMemo, useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { InvestmentActionError, InvestmentActionField } from "@/features/investments/actions/investment-action-field"
import { calculateTradeCashMinor, normalizeInvestmentDecimal } from "@/features/investments/investment-logic"
import { useRecordTrade } from "@/features/investments/investments-hooks"
import type { DetailedHolding } from "@/features/investments/investment-types"
import { formatCurrency, getMinorUnitDigits, parseCurrencyToMinor } from "@/lib/currency"
import { getErrorMessage } from "@/lib/errors"

type TradeDialogProps = {
  accountId: string
  currencyCode: string
  holdings: DetailedHolding[]
  onOpenChange: (open: boolean) => void
  open: boolean
  today: string
  type: "buy" | "sell"
}

export function TradeDialog({ accountId, currencyCode, today, holdings, type, open, onOpenChange }: TradeDialogProps) {
  const mutation = useRecordTrade()
  const available = holdings.filter((holding) => !holding.archived_at && (type === "buy" || holding.quantity > 0))
  const [holdingId, setHoldingId] = useState<string | null>(available[0]?.id ?? null)
  const [quantity, setQuantity] = useState("")
  const [price, setPrice] = useState("")
  const [fee, setFee] = useState("0.00")
  const [date, setDate] = useState(today)
  const [note, setNote] = useState("")
  const [error, setError] = useState<string | null>(null)
  const selected = available.find((holding) => holding.id === holdingId)
  const total = useMemo(() => {
    try {
      return calculateTradeCashMinor(
        type,
        quantity,
        price,
        BigInt(parseCurrencyToMinor(fee || "0", currencyCode)),
        10 ** getMinorUnitDigits(currencyCode),
      )
    } catch {
      return null
    }
  }, [currencyCode, fee, price, quantity, type])

  const submit = () => {
    try {
      if (!holdingId) throw new Error("Choose a holding.")
      const normalizedQuantity = normalizeInvestmentDecimal(quantity)
      const normalizedPrice = normalizeInvestmentDecimal(price)
      if (!normalizedQuantity || !normalizedPrice) {
        throw new Error("Enter a positive quantity and price within the database-supported precision.")
      }
      const feeMinor = parseCurrencyToMinor(fee || "0", currencyCode)
      if (total === null || total > BigInt(Number.MAX_SAFE_INTEGER) || total < BigInt(Number.MIN_SAFE_INTEGER)) {
        throw new Error("Trade total is invalid or too large.")
      }
      mutation.mutate(
        {
          accountId,
          holdingId,
          tradeType: type,
          quantity: normalizedQuantity,
          unitPrice: normalizedPrice,
          feeMinor,
          tradeDate: date,
          note,
        },
        {
          onSuccess: () => {
            toast.success(`${type === "buy" ? "Buy" : "Sell"} recorded.`)
            onOpenChange(false)
          },
          onError: (cause) => setError(getErrorMessage(cause, "The trade could not be recorded.")),
        },
      )
    } catch (cause) {
      setError(getErrorMessage(cause, "Check the trade details."))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{type === "buy" ? "Buy investment" : "Sell investment"}</DialogTitle>
          <DialogDescription>Trades update broker cash and weighted-average cost. They are not ordinary expenses or income.</DialogDescription>
        </DialogHeader>
        <div className="max-h-[65svh] space-y-4 overflow-y-auto pr-1">
          <InvestmentActionField label="Holding">
            <Select
              value={holdingId}
              onValueChange={setHoldingId}
              items={available.map((item) => ({ value: item.id, label: `${item.symbol} · ${item.name}` }))}
            >
              <SelectTrigger aria-label="Holding" className="w-full"><SelectValue placeholder="Select holding" /></SelectTrigger>
              <SelectContent>
                {available.map((item) => <SelectItem key={item.id} value={item.id}>{item.symbol} · {item.name}</SelectItem>)}
              </SelectContent>
            </Select>
            {type === "sell" && selected && <p className="text-xs text-muted-foreground">Available: {formatQuantity(selected.quantity)} shares</p>}
          </InvestmentActionField>
          <InvestmentActionField label="Quantity" htmlFor={`${type}-quantity`}>
            <Input id={`${type}-quantity`} inputMode="decimal" value={quantity} onChange={(event) => setQuantity(event.target.value)} />
          </InvestmentActionField>
          <InvestmentActionField label={`Price per unit (${currencyCode})`} htmlFor={`${type}-price`}>
            <Input id={`${type}-price`} inputMode="decimal" value={price} onChange={(event) => setPrice(event.target.value)} />
          </InvestmentActionField>
          <InvestmentActionField label={`Fee (${currencyCode}, optional)`} htmlFor={`${type}-fee`}>
            <Input id={`${type}-fee`} inputMode="decimal" value={fee} onChange={(event) => setFee(event.target.value)} />
          </InvestmentActionField>
          <InvestmentActionField label="Date" htmlFor={`${type}-date`}>
            <Input id={`${type}-date`} data-mobile-date className="w-full min-w-0" type="date" max={today} value={date} onChange={(event) => setDate(event.target.value)} />
          </InvestmentActionField>
          <InvestmentActionField label="Note (optional)" htmlFor={`${type}-note`}>
            <Textarea id={`${type}-note`} value={note} onChange={(event) => setNote(event.target.value)} />
          </InvestmentActionField>
          {total !== null && total <= BigInt(Number.MAX_SAFE_INTEGER) && total >= BigInt(Number.MIN_SAFE_INTEGER) && (
            <div className="rounded-xl bg-secondary/60 p-3 text-sm">
              <p className="text-muted-foreground">{type === "buy" ? "Total cash required" : "Net sale proceeds"}</p>
              <p className="mt-1 font-semibold tabular-nums">{formatCurrency(Number(type === "buy" ? -total : total), currencyCode)}</p>
            </div>
          )}
          <InvestmentActionError message={error} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={mutation.isPending}>
            {mutation.isPending && <LoaderCircle className="animate-spin" />}Record {type}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function formatQuantity(value: number) {
  return new Intl.NumberFormat("en-SG", { maximumFractionDigits: 10 }).format(value)
}
