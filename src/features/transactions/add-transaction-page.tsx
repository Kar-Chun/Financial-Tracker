import { ArrowLeft, ReceiptText } from "lucide-react"
import { useMemo } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useAccounts } from "@/features/accounts/accounts-hooks"
import { useAuth } from "@/features/auth/auth-context"
import { useProfile } from "@/features/auth/profile-service"
import {
  getQuickExpenseCategories,
  getRememberedExpenseAccountId,
  rememberExpenseAccount,
} from "@/features/transactions/quick-add-preferences"
import { TransactionForm } from "@/features/transactions/transaction-form"
import { useCategories, useFrequentExpenseCategories } from "@/features/transactions/transactions-hooks"
import { getDateInputInTimeZone } from "@/lib/dates"

type AddTransactionLocationState = {
  returnTo?: unknown
}

export function AddTransactionPage() {
  const { user } = useAuth()
  const accountsQuery = useAccounts()
  const categoriesQuery = useCategories()
  const frequentQuery = useFrequentExpenseCategories()
  const profileQuery = useProfile()
  const location = useLocation()
  const navigate = useNavigate()
  const accounts = useMemo(() => accountsQuery.data ?? [], [accountsQuery.data])
  const categories = useMemo(() => categoriesQuery.data ?? [], [categoriesQuery.data])
  const usableExpenseAccounts = accounts.filter((account) => account.account_type !== "investment")
  const rememberedAccountId = user
    ? getRememberedExpenseAccountId(user.id, usableExpenseAccounts)
    : null
  const initialAccountId = rememberedAccountId
    ?? (usableExpenseAccounts.length === 1 ? usableExpenseAccounts[0].id : null)
  const frequentCategories = useMemo(
    () => getQuickExpenseCategories(frequentQuery.data ?? [], categories),
    [categories, frequentQuery.data],
  )
  const timezone = profileQuery.data?.timezone ?? "Asia/Singapore"
  const returnTo = getReturnPath(location.state)
  const isLoading = accountsQuery.isLoading || categoriesQuery.isLoading || profileQuery.isLoading
  const hasError = accountsQuery.isError || categoriesQuery.isError || profileQuery.isError

  const leavePage = () => navigate(returnTo, { replace: true })

  return (
    <section className="mx-auto flex min-h-svh w-full max-w-2xl flex-col bg-background lg:min-h-[calc(100vh-4.5rem)] lg:rounded-3xl lg:bg-card/45 lg:ring-1 lg:ring-white/5">
      <header className="sticky top-0 z-20 grid min-h-18 grid-cols-[3rem_1fr_3rem] items-center border-b border-border/20 bg-background/95 pr-[max(1rem,env(safe-area-inset-right))] pl-[max(1rem,env(safe-area-inset-left))] pt-[env(safe-area-inset-top)] backdrop-blur-xl lg:static lg:bg-transparent lg:pt-0">
        <Button variant="ghost" size="icon" aria-label="Back to previous page" render={<Link to={returnTo} replace />}>
          <ArrowLeft className="size-5" />
        </Button>
        <div className="text-center">
          <p className="eyebrow">New</p>
          <h1 className="text-lg font-semibold tracking-tight">Add Transaction</h1>
        </div>
        <span aria-hidden="true" />
      </header>

      {isLoading ? (
        <div className="space-y-5 px-5 py-7 sm:px-8">
          <Skeleton className="h-12 rounded-xl" />
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-12 rounded-xl" />
          <Skeleton className="h-12 rounded-xl" />
          <Skeleton className="h-20 rounded-xl" />
        </div>
      ) : hasError ? (
        <PageMessage title="Add Transaction could not load" description="Check your connection and try again." />
      ) : accounts.length === 0 ? (
        <PageMessage
          title="Add an account first"
          description="At least one active account is required before recording a transaction."
          action={<Button render={<Link to="/accounts" />}>Go to accounts</Button>}
        />
      ) : (
        <TransactionForm
          entryPage
          accounts={accounts}
          categories={categories}
          initialAccountId={initialAccountId}
          initialDate={getDateInputInTimeZone(timezone)}
          frequentCategories={frequentCategories}
          sessionKey="new-transaction"
          onCancel={leavePage}
          onSaved={(input) => {
            if (user && input.transactionType === "expense") rememberExpenseAccount(user.id, input.accountId)
            leavePage()
          }}
        />
      )}
    </section>
  )
}

function getReturnPath(state: unknown) {
  const returnTo = (state as AddTransactionLocationState | null)?.returnTo
  if (typeof returnTo !== "string" || !returnTo.startsWith("/") || returnTo.startsWith("//") || returnTo.startsWith("/transactions/new")) {
    return "/transactions"
  }
  return returnTo
}

function PageMessage({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  return (
    <div className="grid flex-1 place-items-center px-6 py-16 text-center">
      <div className="max-w-sm">
        <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <ReceiptText className="size-6" />
        </span>
        <h2 className="mt-5 text-xl font-semibold">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
        {action && <div className="mt-6">{action}</div>}
      </div>
    </div>
  )
}
