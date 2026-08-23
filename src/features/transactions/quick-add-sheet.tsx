import { useMemo } from "react"

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { useAccounts } from "@/features/accounts/accounts-hooks"
import { useProfile } from "@/features/auth/profile-service"
import { useAuth } from "@/features/auth/auth-context"
import {
  getQuickExpenseCategories,
  getRememberedExpenseAccountId,
  rememberExpenseAccount,
} from "@/features/transactions/quick-add-preferences"
import { TransactionForm } from "@/features/transactions/transaction-form"
import {
  useCategories,
  useFrequentExpenseCategories,
} from "@/features/transactions/transactions-hooks"
import { getDateInputInTimeZone } from "@/lib/dates"

type QuickAddSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function QuickAddSheet({ open, onOpenChange }: QuickAddSheetProps) {
  const { user } = useAuth()
  const accountsQuery = useAccounts()
  const categoriesQuery = useCategories()
  const frequentQuery = useFrequentExpenseCategories()
  const profileQuery = useProfile()
  const accounts = useMemo(() => accountsQuery.data ?? [], [accountsQuery.data])
  const categories = useMemo(() => categoriesQuery.data ?? [], [categoriesQuery.data])
  const usableExpenseAccounts = accounts.filter((account) => account.account_type !== "investment")
  const rememberedAccountId = user
    ? getRememberedExpenseAccountId(user.id, usableExpenseAccounts)
    : null
  const initialAccountId = rememberedAccountId
    ?? (usableExpenseAccounts.length === 1 ? usableExpenseAccounts[0].id : null)
  const quickCategories = useMemo(
    () => getQuickExpenseCategories(frequentQuery.data ?? [], categories),
    [categories, frequentQuery.data],
  )
  const timezone = profileQuery.data?.timezone ?? "Asia/Singapore"
  const isLoading = accountsQuery.isLoading || categoriesQuery.isLoading || profileQuery.isLoading
  const hasError = accountsQuery.isError || categoriesQuery.isError || profileQuery.isError

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[min(92svh,52rem)] overflow-hidden rounded-t-[2rem] border-x border-border/40 bg-popover shadow-2xl shadow-black/35 sm:left-1/2 sm:max-w-xl sm:-translate-x-1/2"
      >
        <SheetHeader className="border-b border-border/25 px-5 pt-5 pb-4 text-left">
          <p className="eyebrow">New transaction</p>
          <SheetTitle className="text-2xl font-semibold tracking-tight">Quick Add</SheetTitle>
          <SheetDescription>Expense is ready by default. Your transaction is added only after it is securely saved.</SheetDescription>
        </SheetHeader>
        {isLoading ? (
          <div className="grid min-h-72 place-items-center text-sm text-muted-foreground">Preparing your accounts and categories…</div>
        ) : hasError ? (
          <div className="grid min-h-72 place-items-center px-6 text-center text-sm text-muted-foreground">Quick Add could not load your account data. Check your connection and try again.</div>
        ) : usableExpenseAccounts.length === 0 ? (
          <div className="grid min-h-72 place-items-center px-6 text-center text-sm text-muted-foreground">Add an active bank or cash account before recording an expense.</div>
        ) : (
          <TransactionForm
            quickAdd
            accounts={accounts}
            categories={categories}
            initialAccountId={initialAccountId}
            initialDate={getDateInputInTimeZone(timezone)}
            frequentCategories={quickCategories}
            sessionKey={open}
            onCancel={() => onOpenChange(false)}
            onSaved={(input) => {
              if (user && input.transactionType === "expense") rememberExpenseAccount(user.id, input.accountId)
              onOpenChange(false)
            }}
          />
        )}
      </SheetContent>
    </Sheet>
  )
}
