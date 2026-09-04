import type { Tables } from "@/types/database.generated"

export type AccountType = "bank" | "cash" | "investment"
export type PrimaryTransactionType = "expense" | "income" | "transfer"

export type Profile = Tables<"profiles">
export type Category = Omit<Tables<"categories">, "category_type"> & {
  category_type: "expense" | "income"
}
export type NetWorthSnapshot = Tables<"net_worth_snapshots">

export type AccountSummaryRow = {
  id: string
  name: string
  account_type: AccountType
  institution: string | null
  currency_code: string
  opening_balance_minor: number
  current_balance_minor: number | null
  native_value_minor: number | null
  base_value_minor: number | null
  valued_at: string | null
  included_in_net_worth: boolean
  created_at: string
  updated_at: string
  investment_tracking_mode?: "simple" | "detailed"
  base_value_available?: boolean
  broker_cash_minor?: number | null
  holdings_value_minor?: number | null
  cost_basis_minor?: number | null
  unrealized_gain_minor?: number | null
  realized_gain_minor?: number | null
  dividends_minor?: number | null
  missing_price_count?: number
}

export type FrequentExpenseCategoryRow = {
  category_id: string
  usage_count: number
  last_used_on: string
}

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
