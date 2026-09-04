import { calculateNetCashFlow, getTransactionAmount } from "@/features/transactions/transaction-logic"
import { getCurrentMonthInput } from "@/lib/dates"
import type { Category, TransactionRecord } from "@/types/finance"

export function getMonthlySummary(
  transactions: TransactionRecord[],
  baseCurrency: string,
  month = getCurrentMonthInput(),
) {
  const currentMonth = transactions.filter(
    (transaction) =>
      transaction.transaction_date.startsWith(month)
      && transaction.entries.every((entry) => entry.account?.currency_code === baseCurrency),
  )
  const incomeMinor = currentMonth
    .filter((transaction) => transaction.transaction_type === "income")
    .reduce((total, transaction) => total + getTransactionAmount(transaction), 0)
  const expensesMinor = currentMonth
    .filter((transaction) => transaction.transaction_type === "expense")
    .reduce((total, transaction) => total + getTransactionAmount(transaction), 0)

  return {
    incomeMinor,
    expensesMinor,
    netCashFlowMinor: calculateNetCashFlow(currentMonth),
  }
}

export function groupExpensesByParent(
  transactions: TransactionRecord[],
  categories: Category[],
  baseCurrency: string,
  month = getCurrentMonthInput(),
) {
  const categoryMap = new Map(categories.map((category) => [category.id, category]))
  const totals = new Map<string, number>()

  for (const transaction of transactions) {
    if (
      transaction.transaction_type !== "expense"
      || !transaction.transaction_date.startsWith(month)
      || !transaction.entries.every((entry) => entry.account?.currency_code === baseCurrency)
    ) continue
    const category = transaction.category_id ? categoryMap.get(transaction.category_id) : undefined
    const parent = category?.parent_id ? categoryMap.get(category.parent_id) : undefined
    const label = parent?.name ?? category?.name ?? "Uncategorised"
    totals.set(label, (totals.get(label) ?? 0) + getTransactionAmount(transaction))
  }

  return [...totals.entries()]
    .map(([label, amountMinor]) => ({ label, amountMinor }))
    .sort((a, b) => b.amountMinor - a.amountMinor)
}
