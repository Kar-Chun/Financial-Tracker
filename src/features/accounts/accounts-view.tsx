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
import { cn } from "@/lib/utils"
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
  const accountGroups = filterType === "investment"
    ? [{ label: "Investments", accounts }]
    : [
        { label: "Cash & bank", accounts: accounts.filter((account) => account.account_type !== "investment") },
        { label: "Investments", accounts: accounts.filter((account) => account.account_type === "investment") },
      ].filter((group) => group.accounts.length > 0)

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
      onError: (error) => toast.error(getErrorMessage(error, "The account could not be archived.")),
    })
  }

  return (
    <div className="space-y-7">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">Your money</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{description}</p>
        </div>
        <Button onClick={openCreate}><Plus /> Add account</Button>
      </header>

      {accountsQuery.isLoading ? (
        <div className="space-y-4">
          {[0, 1, 2].map((item) => <Skeleton key={item} className="h-24 rounded-2xl" />)}
        </div>
      ) : accountsQuery.isError ? (
        <ErrorState onRetry={() => accountsQuery.refetch()} />
      ) : accounts.length === 0 ? (
        <Card className="border-0 bg-card/60 shadow-none ring-1 ring-white/5">
          <CardContent className="flex min-h-72 flex-col items-center justify-center text-center">
            <span className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary"><WalletCards className="size-7" /></span>
            <h2 className="mt-5 text-lg font-semibold">No {filterType ? "investment " : ""}accounts yet</h2>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">Add an account to start tracking balances and financial activity.</p>
            <Button className="mt-5" onClick={openCreate}><Plus /> Add account</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-7">
          {accountGroups.map((group) => {
            const headingId = `account-group-${group.label.replaceAll(" ", "-").toLowerCase()}`
            return (
              <section key={group.label} aria-labelledby={headingId}>
                <h2 id={headingId} className="section-heading mb-3 px-1">{group.label}</h2>
                <div className="overflow-hidden rounded-2xl bg-card/70 ring-1 ring-white/4">
                  {group.accounts.map((account, index) => (
                    <AccountRow
                      key={account.id}
                      account={account}
                      baseCurrency={baseCurrency}
                      bordered={index > 0}
                      onEdit={() => openEdit(account)}
                      onArchive={() => setArchiveTarget(account)}
                      onValue={() => setValuationAccount(account)}
                    />
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      )}

      <AccountFormDialog open={formOpen} onOpenChange={setFormOpen} account={editingAccount} initialType={filterType ?? "bank"} />
      <ValuationDialog account={valuationAccount} open={Boolean(valuationAccount)} onOpenChange={(open) => !open && setValuationAccount(null)} />
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
            <AlertDialogAction variant="destructive" onClick={confirmArchive} disabled={archiveMutation.isPending}>Archive account</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function AccountRow({
  account,
  baseCurrency,
  bordered,
  onEdit,
  onArchive,
  onValue,
}: {
  account: AccountSummaryRow
  baseCurrency: string
  bordered: boolean
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
    <div className={cn("grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 px-4 py-4 sm:px-5", bordered && "border-t border-border/25")}>
      <span className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <h2 className="line-clamp-2 text-sm leading-5 font-semibold sm:text-base">{account.name}</h2>
        <p className="truncate text-xs capitalize text-muted-foreground">
          {[account.institution, account.account_type, account.currency_code].filter(Boolean).join(" · ")}
        </p>
      </div>
      <div className="text-right">
        <p className="max-w-[45vw] whitespace-nowrap text-[clamp(0.85rem,3.8vw,1.125rem)] font-semibold tracking-tight tabular-nums sm:max-w-none">{primaryValue}</p>
        <p className="text-[0.68rem] text-muted-foreground">{isInvestment ? "Base value" : "Calculated"}</p>
      </div>
      <div className="col-start-2 col-end-4 min-w-0">
        {isInvestment && (
          <>
            <p className="text-xs text-muted-foreground">
              Native: {formatCurrency(account.native_value_minor ?? 0, account.currency_code)}
              {account.valued_at ? ` · ${formatShortDate(account.valued_at)}` : " · Not valued yet"}
            </p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {account.currency_code === baseCurrency
                ? "Transfers after the latest manual valuation are included until you update the value again."
                : "Native transfers are reflected; update the manual base value after foreign-currency transfers."}
            </p>
          </>
        )}
        {!isInvestment && !account.included_in_net_worth && (
          <p className="text-xs text-amber-300">Excluded from {baseCurrency} net worth until FX conversion is available.</p>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          {isInvestment && <Button size="sm" onClick={onValue}>Update value</Button>}
          <Button size="sm" variant="outline" onClick={onEdit}><Pencil /> Edit</Button>
          <Button size="sm" variant="ghost" onClick={onArchive}><Archive /> Archive</Button>
        </div>
      </div>
    </div>
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
