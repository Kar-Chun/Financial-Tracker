import { useRef, useState } from "react"
import { LoaderCircle, Scale } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAccounts, useReconcileAccount } from "@/features/accounts/accounts-hooks"
import { useOnlineStatus } from "@/hooks/use-online-status"
import { formatCurrency, formatSignedCurrency, parseCurrencyToMinor } from "@/lib/currency"
import { getErrorMessage } from "@/lib/errors"
import { offlineFinancialMutationMessage } from "@/lib/network"
import type { AccountSummaryRow } from "@/types/finance"

export function AccountDetailDialog({ account, onClose }: { account: AccountSummaryRow; onClose: () => void }) {
  const [reconciling, setReconciling] = useState(false)
  const [pending, setPending] = useState(false)
  const eligible = (account.account_type === "bank" || account.account_type === "cash") && account.current_balance_minor !== null
  return (
    <Dialog open onOpenChange={(open) => { if (!open && !pending) onClose() }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{reconciling ? "Reconcile balance" : account.name}</DialogTitle>
          <DialogDescription>{reconciling && `${account.name} · `}{account.account_type === "bank" ? "Bank" : account.account_type === "cash" ? "Cash" : "Investment"} · {account.currency_code}</DialogDescription>
        </DialogHeader>
        {reconciling && eligible ? (
          <ReconciliationForm account={account} onClose={onClose} onPendingChange={setPending} />
        ) : (
          <div className="space-y-5">
            <div>
              <p className="eyebrow">Ledgerly balance</p>
              <p className="mt-2 break-words text-2xl font-semibold tabular-nums">{account.current_balance_minor === null ? "Unavailable" : formatCurrency(account.current_balance_minor, account.currency_code)}</p>
            </div>
            {!account.included_in_net_worth && <p className="text-sm text-muted-foreground">This native-currency balance is excluded from base-currency Net Worth.</p>}
            {eligible && <Button variant="outline" onClick={() => setReconciling(true)}><Scale /> Reconcile balance</Button>}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function ReconciliationForm({ account, onClose, onPendingChange }: {
  account: AccountSummaryRow
  onClose: () => void
  onPendingChange: (pending: boolean) => void
}) {
  const mutation = useReconcileAccount()
  const accountsQuery = useAccounts()
  const online = useOnlineStatus()
  // Freeze what was reviewed. A background refetch must not silently change
  // the expected balance submitted with this confirmation.
  const [reviewed, setReviewed] = useState({ balance: account.current_balance_minor!, currency: account.currency_code })
  const [actual, setActual] = useState("")
  const [note, setNote] = useState("")
  const [error, setError] = useState("")
  const [needsRefresh, setNeedsRefresh] = useState(false)
  const inFlight = useRef(false)
  let actualMinor: number | null = null
  let difference: number | null = null
  let amountError = ""
  if (actual.trim()) {
    try {
      actualMinor = parseCurrencyToMinor(actual, reviewed.currency, { allowNegative: true })
      const exactDifference = BigInt(actualMinor) - BigInt(reviewed.balance)
      if (exactDifference > BigInt(Number.MAX_SAFE_INTEGER) || exactDifference < BigInt(Number.MIN_SAFE_INTEGER)) {
        throw new Error("The balance difference is too large to process safely.")
      }
      difference = Number(exactDifference)
    } catch (failure) {
      amountError = failure instanceof Error ? failure.message : "Enter a valid balance."
    }
  }

  const refreshReviewedBalance = async () => {
    const refreshed = await accountsQuery.refetch()
    const latest = refreshed.data?.find((item) => item.id === account.id)
    if (refreshed.isError || !latest || latest.current_balance_minor === null || !["bank", "cash"].includes(latest.account_type)) {
      setNeedsRefresh(true)
      return
    }
    setReviewed({ balance: latest.current_balance_minor, currency: latest.currency_code })
    setNeedsRefresh(false)
  }

  const submit = async (event: React.SubmitEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (inFlight.current || !online || needsRefresh || actualMinor === null || difference === null || difference === 0 || amountError || note.trim().length > 500) return
    inFlight.current = true
    onPendingChange(true)
    setError("")
    try {
      const result = await mutation.mutateAsync({
        accountId: account.id, actualBalanceMinor: actualMinor,
        expectedCurrentBalanceMinor: reviewed.balance, expectedCurrencyCode: reviewed.currency, note,
      })
      toast.success(result.adjustment_minor === 0 ? "Balances already match." : "Balance reconciled", {
        description: `${account.name} now matches ${formatCurrency(result.balance_minor, reviewed.currency)}. Adjustment: ${formatSignedCurrency(result.adjustment_minor, reviewed.currency)}.`,
      })
      onClose()
    } catch (failure) {
      setError(getErrorMessage(failure, "The balance could not be reconciled. Review the account before trying again."))
      // Network failures can have committed server-side too: always re-read
      // before another explicit attempt, never replay the mutation.
      setNeedsRefresh(true)
      await refreshReviewedBalance()
    } finally {
      inFlight.current = false
      onPendingChange(false)
    }
  }

  return (
    <form className="form-fields" onSubmit={submit}>
      <div><p className="eyebrow">Ledgerly balance</p><p className="mt-1 text-xl font-semibold tabular-nums">{formatCurrency(reviewed.balance, reviewed.currency)}</p></div>
      <div className="space-y-2">
        <Label htmlFor="reconciliation-actual">Actual balance ({reviewed.currency})</Label>
        <Input id="reconciliation-actual" inputMode="decimal" value={actual} disabled={mutation.isPending} onChange={(event) => setActual(event.target.value)} aria-describedby={amountError ? "reconciliation-amount-error" : undefined} aria-invalid={Boolean(amountError)} />
        {amountError && <p id="reconciliation-amount-error" className="text-sm text-destructive">{amountError}</p>}
      </div>
      <div className="rounded-xl bg-surface p-3" aria-live="polite">
        <p className="text-xs text-muted-foreground">Difference</p>
        <p className="mt-1 font-semibold tabular-nums">{difference === null ? "Enter the actual balance" : formatSignedCurrency(difference, reviewed.currency)}</p>
        {difference === 0 && <p className="mt-1 text-sm text-muted-foreground">Balances already match.</p>}
      </div>
      <p className="text-sm text-muted-foreground">This creates a read-only balance adjustment. It won't count as income or spending. To correct it later, reconcile again.</p>
      <div className="space-y-2">
        <Label htmlFor="reconciliation-note">Note (optional)</Label>
        <Input id="reconciliation-note" maxLength={500} value={note} disabled={mutation.isPending} onChange={(event) => setNote(event.target.value)} placeholder="e.g. Missing bank transactions" />
      </div>
      {!online && <p role="status" className="text-sm text-muted-foreground">{offlineFinancialMutationMessage}</p>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {needsRefresh && <Button type="button" variant="outline" disabled={!online || mutation.isPending} onClick={() => void refreshReviewedBalance()}>Refresh balance</Button>}
      <DialogFooter>
        <Button type="button" variant="outline" disabled={mutation.isPending} onClick={onClose}>Cancel</Button>
        <Button type="submit" disabled={!online || needsRefresh || mutation.isPending || difference === null || difference === 0 || Boolean(amountError)}>
          {mutation.isPending && <LoaderCircle className="animate-spin" />} Reconcile balance
        </Button>
      </DialogFooter>
    </form>
  )
}
