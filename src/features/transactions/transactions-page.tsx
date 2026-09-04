import { ArrowDownLeft, ArrowRightLeft, ArrowUpRight, Pencil, Plus, ReceiptText, Trash2 } from "lucide-react"
import { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { toast } from "sonner"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { useAccounts } from "@/features/accounts/accounts-hooks"
import { useAuth } from "@/features/auth/auth-context"
import { TransactionFormDialog } from "@/features/transactions/transaction-form-dialog"
import { useCategories, useSoftDeleteTransaction, useTransactions } from "@/features/transactions/transactions-hooks"
import { getCategoryDisplayName, getTransactionAmount, getTransactionDisplayDetails } from "@/features/transactions/transaction-logic"
import { flattenTransactionPages, getTransactionMonthRange, type TransactionPageFilters } from "@/features/transactions/transactions-service"
import { formatCurrency, formatSignedCurrency } from "@/lib/currency"
import { formatLongDate, getCurrentMonthInput } from "@/lib/dates"
import { getErrorMessage } from "@/lib/errors"
import { cn } from "@/lib/utils"
import type { TransactionRecord } from "@/types/finance"

export function TransactionsPage() {
  const { user } = useAuth()
  const accountsQuery = useAccounts()
  const categoriesQuery = useCategories()
  const deleteMutation = useSoftDeleteTransaction()
  const [editingTransaction, setEditingTransaction] = useState<TransactionRecord | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<TransactionRecord | null>(null)
  const [month, setMonth] = useState(getCurrentMonthInput())
  const [typeFilter, setTypeFilter] = useState("all")
  const [accountFilter, setAccountFilter] = useState("all")
  const [categoryFilter, setCategoryFilter] = useState("all")

  const filters = useMemo<TransactionPageFilters>(() => {
    const range = getTransactionMonthRange(month)
    return {
      ...range,
      transactionType: typeFilter === "all" ? null : typeFilter as TransactionPageFilters["transactionType"],
      accountId: accountFilter === "all" ? null : accountFilter,
      categoryId: categoryFilter === "all" ? null : categoryFilter,
    }
  }, [accountFilter, categoryFilter, month, typeFilter])
  const transactionsQuery = useTransactions(filters, user?.id)
  const transactions = useMemo(
    () => flattenTransactionPages(transactionsQuery.data?.pages ?? []),
    [transactionsQuery.data?.pages],
  )

  const openEdit = (transaction: TransactionRecord) => {
    setEditingTransaction(transaction)
  }
  const confirmDelete = () => {
    if (!deleteTarget) return
    deleteMutation.mutate(deleteTarget.id, {
      onSuccess: () => {
        toast.success("Transaction removed from active history.")
        setDeleteTarget(null)
      },
      onError: (error) => toast.error(getErrorMessage(error, "The transaction could not be deleted.")),
    })
  }

  const isLoading = transactionsQuery.isLoading || accountsQuery.isLoading || categoriesQuery.isLoading
  const hasError = transactionsQuery.isError || accountsQuery.isError || categoriesQuery.isError
  const accountFilterItems = [
    { value: "all", label: "All accounts" },
    ...(accountsQuery.data ?? []).map((account) => ({ value: account.id, label: account.name })),
  ]
  const categoryFilterItems = [
    { value: "all", label: "All categories" },
    ...(categoriesQuery.data ?? []).map((category) => ({
      value: category.id,
      label: `${getCategoryDisplayName(category, categoriesQuery.data ?? [])}${category.archived_at ? " (Archived)" : ""}`,
    })),
  ]

  return (
    <div className="space-y-7">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">Daily activity</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Transactions</h1>
          <p className="mt-2 text-sm text-muted-foreground">Record income, expenses, and same-currency transfers.</p>
        </div>
        {(accountsQuery.data?.length ?? 0) > 0 ? (
          <Button className="hidden lg:inline-flex" render={<Link to="/transactions/new" state={{ returnTo: "/transactions" }} />}>
            <Plus /> Add transaction
          </Button>
        ) : (
          <Button className="hidden lg:inline-flex" disabled><Plus /> Add transaction</Button>
        )}
      </header>

      <Card className="border-0 bg-card/55 py-0 shadow-none ring-1 ring-white/4">
        <CardContent className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4">
          <Input type="month" value={month} onChange={(event) => setMonth(event.target.value)} aria-label="Filter month" />
          <FilterSelect value={typeFilter} onValueChange={setTypeFilter} placeholder="All types" items={[
            { value: "all", label: "All types" },
            { value: "expense", label: "Expense" },
            { value: "income", label: "Income" },
            { value: "transfer", label: "Transfer" },
          ]} />
          <FilterSelect value={accountFilter} onValueChange={setAccountFilter} placeholder="All accounts" items={accountFilterItems} />
          <FilterSelect value={categoryFilter} onValueChange={setCategoryFilter} placeholder="All categories" items={categoryFilterItems} />
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="space-y-3">{[0, 1, 2, 3].map((item) => <Skeleton key={item} className="h-20 rounded-2xl" />)}</div>
      ) : hasError ? (
        <Card className="border-destructive/30"><CardContent className="py-10 text-center">Transactions could not be loaded.</CardContent></Card>
      ) : (accountsQuery.data?.length ?? 0) === 0 ? (
        <EmptyState title="Add an account first" description="Transactions need an active bank or cash account." actionLabel="Go to accounts" actionHref="/accounts" />
      ) : transactions.length === 0 ? (
        <EmptyState title="No transactions found" description="Add your first transaction or adjust the filters above." actionHref="/transactions/new" actionLabel="Add transaction" />
      ) : (
        <>
          <div className="overflow-hidden rounded-2xl bg-card/70 ring-1 ring-white/4">
            {transactions.map((transaction, index) => (
              <TransactionRow
                key={transaction.id}
                transaction={transaction}
                bordered={index > 0}
                onEdit={() => openEdit(transaction)}
                onDelete={() => setDeleteTarget(transaction)}
              />
            ))}
          </div>
          {transactionsQuery.hasNextPage && (
            <div className="flex justify-center">
              <Button
                variant="outline"
                disabled={transactionsQuery.isFetchingNextPage}
                onClick={() => void transactionsQuery.fetchNextPage()}
              >
                {transactionsQuery.isFetchingNextPage ? "Loading…" : "Load more"}
              </Button>
            </div>
          )}
        </>
      )}

      <TransactionFormDialog
        open={Boolean(editingTransaction)}
        onOpenChange={(open) => !open && setEditingTransaction(null)}
        accounts={accountsQuery.data ?? []}
        categories={categoriesQuery.data ?? []}
        transaction={editingTransaction}
      />
      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this transaction?</AlertDialogTitle>
            <AlertDialogDescription>It will be soft-deleted, removed from balances, and retained in the database for financial history.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" disabled={deleteMutation.isPending} onClick={confirmDelete}>Soft delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export function TransactionRow({ transaction, bordered, onEdit, onDelete }: { transaction: TransactionRecord; bordered: boolean; onEdit: () => void; onDelete: () => void }) {
  const type = transaction.transaction_type
  const Icon = type === "income" ? ArrowDownLeft : type === "transfer" ? ArrowRightLeft : ArrowUpRight
  const amount = getTransactionAmount(transaction)
  const account = transaction.entries[0]?.account
  const source = transaction.entries.find((entry) => entry.amount_minor < 0)?.account
  const display = getTransactionDisplayDetails(transaction)
  const subtitle = `${display.context} · ${formatLongDate(transaction.transaction_date)}`
  const editable = type === "expense" || type === "income" || type === "transfer"
  const currency = account?.currency_code ?? source?.currency_code ?? "SGD"
  const displayAmount = type === "income"
    ? formatSignedCurrency(amount, currency)
    : type === "expense"
      ? formatSignedCurrency(-amount, currency)
      : formatCurrency(amount, currency)

  return (
    <div className={cn("grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 px-4 py-3.5 sm:flex sm:px-5 sm:py-4", bordered && "border-t border-border/20")}>
      <span className={cn(
        "flex size-10 shrink-0 items-center justify-center rounded-full",
        type === "income" ? "bg-positive/10 text-positive" : type === "expense" ? "bg-negative/10 text-negative" : "bg-primary/10 text-primary",
      )}>
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-sm leading-5 font-medium">{display.title}</p>
        <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
      </div>
      <p className={cn("max-w-[42vw] shrink-0 whitespace-nowrap text-right text-[clamp(0.78rem,3.5vw,0.875rem)] font-semibold tabular-nums sm:max-w-none", type === "income" && "text-positive", type === "expense" && "text-negative", type === "transfer" && "text-brand-secondary")}>
        <span className="sr-only">{type}: </span>
        {displayAmount}
      </p>
      {editable && (
        <div className="col-start-2 col-end-4 flex justify-end gap-1">
          <Button size="icon-sm" variant="ghost" aria-label={`Edit ${type} transaction`} onClick={onEdit}><Pencil /></Button>
          <Button size="icon-sm" variant="ghost" aria-label={`Delete ${type} transaction`} onClick={onDelete}><Trash2 /></Button>
        </div>
      )}
    </div>
  )
}

function FilterSelect({ value, onValueChange, placeholder, items }: { value: string; onValueChange: (value: string) => void; placeholder: string; items: Array<{ value: string; label: string }> }) {
  return (
    <Select items={items} value={value} onValueChange={(nextValue) => nextValue && onValueChange(nextValue)}>
      <SelectTrigger className="w-full"><SelectValue placeholder={placeholder} /></SelectTrigger>
      <SelectContent>{items.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent>
    </Select>
  )
}

function EmptyState({ title, description, actionLabel, actionHref }: { title: string; description: string; actionLabel: string; actionHref: string }) {
  return (
    <Card className="border-0 bg-card/60 shadow-none ring-1 ring-white/5">
      <CardContent className="flex min-h-64 flex-col items-center justify-center text-center">
        <ReceiptText className="size-9 text-primary" />
        <h2 className="mt-4 text-lg font-semibold">{title}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>
        <Button className="mt-5" render={<Link to={actionHref} state={actionHref === "/transactions/new" ? { returnTo: "/transactions" } : undefined} />}>
          {actionHref === "/transactions/new" && <Plus />} {actionLabel}
        </Button>
      </CardContent>
    </Card>
  )
}
