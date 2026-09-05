import { useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { InvestmentActionError, InvestmentActionField } from "@/features/investments/actions/investment-action-field"
import { useSaveHolding } from "@/features/investments/investments-hooks"
import { getErrorMessage } from "@/lib/errors"

type HoldingDialogProps = {
  accountId: string
  onOpenChange: (open: boolean) => void
  open: boolean
}

const assetTypes = ["stock", "etf", "fund", "other"] as const

export function HoldingDialog({ accountId, open, onOpenChange }: HoldingDialogProps) {
  const mutation = useSaveHolding()
  const [symbol, setSymbol] = useState("")
  const [name, setName] = useState("")
  const [type, setType] = useState<string | null>("etf")
  const [error, setError] = useState<string | null>(null)

  const submit = () => {
    if (!symbol.trim() || !name.trim()) {
      setError("Symbol and name are required.")
      return
    }
    mutation.mutate(
      { accountId, symbol, name, assetType: type ?? "etf" },
      {
        onSuccess: () => {
          toast.success("Holding added. Record a buy before it has a quantity.")
          onOpenChange(false)
        },
        onError: (cause) => setError(getErrorMessage(cause, "The holding could not be added.")),
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add holding</DialogTitle>
          <DialogDescription>Add metadata first, then record a Buy to establish quantity and cost.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <InvestmentActionField label="Symbol" htmlFor="holding-symbol">
            <Input id="holding-symbol" value={symbol} onChange={(event) => setSymbol(event.target.value)} placeholder="CSPX" />
          </InvestmentActionField>
          <InvestmentActionField label="Name" htmlFor="holding-name">
            <Input id="holding-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="iShares Core S&P 500" />
          </InvestmentActionField>
          <InvestmentActionField label="Asset type">
            <Select
              value={type}
              onValueChange={setType}
              items={assetTypes.map((value) => ({ value, label: formatAssetType(value) }))}
            >
              <SelectTrigger aria-label="Asset type" className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {assetTypes.map((value) => <SelectItem key={value} value={value}>{formatAssetType(value)}</SelectItem>)}
              </SelectContent>
            </Select>
          </InvestmentActionField>
          <InvestmentActionError message={error} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={mutation.isPending}>Add holding</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function formatAssetType(value: typeof assetTypes[number]) {
  return value === "etf" ? "ETF" : `${value[0].toUpperCase()}${value.slice(1)}`
}
