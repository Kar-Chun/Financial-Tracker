import { z } from "zod"

import { parseCurrencyToMinor } from "@/lib/currency"
import type { AccountSummaryRow } from "@/types/database"
import type { PrimaryTransactionType, TransactionRecord } from "@/types/finance"

export const transactionFormSchema = z.object({
  transactionType: z.enum(["expense", "income", "transfer"]),
  amount: z.string().trim().min(1, "Amount is required."),
  accountId: z.string().min(1, "Account is required."),
  destinationAccountId: z.string(),
  categoryId: z.string(),
  transactionDate: z.string().min(1, "Date is required."),
  description: z.string().trim().max(500, "Description is too long."),
}).superRefine((values, context) => {
  if (values.transactionType === "transfer") {
    if (!values.destinationAccountId) {
      context.addIssue({ code: "custom", path: ["destinationAccountId"], message: "Destination account is required." })
    }
    if (values.accountId && values.accountId === values.destinationAccountId) {
      context.addIssue({ code: "custom", path: ["destinationAccountId"], message: "Choose a different destination account." })
    }
  } else if (!values.categoryId) {
    context.addIssue({ code: "custom", path: ["categoryId"], message: "Category is required." })
  }
})

export type TransactionFormValues = z.infer<typeof transactionFormSchema>

export function validateTransactionDraft(
  values: TransactionFormValues,
  accounts: AccountSummaryRow[],
) {
  const source = accounts.find((account) => account.id === values.accountId)
  if (!source) throw new Error("Select a valid account.")

  const amountMinor = parseCurrencyToMinor(values.amount, source.currency_code)
  if (amountMinor <= 0) throw new Error("Amount must be greater than zero.")

  if (values.transactionType === "transfer") {
    const destination = accounts.find((account) => account.id === values.destinationAccountId)
    if (!destination) throw new Error("Select a valid destination account.")
    if (source.id === destination.id) throw new Error("Transfer accounts must be different.")
    if (source.currency_code !== destination.currency_code) {
      throw new Error("Cross-currency transfers are not supported in V1.")
    }
  }

  return { amountMinor, source }
}

export function buildEntryAmounts(type: PrimaryTransactionType, amountMinor: number) {
  if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) {
    throw new Error("Amount must be a positive safe integer.")
  }

  if (type === "expense") return [-amountMinor]
  if (type === "income") return [amountMinor]
  return [-amountMinor, amountMinor]
}

export function getTransactionAmount(transaction: TransactionRecord) {
  const sourceEntry = transaction.entries.find((entry) => entry.amount_minor < 0)
  const entry = sourceEntry ?? transaction.entries[0]
  return Math.abs(entry?.amount_minor ?? 0)
}

export function calculateNetCashFlow(transactions: TransactionRecord[]) {
  return transactions.reduce((total, transaction) => {
    if (transaction.transaction_type === "income") return total + getTransactionAmount(transaction)
    if (transaction.transaction_type === "expense") return total - getTransactionAmount(transaction)
    return total
  }, 0)
}

export function transferPreservesNetWorth(amountMinor: number) {
  return buildEntryAmounts("transfer", amountMinor).reduce((sum, amount) => sum + amount, 0) === 0
}
