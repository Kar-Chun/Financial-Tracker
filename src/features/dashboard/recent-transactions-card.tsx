import { ArrowDownLeft, ArrowRightLeft, ArrowUpRight } from "lucide-react"
import { Link } from "react-router-dom"

import { buttonVariants } from "@/components/ui/button-variants"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getTransactionAmount } from "@/features/transactions/transaction-logic"
import { formatCurrency } from "@/lib/currency"
import { formatShortDate } from "@/lib/dates"
import { cn } from "@/lib/utils"
import type { TransactionRecord } from "@/types/finance"

export function RecentTransactionsCard({ transactions }: { transactions: TransactionRecord[] }) {
  return (
    <Card className="shadow-xs xl:col-span-3">
      <CardHeader className="border-b sm:grid-cols-[1fr_auto]">
        <div>
          <CardTitle>Recent transactions</CardTitle>
          <p className="text-xs text-muted-foreground">Your latest recorded activity</p>
        </div>
        <Link to="/transactions" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "hidden sm:inline-flex")}>
          View all
        </Link>
      </CardHeader>
      <CardContent className="divide-y px-0">
        {transactions.length === 0 ? (
          <p className="px-4 py-12 text-center text-sm text-muted-foreground">No transactions recorded yet.</p>
        ) : transactions.slice(0, 5).map((transaction) => {
          const type = transaction.transaction_type
          const Icon = type === "income" ? ArrowDownLeft : type === "transfer" ? ArrowRightLeft : ArrowUpRight
          const account = transaction.entries[0]?.account
          return (
            <div key={transaction.id} className="flex items-center gap-3 px-4 py-3.5">
              <span className="flex size-9 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                <Icon className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">
                  {transaction.description || transaction.category?.name || (type === "transfer" ? "Transfer" : "Transaction")}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {account?.name ?? "Account"} · {formatShortDate(transaction.transaction_date)}
                </span>
              </span>
              <span className={cn("text-sm font-semibold", type === "income" && "text-emerald-700", type === "expense" && "text-rose-700")}>
                {type === "income" ? "+" : type === "expense" ? "−" : ""}
                {formatCurrency(getTransactionAmount(transaction), account?.currency_code ?? "SGD")}
              </span>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
