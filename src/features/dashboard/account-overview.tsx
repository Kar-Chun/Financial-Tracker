import { Building2, Landmark, WalletCards } from "lucide-react"
import { Link } from "react-router-dom"

import { formatCurrency } from "@/lib/currency"
import { cn } from "@/lib/utils"
import type { AccountSummaryRow } from "@/types/database"

export function AccountOverview({ accounts, baseCurrency }: { accounts: AccountSummaryRow[]; baseCurrency: string }) {
  return (
    <section aria-labelledby="accounts-heading">
      <div className="mb-3 flex items-center justify-between px-1">
        <h2 id="accounts-heading" className="section-heading">Accounts</h2>
        <Link to="/accounts" className="text-xs font-semibold text-primary hover:text-primary/80">Manage</Link>
      </div>
      <div className="overflow-hidden rounded-2xl bg-card/75 ring-1 ring-white/4">
        {accounts.slice(0, 5).map((account, index) => {
          const Icon = account.account_type === "investment" ? Landmark : account.account_type === "bank" ? Building2 : WalletCards
          const value = account.account_type === "investment"
            ? formatCurrency(account.base_value_minor ?? 0, baseCurrency)
            : formatCurrency(account.current_balance_minor ?? account.opening_balance_minor, account.currency_code)
          return (
            <Link
              key={account.id}
              to="/accounts"
              className={cn(
                "grid min-h-18 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 transition-colors hover:bg-accent/45 focus-visible:bg-accent/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                index > 0 && "border-t border-border/25",
              )}
            >
              <span className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Icon className="size-4" aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{account.name}</span>
                <span className="block truncate text-xs capitalize text-muted-foreground">
                  {[account.institution, account.account_type, account.currency_code].filter(Boolean).join(" · ")}
                </span>
              </span>
              <span className="text-right text-sm font-semibold tabular-nums">{value}</span>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
