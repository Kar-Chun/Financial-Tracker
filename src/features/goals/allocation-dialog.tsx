import { useState } from "react"
import { LoaderCircle } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useRecordGoalAllocation } from "@/features/goals/goals-hooks"
import { parseCurrencyToMinor } from "@/lib/currency"
import { getErrorMessage } from "@/lib/errors"

export function AllocationDialog({ open, onOpenChange, goalId, goalName, currencyCode, operation, initialDate }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  goalId: string
  goalName: string
  currencyCode: string
  operation: "allocate" | "reduce"
  initialDate: string
}) {
  const mutation = useRecordGoalAllocation()
  const [amount, setAmount] = useState("")
  const [date, setDate] = useState(initialDate)
  const [note, setNote] = useState("")
  const [error, setError] = useState("")
  const reducing = operation === "reduce"

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    try {
      const amountMinor = parseCurrencyToMinor(amount, currencyCode)
      if (amountMinor <= 0) throw new Error("Amount must be greater than zero.")
      mutation.mutate({ goalId, operation, amountMinor, allocationDate: date, note }, {
        onSuccess: () => { toast.success(reducing ? "Allocation reduced." : "Savings allocated."); onOpenChange(false) },
        onError: (cause) => toast.error(getErrorMessage(cause, reducing ? "The allocation could not be reduced." : "The savings could not be allocated.")),
      })
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Enter a valid amount.") }
  }

  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent><DialogHeader><DialogTitle>{reducing ? "Reduce allocation" : `Allocate to ${goalName}`}</DialogTitle><DialogDescription>{reducing ? "This releases part of the virtual allocation. No account money is moved." : "This reserves money in your plan without moving it from an account."}</DialogDescription></DialogHeader><form className="space-y-4" onSubmit={submit}>
    <div className="space-y-2"><Label htmlFor="allocation-amount">Amount ({currencyCode})</Label><Input id="allocation-amount" className="h-12 text-base md:text-sm" inputMode="decimal" autoComplete="off" value={amount} onChange={(event) => setAmount(event.target.value)} />{error && <p className="text-xs text-destructive">{error}</p>}</div>
    <div className="space-y-2"><Label htmlFor="allocation-date">Date</Label><Input id="allocation-date" data-mobile-date className="block h-12 w-full min-w-0 max-w-full text-base md:text-sm" type="date" value={date} onChange={(event) => setDate(event.target.value)} /></div>
    <div className="space-y-2"><Label htmlFor="allocation-note">{reducing ? "Reason / Note (optional)" : "Note (optional)"}</Label><Textarea id="allocation-note" className="min-h-20 resize-none text-base md:text-sm" value={note} onChange={(event) => setNote(event.target.value)} /></div>
    <DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit" disabled={mutation.isPending}>{mutation.isPending && <LoaderCircle className="animate-spin" />}{reducing ? "Reduce allocation" : "Allocate"}</Button></DialogFooter>
  </form></DialogContent></Dialog>
}
