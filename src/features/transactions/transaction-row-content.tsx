import { ArrowDownLeft, ArrowRightLeft, ArrowUpRight, Scale } from "lucide-react"

import { getTransactionAmount, getTransactionDisplayDetails } from "@/features/transactions/transaction-logic"
import { formatCurrency, formatSignedCurrency } from "@/lib/currency"
import { cn } from "@/lib/utils"
import type { TransactionRecord } from "@/types/finance"

/** Shared read-only presentation for the recent list and paginated ledger. */
export function TransactionRowContent({ transaction, dateLabel }: { transaction: TransactionRecord; dateLabel: string }) {
  const type = transaction.transaction_type
  const Icon = type === "adjustment" ? Scale : type === "income" ? ArrowDownLeft : type === "transfer" ? ArrowRightLeft : ArrowUpRight
  const display = getTransactionDisplayDetails(transaction)
  const source = transaction.entries.find((entry) => entry.amount_minor < 0)?.account
  const currency = transaction.entries[0]?.account?.currency_code ?? source?.currency_code ?? "SGD"
  const amount = getTransactionAmount(transaction)
  const value = type === "adjustment" ? formatSignedCurrency(transaction.entries[0]?.amount_minor ?? 0, currency)
    : type === "income" ? formatSignedCurrency(amount, currency)
    : type === "expense" ? formatSignedCurrency(-amount, currency) : formatCurrency(amount, currency)

  return <>
    <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl border border-border/25",
      type === "income" ? "bg-positive/10 text-positive" : type === "expense" ? "bg-surface-elevated text-brand-secondary" : "bg-primary/10 text-brand-secondary",
    )}><Icon className="size-5" aria-hidden="true" /></span>
    <span className="min-w-0">
      <span className="line-clamp-2 break-words text-sm leading-5 font-medium [overflow-wrap:anywhere]">{display.title}</span>
      <span className="mt-0.5 block text-xs leading-5 text-muted-foreground [overflow-wrap:anywhere]">{display.context} · {dateLabel}</span>
    </span>
    <span className={cn("max-w-[40vw] text-right text-[clamp(0.8rem,3.5vw,0.95rem)] font-medium tabular-nums [overflow-wrap:anywhere] sm:max-w-64",
      type === "income" && "text-positive", type === "expense" && "text-negative", type === "transfer" && "text-brand-secondary",
    )}><span className="sr-only">{type}: </span>{value}</span>
  </>
}
