import { Building2, Landmark, WalletCards } from "lucide-react"
import { Link } from "react-router-dom"
import { SectionHeader } from "@/components/shared/finance-ui"

import { formatCurrency } from "@/lib/currency"
import { cn } from "@/lib/utils"
import type { AccountSummaryRow } from "@/types/finance"

export function AccountOverview({ accounts, baseCurrency }: { accounts: AccountSummaryRow[]; baseCurrency: string }) {
  return (
    <section aria-labelledby="accounts-heading">
      <SectionHeader id="accounts-heading" title="Accounts" href="/accounts" />
      <div className="border-y border-border/30">
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
                "ledger-row ledger-interactive",
                index > 0 && "border-t border-border/25",
              )}
            >
              <span className="flex size-10 items-center justify-center rounded-xl border border-border/25 bg-surface-elevated text-brand-secondary">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="line-clamp-2 text-sm leading-5 font-medium">{account.name}</span>
                <span className="block truncate text-xs capitalize text-muted-foreground">
                  {[account.institution, account.account_type, account.currency_code].filter(Boolean).join(" · ")}
                </span>
              </span>
              <span className="max-w-[40vw] text-right text-[clamp(0.8rem,3.6vw,0.95rem)] font-medium tabular-nums [overflow-wrap:anywhere] sm:max-w-64">{value}</span>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
