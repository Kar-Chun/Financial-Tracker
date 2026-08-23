export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

type ProfileRow = {
  id: string
  display_name: string | null
  base_currency: string
  timezone: string
  created_at: string
  updated_at: string
}

type AccountRow = {
  id: string
  user_id: string
  name: string
  account_type: "bank" | "cash" | "investment"
  institution: string | null
  currency_code: string
  opening_balance_minor: number
  created_at: string
  updated_at: string
  archived_at: string | null
}

type CategoryRow = {
  id: string
  user_id: string
  name: string
  parent_id: string | null
  category_type: "expense" | "income"
  created_at: string
  archived_at: string | null
}

type TransactionRow = {
  id: string
  user_id: string
  transaction_type: "expense" | "income" | "transfer" | "refund" | "adjustment"
  category_id: string | null
  description: string | null
  transaction_date: string
  created_at: string
  updated_at: string
  deleted_at: string | null
}

type TransactionEntryRow = {
  id: string
  transaction_id: string
  account_id: string
  amount_minor: number
  created_at: string
}

type InvestmentValuationRow = {
  id: string
  user_id: string
  account_id: string
  native_value_minor: number
  base_value_minor: number
  valued_at: string
  created_at: string
  updated_at: string
}

type NetWorthSnapshotRow = {
  id: string
  user_id: string
  snapshot_date: string
  bank_value_base_minor: number
  cash_value_base_minor: number
  investment_value_base_minor: number
  total_value_base_minor: number
  created_at: string
  updated_at: string
}

type TableDefinition<Row, Insert, Update> = {
  Row: Row
  Insert: Insert
  Update: Update
  Relationships: []
}

export type Database = {
  public: {
    Tables: {
      profiles: TableDefinition<
        ProfileRow,
        Partial<Omit<ProfileRow, "created_at" | "updated_at">> & Pick<ProfileRow, "id">,
        Partial<Omit<ProfileRow, "id" | "created_at" | "updated_at">>
      >
      accounts: TableDefinition<
        AccountRow,
        Partial<Omit<AccountRow, "id" | "created_at" | "updated_at">> & Pick<AccountRow, "user_id" | "name" | "account_type">,
        Partial<Omit<AccountRow, "id" | "user_id" | "created_at" | "updated_at">>
      >
      categories: TableDefinition<
        CategoryRow,
        Partial<Omit<CategoryRow, "id" | "created_at">> & Pick<CategoryRow, "user_id" | "name" | "category_type">,
        Partial<Omit<CategoryRow, "id" | "user_id" | "created_at">>
      >
      transactions: TableDefinition<
        TransactionRow,
        Partial<Omit<TransactionRow, "id" | "created_at" | "updated_at">> & Pick<TransactionRow, "user_id" | "transaction_type" | "transaction_date">,
        Partial<Omit<TransactionRow, "id" | "user_id" | "created_at" | "updated_at">>
      >
      transaction_entries: TableDefinition<
        TransactionEntryRow,
        Partial<Omit<TransactionEntryRow, "id" | "created_at">> & Pick<TransactionEntryRow, "transaction_id" | "account_id" | "amount_minor">,
        Partial<Omit<TransactionEntryRow, "id" | "created_at">>
      >
      investment_valuations: TableDefinition<
        InvestmentValuationRow,
        Partial<Omit<InvestmentValuationRow, "id" | "created_at" | "updated_at">> & Pick<InvestmentValuationRow, "user_id" | "account_id" | "native_value_minor" | "base_value_minor" | "valued_at">,
        Partial<Omit<InvestmentValuationRow, "id" | "user_id" | "created_at" | "updated_at">>
      >
      net_worth_snapshots: TableDefinition<
        NetWorthSnapshotRow,
        Partial<Omit<NetWorthSnapshotRow, "id" | "created_at" | "updated_at">> & Pick<NetWorthSnapshotRow, "user_id" | "snapshot_date" | "bank_value_base_minor" | "cash_value_base_minor" | "investment_value_base_minor" | "total_value_base_minor">,
        Partial<Omit<NetWorthSnapshotRow, "id" | "user_id" | "created_at" | "updated_at">>
      >
    }
    Views: Record<string, never>
    Functions: {
      archive_account: {
        Args: { p_account_id: string }
        Returns: undefined
      }
      get_account_summaries: {
        Args: Record<string, never>
        Returns: AccountSummaryRow[]
      }
      get_spending_analytics: {
        Args: {
          p_start_date: string
          p_end_date: string
          p_previous_start_date: string
          p_previous_end_date: string
          p_trend_granularity?: "day" | "month"
        }
        Returns: Json
      }
      get_frequent_expense_categories: {
        Args: {
          p_limit?: number
          p_days?: number
        }
        Returns: FrequentExpenseCategoryRow[]
      }
      refresh_net_worth_snapshot: {
        Args: Record<string, never>
        Returns: string
      }
      soft_delete_transaction: {
        Args: { p_transaction_id: string }
        Returns: undefined
      }
      upsert_account: {
        Args: {
          p_account_type: string
          p_currency_code: string
          p_name: string
          p_opening_balance_minor?: number
          p_institution?: string | null
          p_account_id?: string | null
        }
        Returns: string
      }
      upsert_financial_transaction: {
        Args: {
          p_transaction_type: string
          p_amount_minor: number
          p_account_id: string
          p_transaction_date: string
          p_category_id?: string | null
          p_destination_account_id?: string | null
          p_description?: string | null
          p_transaction_id?: string | null
        }
        Returns: string
      }
      upsert_investment_valuation: {
        Args: {
          p_account_id: string
          p_native_value_minor: number
          p_base_value_minor: number
          p_valued_at: string
        }
        Returns: string
      }
      upsert_category: {
        Args: {
          p_name: string
          p_category_type: "expense" | "income"
          p_parent_id?: string | null
          p_category_id?: string | null
        }
        Returns: string
      }
      set_category_archived: {
        Args: {
          p_category_id: string
          p_archived: boolean
        }
        Returns: string
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

export type AccountSummaryRow = {
  id: string
  name: string
  account_type: "bank" | "cash" | "investment"
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
}

export type Profile = ProfileRow
export type Category = CategoryRow
export type NetWorthSnapshot = NetWorthSnapshotRow

export type FrequentExpenseCategoryRow = {
  category_id: string
  usage_count: number
  last_used_on: string
}
