import { MoreHorizontal, Pencil, Plus, ReceiptText, Trash2 } from "lucide-react"
import { Fragment, useMemo, useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
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
import { FilterPill, PageTitle } from "@/components/shared/finance-ui"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { TransactionRowContent } from "@/features/transactions/transaction-row-content"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { useAccounts } from "@/features/accounts/accounts-hooks"
import { useAuth } from "@/features/auth/auth-context"
import { TransactionFormDialog } from "@/features/transactions/transaction-form-dialog"
import { useCategories, useSoftDeleteTransaction, useTransactions } from "@/features/transactions/transactions-hooks"
import { getCategoryDisplayName } from "@/features/transactions/transaction-logic"
import { buildTransactionPageFilters, getInitialTransactionFilterState } from "@/features/transactions/transaction-filter-state"
import { flattenTransactionPages } from "@/features/transactions/transactions-service"
import { formatLongDate, getCurrentMonthInput } from "@/lib/dates"
import { getErrorMessage } from "@/lib/errors"
import { cn } from "@/lib/utils"
import type { TransactionRecord } from "@/types/finance"

export function TransactionsPage() {
  const { user } = useAuth()
  const accountsQuery = useAccounts()
  const categoriesQuery = useCategories()
  const deleteMutation = useSoftDeleteTransaction()
  const [searchParams, setSearchParams] = useSearchParams()
  const initialFilters = getInitialTransactionFilterState(searchParams, getCurrentMonthInput())
  const [editingTransaction, setEditingTransaction] = useState<TransactionRecord | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<TransactionRecord | null>(null)
  const [month, setMonth] = useState(initialFilters.month)
  const [typeFilter, setTypeFilter] = useState(initialFilters.typeFilter)
  const [accountFilter, setAccountFilter] = useState(initialFilters.accountFilter)
  const [categoryFilter, setCategoryFilter] = useState(initialFilters.categoryFilter)
  const [exactDate, setExactDate] = useState(initialFilters.exactDate)
  const [eligibleSpending, setEligibleSpending] = useState(initialFilters.eligibleSpending)

  const filters = useMemo(() => buildTransactionPageFilters({
    accountFilter,
    categoryFilter,
    eligibleSpending,
    exactDate,
    month,
    typeFilter,
  }), [accountFilter, categoryFilter, eligibleSpending, exactDate, month, typeFilter])
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
  const clearDailySpendingFilter = () => {
    setExactDate(null)
    setEligibleSpending(false)
    setSearchParams({}, { replace: true })
  }
  const changeMonth = (value: string) => {
    setMonth(value)
    clearDailySpendingFilter()
  }
  const changeType = (value: string) => {
    setTypeFilter(value)
    clearDailySpendingFilter()
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
    <div className="space-y-5">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <PageTitle title="Transactions" />
        {(accountsQuery.data?.length ?? 0) > 0 ? (
          <Button className="hidden lg:inline-flex" render={<Link to="/transactions/new" state={{ returnTo: "/transactions" }} />}>
            <Plus /> Add transaction
          </Button>
        ) : (
          <Button className="hidden lg:inline-flex" disabled><Plus /> Add transaction</Button>
        )}
      </header>

      <section aria-label="Transaction filters" className="space-y-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Transaction type">
          {[{ value: "all", label: "All" }, { value: "expense", label: "Expense" }, { value: "income", label: "Income" }, { value: "transfer", label: "Transfer" }].map((item) => <FilterPill key={item.value} active={typeFilter === item.value} onClick={() => changeType(item.value)}>{item.label}</FilterPill>)}
        </div>
        <div className="grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-3">
          <Input className="col-span-2 rounded-full bg-surface sm:col-span-1" type="month" value={month} onChange={(event) => changeMonth(event.target.value)} aria-label="Filter month" />

          <FilterSelect value={accountFilter} onValueChange={setAccountFilter} placeholder="All accounts" items={accountFilterItems} />
          <FilterSelect value={categoryFilter} onValueChange={setCategoryFilter} placeholder="All categories" items={categoryFilterItems} />
          {exactDate && eligibleSpending && (
            <div className="flex items-center justify-between gap-3 rounded-xl bg-primary/8 px-3 py-2 text-xs text-muted-foreground col-span-2 sm:col-span-3">
              <span>Eligible expenses for {formatLongDate(exactDate)}</span>
              <Button type="button" size="sm" variant="ghost" onClick={clearDailySpendingFilter}>Show full month</Button>
            </div>
          )}
        </div>
      </section>

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
          <div>
            {transactions.map((transaction, index) => (
              <Fragment key={transaction.id}>
                {(index === 0 || transactions[index - 1].transaction_date !== transaction.transaction_date) && (
                  <h2 className="section-heading border-b border-border/30 pt-5 pb-2 first:pt-0">{formatLongDate(transaction.transaction_date)}</h2>
                )}
                <TransactionRow
                  transaction={transaction}
                  bordered={index > 0 && transactions[index - 1].transaction_date === transaction.transaction_date}
                  onEdit={() => openEdit(transaction)}
                  onDelete={() => setDeleteTarget(transaction)}
                />
              </Fragment>
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
  const editable = type === "expense" || type === "income" || type === "transfer"
  const content = <TransactionRowContent transaction={transaction} dateLabel={formatLongDate(transaction.transaction_date)} />
  return <div className={cn("flex min-w-0 items-center gap-1", bordered && "border-t border-border/25")}>
    {editable ? <button type="button" className="ledger-row ledger-interactive min-w-0 flex-1" aria-label={`Edit ${type} transaction`} onClick={onEdit}>{content}</button>
      : <div className="ledger-row min-w-0 flex-1">{content}</div>}
    {editable && <DropdownMenu>
      <DropdownMenuTrigger render={<Button className="min-h-11 min-w-11" variant="ghost" size="icon-sm" aria-label={`Actions for ${transaction.description?.trim() || type}`} />}><MoreHorizontal /></DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem className="min-h-11" onClick={onEdit}><Pencil /> Edit</DropdownMenuItem>
        <DropdownMenuItem className="min-h-11" variant="destructive" aria-label={`Delete ${type} transaction`} onClick={onDelete}><Trash2 /> Delete</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>}
  </div>
}

function FilterSelect({ value, onValueChange, placeholder, items }: { value: string; onValueChange: (value: string) => void; placeholder: string; items: Array<{ value: string; label: string }> }) {
  return (
    <Select items={items} value={value} onValueChange={(nextValue) => nextValue && onValueChange(nextValue)}>
      <SelectTrigger aria-label={placeholder} className="w-full min-w-0 rounded-full bg-surface"><SelectValue className="min-w-0 overflow-hidden" placeholder={placeholder} /></SelectTrigger>
      <SelectContent>{items.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent>
    </Select>
  )
}

function EmptyState({ title, description, actionLabel, actionHref }: { title: string; description: string; actionLabel: string; actionHref: string }) {
  return (
    <Card className="border-0 bg-card/60 shadow-none ring-1 ring-white/5">
      <CardContent className="flex min-h-48 flex-col items-center justify-center text-center">
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
