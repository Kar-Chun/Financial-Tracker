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
  investment_tracking_mode: "simple" | "detailed"
  detailed_started_on: string | null
  detailed_started_at: string | null
}

type ManualFxRateRow = {
  id: string
  user_id: string
  from_currency: string
  to_currency: string
  rate: number
  rate_date: string
  created_at: string
  updated_at: string
}

type InvestmentHoldingRow = {
  id: string
  account_id: string
  user_id: string
  symbol: string
  name: string
  asset_type: "stock" | "etf" | "fund" | "other"
  currency_code: string
  archived_at: string | null
  created_at: string
  updated_at: string
}

type InvestmentTradeRow = {
  id: string
  holding_id: string
  account_id: string
  user_id: string
  trade_type: "opening_position" | "buy" | "sell"
  quantity: number
  unit_price: number
  fee_minor: number
  cash_effect_minor: number
  cost_basis_effect_minor: number
  realized_gain_minor: number
  trade_date: string
  note: string | null
  created_at: string
}

type InvestmentPriceRow = {
  id: string
  holding_id: string
  user_id: string
  price: number
  priced_at: string
  created_at: string
  updated_at: string
}

type InvestmentCashEventRow = {
  id: string
  account_id: string
  holding_id: string | null
  user_id: string
  event_type: "opening_cash" | "dividend" | "cash_adjustment"
  amount_minor: number
  event_date: string
  note: string | null
  created_at: string
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

type MonthlyBudgetRow = {
  id: string
  user_id: string
  month_start: string
  currency_code: string
  amount_minor: number
  created_at: string
  updated_at: string
}

type CategoryBudgetRow = {
  id: string
  monthly_budget_id: string
  category_id: string
  amount_minor: number
  created_at: string
  updated_at: string
}

type SavingsGoalRow = {
  id: string
  user_id: string
  name: string
  target_amount_minor: number
  currency_code: string
  target_date: string | null
  note: string | null
  archived_at: string | null
  created_at: string
  updated_at: string
}

type GoalAllocationRow = {
  id: string
  goal_id: string
  amount_minor: number
  allocation_date: string
  note: string | null
  created_at: string
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
      monthly_budgets: TableDefinition<
        MonthlyBudgetRow,
        Partial<Omit<MonthlyBudgetRow, "id" | "created_at" | "updated_at">> & Pick<MonthlyBudgetRow, "user_id" | "month_start" | "currency_code" | "amount_minor">,
        Partial<Omit<MonthlyBudgetRow, "id" | "user_id" | "created_at" | "updated_at">>
      >
      category_budgets: TableDefinition<
        CategoryBudgetRow,
        Partial<Omit<CategoryBudgetRow, "id" | "created_at" | "updated_at">> & Pick<CategoryBudgetRow, "monthly_budget_id" | "category_id" | "amount_minor">,
        Partial<Omit<CategoryBudgetRow, "id" | "created_at" | "updated_at">>
      >
      savings_goals: TableDefinition<
        SavingsGoalRow,
        Partial<Omit<SavingsGoalRow, "id" | "created_at" | "updated_at">> & Pick<SavingsGoalRow, "user_id" | "name" | "target_amount_minor" | "currency_code">,
        Partial<Omit<SavingsGoalRow, "id" | "user_id" | "currency_code" | "created_at" | "updated_at">>
      >
      goal_allocations: TableDefinition<
        GoalAllocationRow,
        Partial<Omit<GoalAllocationRow, "id" | "created_at">> & Pick<GoalAllocationRow, "goal_id" | "amount_minor" | "allocation_date">,
        Partial<Omit<GoalAllocationRow, "id" | "goal_id" | "created_at">>
      >
      manual_fx_rates: TableDefinition<ManualFxRateRow, Partial<ManualFxRateRow>, Partial<ManualFxRateRow>>
      investment_holdings: TableDefinition<InvestmentHoldingRow, Partial<InvestmentHoldingRow>, Partial<InvestmentHoldingRow>>
      investment_trades: TableDefinition<InvestmentTradeRow, Partial<InvestmentTradeRow>, Partial<InvestmentTradeRow>>
      investment_prices: TableDefinition<InvestmentPriceRow, Partial<InvestmentPriceRow>, Partial<InvestmentPriceRow>>
      investment_cash_events: TableDefinition<InvestmentCashEventRow, Partial<InvestmentCashEventRow>, Partial<InvestmentCashEventRow>>
    }
    Views: Record<string, never>
    Functions: {
      reset_net_worth_history: {
        Args: Record<string, never>
        Returns: string
      }
      archive_account: {
        Args: { p_account_id: string }
        Returns: undefined
      }
      restore_account: {
        Args: { p_account_id: string }
        Returns: undefined
      }
      delete_account_permanently: {
        Args: { p_account_id: string }
        Returns: Json
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
      get_monthly_budget_summary: {
        Args: { p_month_start: string }
        Returns: Json
      }
      upsert_monthly_budget: {
        Args: { p_month_start: string; p_amount_minor: number }
        Returns: string
      }
      upsert_category_budget: {
        Args: { p_month_start: string; p_category_id: string; p_amount_minor: number }
        Returns: string
      }
      remove_category_budget: {
        Args: { p_month_start: string; p_category_id: string }
        Returns: undefined
      }
      copy_monthly_budget: {
        Args: { p_source_month_start: string; p_destination_month_start: string }
        Returns: Json
      }
      upsert_savings_goal: {
        Args: {
          p_name: string
          p_target_amount_minor: number
          p_target_date?: string | null
          p_note?: string | null
          p_goal_id?: string | null
        }
        Returns: string
      }
      set_savings_goal_archived: {
        Args: { p_goal_id: string; p_archived: boolean }
        Returns: string
      }
      record_goal_allocation: {
        Args: {
          p_goal_id: string
          p_operation: "allocate" | "reduce"
          p_amount_minor: number
          p_allocation_date: string
          p_note?: string | null
        }
        Returns: string
      }
      get_savings_goals_summary: {
        Args: { p_include_archived?: boolean }
        Returns: Json
      }
      get_savings_goal_detail: {
        Args: { p_goal_id: string }
        Returns: Json
      }
      get_investment_portfolio_summary: {
        Args: Record<string, never>
        Returns: Json
      }
      get_detailed_investment_account: {
        Args: { p_account_id: string }
        Returns: Json
      }
      preview_detailed_investment_conversion: {
        Args: { p_account_id: string; p_opening_cash_minor: number; p_holdings: Json }
        Returns: Json
      }
      enable_detailed_investment_tracking: {
        Args: { p_account_id: string; p_started_on: string; p_opening_cash_minor: number; p_holdings: Json }
        Returns: string
      }
      upsert_investment_holding: {
        Args: { p_account_id: string; p_symbol: string; p_name: string; p_asset_type: string; p_holding_id?: string | null }
        Returns: string
      }
      record_investment_trade: {
        Args: { p_account_id: string; p_holding_id: string; p_trade_type: "buy" | "sell"; p_quantity: string; p_unit_price: string; p_fee_minor: number; p_trade_date: string; p_note?: string | null }
        Returns: string
      }
      update_investment_prices: {
        Args: { p_account_id: string; p_priced_at: string; p_prices: Json }
        Returns: number
      }
      upsert_manual_fx_rate: {
        Args: { p_from_currency: string; p_rate: string; p_rate_date: string }
        Returns: string
      }
      record_investment_cash_event: {
        Args: { p_account_id: string; p_holding_id: string | null; p_event_type: "dividend" | "cash_adjustment"; p_amount_minor: number; p_event_date: string; p_note: string }
        Returns: string
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

export type Profile = ProfileRow
export type Category = CategoryRow
export type NetWorthSnapshot = NetWorthSnapshotRow

export type FrequentExpenseCategoryRow = {
  category_id: string
  usage_count: number
  last_used_on: string
}
