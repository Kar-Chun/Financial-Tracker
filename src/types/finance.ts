export type AccountType = "bank" | "cash" | "investment"
export type PrimaryTransactionType = "expense" | "income" | "transfer"

export type TransactionEntry = {
  id: string
  account_id: string
  amount_minor: number
  account: {
    id: string
    name: string
    currency_code: string
    account_type: AccountType
  } | null
}

export type TransactionRecord = {
  id: string
  transaction_type: "expense" | "income" | "transfer" | "refund" | "adjustment"
  category_id: string | null
  description: string | null
  transaction_date: string
  created_at: string
  category: {
    id: string
    name: string
    parent_id: string | null
    category_type: "expense" | "income"
  } | null
  entries: TransactionEntry[]
}
