import { useMemo, useState } from "react"
import { LoaderCircle } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useSaveCategoryBudget, useSaveMonthlyBudget } from "@/features/budgets/budget-hooks"
import { formatBudgetMonth } from "@/features/budgets/budget-dates"
import { isEligibleParentExpenseCategory } from "@/features/budgets/budget-logic"
import { getErrorMessage } from "@/lib/errors"
import { minorUnitsToInput, parseCurrencyToMinor } from "@/lib/currency"
import type { Category } from "@/types/finance"

type CommonProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  monthStart: string
  currencyCode: string
}

export function MonthlyBudgetDialog(props: CommonProps & { currentAmountMinor?: number | null }) {
  const mutation = useSaveMonthlyBudget()
  const [amount, setAmount] = useState(() => props.currentAmountMinor ? minorUnitsToInput(props.currentAmountMinor, props.currencyCode) : "")
  const [error, setError] = useState("")

  function submit(event: React.FormEvent) {
    event.preventDefault()
    try {
      const amountMinor = parseCurrencyToMinor(amount, props.currencyCode)
      if (amountMinor <= 0) throw new Error("Enter an amount greater than zero.")
      mutation.mutate({ monthStart: props.monthStart, amountMinor }, {
        onSuccess: () => { toast.success("Monthly budget saved."); props.onOpenChange(false) },
        onError: (cause) => toast.error(getErrorMessage(cause, "The monthly budget could not be saved.")),
      })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Enter a valid amount.")
    }
  }

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{props.currentAmountMinor ? "Edit" : "Set"} monthly budget</DialogTitle>
          <DialogDescription>{formatBudgetMonth(props.monthStart)} · {props.currencyCode}. Budgets do not roll over.</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={submit}>
          <div className="space-y-2">
            <Label htmlFor="monthly-budget-amount">Monthly budget</Label>
            <div className="relative"><span className="absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">{props.currencyCode}</span><Input id="monthly-budget-amount" className="pl-14" inputMode="decimal" autoComplete="off" value={amount} onChange={(event) => setAmount(event.target.value)} /></div>
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => props.onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending}>{mutation.isPending && <LoaderCircle className="animate-spin" />}Save budget</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function CategoryBudgetDialog(props: CommonProps & {
  categories: Category[]
  currentUserId: string
  usedCategoryIds: string[]
  editing?: { categoryId: string; categoryName: string; amountMinor: number } | null
}) {
  const mutation = useSaveCategoryBudget()
  const [categoryId, setCategoryId] = useState(props.editing?.categoryId ?? "")
  const [amount, setAmount] = useState(() => props.editing ? minorUnitsToInput(props.editing.amountMinor, props.currencyCode) : "")
  const [error, setError] = useState("")
  const available = useMemo(() => props.categories.filter((category) => (
    isEligibleParentExpenseCategory(category, props.currentUserId)
    && (!props.usedCategoryIds.includes(category.id) || category.id === props.editing?.categoryId)
  )), [props.categories, props.currentUserId, props.editing?.categoryId, props.usedCategoryIds])
  const items = available.map((category) => ({ value: category.id, label: category.name }))

  function submit(event: React.FormEvent) {
    event.preventDefault()
    try {
      if (!categoryId) throw new Error("Choose a parent expense category.")
      const amountMinor = parseCurrencyToMinor(amount, props.currencyCode)
      if (amountMinor <= 0) throw new Error("Enter an amount greater than zero.")
      mutation.mutate({ monthStart: props.monthStart, categoryId, amountMinor }, {
        onSuccess: () => { toast.success("Category budget saved."); props.onOpenChange(false) },
        onError: (cause) => toast.error(getErrorMessage(cause, "The category budget could not be saved.")),
      })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Check the category budget.")
    }
  }

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{props.editing ? "Edit" : "Add"} category budget</DialogTitle>
          <DialogDescription>Parent expense categories include spending from their direct subcategories.</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={submit}>
          <div className="space-y-2">
            <Label>Category</Label>
            {props.editing ? <div className="flex min-h-11 items-center rounded-xl bg-surface px-3 text-sm ring-1 ring-border/35">{props.editing.categoryName}</div> : (
              <Select items={items} value={categoryId || null} onValueChange={(value) => setCategoryId(value ?? "")}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Select parent category" /></SelectTrigger>
                <SelectContent>{available.map((category) => <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>)}</SelectContent>
              </Select>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="category-budget-amount">Limit</Label>
            <div className="relative"><span className="absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">{props.currencyCode}</span><Input id="category-budget-amount" className="pl-14" inputMode="decimal" autoComplete="off" value={amount} onChange={(event) => setAmount(event.target.value)} /></div>
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => props.onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending}>{mutation.isPending && <LoaderCircle className="animate-spin" />}Save limit</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
