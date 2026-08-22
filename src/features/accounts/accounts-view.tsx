import { Archive, Building2, Landmark, Pencil, Plus, WalletCards } from "lucide-react"
import { useMemo, useState } from "react"
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
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { AccountFormDialog } from "@/features/accounts/account-form-dialog"
import { useAccounts, useArchiveAccount } from "@/features/accounts/accounts-hooks"
import { ValuationDialog } from "@/features/accounts/valuation-dialog"
import { useProfile } from "@/features/auth/profile-service"
import { formatCurrency } from "@/lib/currency"
import { formatShortDate } from "@/lib/dates"
import { getErrorMessage } from "@/lib/errors"
import type { AccountSummaryRow } from "@/types/database"
import type { AccountType } from "@/types/finance"

type AccountsViewProps = {
  filterType?: AccountType
  title?: string
  description?: string
}

export function AccountsView({
  filterType,
  title = "Accounts",
  description = "Your active bank, cash, and investment accounts.",
}: AccountsViewProps) {
  const accountsQuery = useAccounts()
  const profileQuery = useProfile()
  const archiveMutation = useArchiveAccount()
  const [formOpen, setFormOpen] = useState(false)
  const [editingAccount, setEditingAccount] = useState<AccountSummaryRow | null>(null)
  const [valuationAccount, setValuationAccount] = useState<AccountSummaryRow | null>(null)
  const [archiveTarget, setArchiveTarget] = useState<AccountSummaryRow | null>(null)
  const accounts = useMemo(
    () => (accountsQuery.data ?? []).filter((account) => !filterType || account.account_type === filterType),
    [accountsQuery.data, filterType],
  )
  const baseCurrency = profileQuery.data?.base_currency ?? "SGD"

  const openCreate = () => {
    setEditingAccount(null)
    setFormOpen(true)
  }

  const openEdit = (account: AccountSummaryRow) => {
    setEditingAccount(account)
    setFormOpen(true)
  }

  const confirmArchive = () => {
    if (!archiveTarget) return
    archiveMutation.mutate(archiveTarget.id, {
      onSuccess: () => {
        toast.success("Account archived.")
        setArchiveTarget(null)
      },
      onError: (error) => {
        toast.error(getErrorMessage(error, "The account could not be archived."))
      },
    })
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-emerald-700">Your money</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{description}</p>
        </div>
        <Button onClick={openCreate}><Plus /> Add account</Button>
      </header>

      {accountsQuery.isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((item) => <Skeleton key={item} className="h-48 rounded-xl" />)}
        </div>
      ) : accountsQuery.isError ? (
        <ErrorState onRetry={() => accountsQuery.refetch()} />
      ) : accounts.length === 0 ? (
        <Card className="border-dashed bg-card/60 shadow-none">
          <CardContent className="flex min-h-72 flex-col items-center justify-center text-center">
            <span className="flex size-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
              <WalletCards className="size-7" />
            </span>
            <h2 className="mt-5 text-lg font-semibold">No {filterType ? "investment " : ""}accounts yet</h2>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              Add an account to start tracking balances and financial activity.
            </p>
            <Button className="mt-5" onClick={openCreate}><Plus /> Add account</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {accounts.map((account) => (
            <AccountCard
              key={account.id}
              account={account}
              baseCurrency={baseCurrency}
              onEdit={() => openEdit(account)}
              onArchive={() => setArchiveTarget(account)}
              onValue={() => setValuationAccount(account)}
            />
          ))}
        </div>
      )}

      <AccountFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        account={editingAccount}
        initialType={filterType ?? "bank"}
      />
      <ValuationDialog
        account={valuationAccount}
        open={Boolean(valuationAccount)}
        onOpenChange={(open) => !open && setValuationAccount(null)}
      />
      <AlertDialog open={Boolean(archiveTarget)} onOpenChange={(open) => !open && setArchiveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive {archiveTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Archived accounts are hidden but financial history is preserved. The account must have a zero current value.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={confirmArchive} disabled={archiveMutation.isPending}>
              Archive account
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function AccountCard({
  account,
  baseCurrency,
  onEdit,
  onArchive,
  onValue,
}: {
  account: AccountSummaryRow
  baseCurrency: string
  onEdit: () => void
  onArchive: () => void
  onValue: () => void
}) {
  const Icon = account.account_type === "investment" ? Landmark : account.account_type === "bank" ? Building2 : WalletCards
  const isInvestment = account.account_type === "investment"
  const primaryValue = isInvestment
    ? formatCurrency(account.base_value_minor ?? 0, baseCurrency)
    : formatCurrency(account.current_balance_minor ?? account.opening_balance_minor, account.currency_code)

  return (
    <Card className="shadow-xs">
      <CardContent className="space-y-5">
        <div className="flex items-start justify-between gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
            <Icon className="size-5" />
          </span>
          <Badge variant="secondary" className="capitalize">{account.account_type}</Badge>
        </div>
        <div>
          <h2 className="text-base font-semibold">{account.name}</h2>
          <p className="text-xs text-muted-foreground">
            {[account.institution, account.currency_code].filter(Boolean).join(" · ")}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{isInvestment ? "Current base value" : "Calculated balance"}</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight">{primaryValue}</p>
          {isInvestment && (
            <p className="mt-1 text-xs text-muted-foreground">
              Native: {formatCurrency(account.native_value_minor ?? 0, account.currency_code)}
              {account.valued_at ? ` · ${formatShortDate(account.valued_at)}` : " · Not valued yet"}
            </p>
          )}
          {!isInvestment && !account.included_in_net_worth && (
            <p className="mt-2 text-xs text-amber-700">
              Excluded from {baseCurrency} net worth until FX conversion is available.
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2 border-t pt-4">
          {isInvestment && <Button size="sm" onClick={onValue}>Update value</Button>}
          <Button size="sm" variant="outline" onClick={onEdit}><Pencil /> Edit</Button>
          <Button size="sm" variant="ghost" onClick={onArchive}><Archive /> Archive</Button>
        </div>
      </CardContent>
    </Card>
  )
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <Card className="border-destructive/30">
      <CardContent className="py-10 text-center">
        <p className="font-medium">Accounts could not be loaded.</p>
        <p className="mt-1 text-sm text-muted-foreground">Check your connection and try again.</p>
        <Button className="mt-4" variant="outline" onClick={onRetry}>Try again</Button>
      </CardContent>
    </Card>
  )
}
