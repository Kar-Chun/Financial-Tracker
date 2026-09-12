import { Link } from "react-router-dom"

import { SectionHeader } from "@/components/shared/finance-ui"
import { TransactionRowContent } from "@/features/transactions/transaction-row-content"
import { formatShortDate } from "@/lib/dates"
import type { TransactionRecord } from "@/types/finance"

export function RecentTransactionsCard({ transactions, todayDate, className }: { transactions: TransactionRecord[]; todayDate: string; className?: string }) {
  return <section className={className} aria-labelledby="recent-heading">
    <SectionHeader id="recent-heading" title="Recent transactions" href="/transactions" />
    <div className="divide-y divide-border/25 border-y border-border/30">
      {transactions.length === 0 ? <p className="py-6 text-sm text-muted-foreground">No transactions recorded yet.</p>
        : transactions.slice(0, 3).map((transaction) => <Link key={transaction.id} to="/transactions" className="ledger-row ledger-interactive">
          <TransactionRowContent transaction={transaction} dateLabel={transaction.transaction_date === todayDate ? "Today" : formatShortDate(transaction.transaction_date)} />
        </Link>)}
    </div>
  </section>
}
