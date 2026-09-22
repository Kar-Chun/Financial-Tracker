import { getTransactionAmount } from "@/features/transactions/transaction-logic"
import type { PrimaryTransactionType, TransactionRecord } from "@/types/finance"

// Regression reference for transaction fixtures; database RPCs own financial totals.
export function calculateNetCashFlow(transactions: TransactionRecord[]) {
  return transactions.reduce((total, transaction) => {
    if (transaction.transaction_type === "income") return total + getTransactionAmount(transaction)
    if (transaction.transaction_type === "expense") return total - getTransactionAmount(transaction)
    return total
  }, 0)
}

export function buildEntryAmounts(type: PrimaryTransactionType, amountMinor: number) {
  if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) {
    throw new Error("Amount must be a positive safe integer.")
  }

  if (type === "expense") return [-amountMinor]
  if (type === "income") return [amountMinor]
  return [-amountMinor, amountMinor]
}

export function transferPreservesNetWorth(amountMinor: number) {
  return buildEntryAmounts("transfer", amountMinor).reduce((sum, amount) => sum + amount, 0) === 0
}

export function applyTransferToBalances(
  balances: Record<string, number>,
  sourceAccountId: string,
  destinationAccountId: string,
  amountMinor: number,
) {
  const [sourceEntry, destinationEntry] = buildEntryAmounts("transfer", amountMinor)
  return {
    ...balances,
    [sourceAccountId]: (balances[sourceAccountId] ?? 0) + sourceEntry,
    [destinationAccountId]: (balances[destinationAccountId] ?? 0) + destinationEntry,
  }
}

export function getEffectiveInvestmentValues({
  manualNativeMinor,
  manualBaseMinor,
  unvaluedTransferDeltaMinor,
  nativeCurrencyIsBase,
}: {
  manualNativeMinor: number
  manualBaseMinor: number
  unvaluedTransferDeltaMinor: number
  nativeCurrencyIsBase: boolean
}) {
  return {
    nativeValueMinor: manualNativeMinor + unvaluedTransferDeltaMinor,
    baseValueMinor: manualBaseMinor + (nativeCurrencyIsBase ? unvaluedTransferDeltaMinor : 0),
  }
}
