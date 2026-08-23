import { ArrowDownLeft, ArrowRightLeft, ArrowUpRight } from "lucide-react"
import { Link } from "react-router-dom"

import { getTransactionAmount } from "@/features/transactions/transaction-logic"
import { formatCurrency, formatSignedCurrency } from "@/lib/currency"
import { formatShortDate } from "@/lib/dates"
import { cn } from "@/lib/utils"
import type { TransactionRecord } from "@/types/finance"

export function RecentTransactionsCard({ transactions, todayDate, className }: { transactions: TransactionRecord[]; todayDate: string; className?: string }) {
  return (
    <section className={className} aria-labelledby="recent-heading">
      <div className="mb-3 flex items-center justify-between px-1">
        <h2 id="recent-heading" className="section-heading">Recent</h2>
        <Link to="/transactions" className="text-xs font-semibold text-primary hover:text-primary/80">See all</Link>
      </div>
      <div className="overflow-hidden rounded-2xl bg-card/75 ring-1 ring-white/4">
        {transactions.length === 0 ? (
          <p className="px-4 py-12 text-center text-sm text-muted-foreground">No transactions recorded yet.</p>
        ) : transactions.slice(0, 6).map((transaction, index) => {
          const type = transaction.transaction_type
          const Icon = type === "income" ? ArrowDownLeft : type === "transfer" ? ArrowRightLeft : ArrowUpRight
          const source = transaction.entries.find((entry) => entry.amount_minor < 0)?.account
          const destination = transaction.entries.find((entry) => entry.amount_minor > 0)?.account
          const account = transaction.entries[0]?.account
          const category = transaction.category?.name ?? (type === "transfer" ? "Transfer" : "Uncategorised")
          const title = type === "transfer"
            ? transaction.description || `${source?.name ?? "Account"} → ${destination?.name ?? "Account"}`
            : transaction.description || category
          const date = transaction.transaction_date === todayDate ? "Today" : formatShortDate(transaction.transaction_date)
          const currency = account?.currency_code ?? source?.currency_code ?? "SGD"
          const amountMinor = getTransactionAmount(transaction)
          const displayAmount = type === "income"
            ? formatSignedCurrency(amountMinor, currency)
            : type === "expense"
              ? formatSignedCurrency(-amountMinor, currency)
              : formatCurrency(amountMinor, currency)
          return (
            <div key={transaction.id} className={cn("grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3.5", index > 0 && "border-t border-border/20")}>
              <span className={cn(
                "flex size-9 items-center justify-center rounded-full",
                type === "income" ? "bg-positive/10 text-positive" : type === "expense" ? "bg-negative/10 text-negative" : "bg-primary/10 text-primary",
              )}>
                <Icon className="size-4" aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="line-clamp-2 text-sm leading-5 font-medium">{title}</span>
                <span className="block truncate text-xs text-muted-foreground">{category} · {date}</span>
              </span>
              <span className={cn(
                "max-w-[42vw] shrink-0 whitespace-nowrap text-right text-[clamp(0.78rem,3.5vw,0.875rem)] font-semibold tabular-nums sm:max-w-none",
                type === "income" && "text-positive",
                type === "expense" && "text-negative",
                type === "transfer" && "text-brand-secondary",
              )}>
                <span className="sr-only">{type}: </span>
                {displayAmount}
              </span>
            </div>
          )
        })}
      </div>
    </section>
  )
}
