import type { Database as GeneratedDatabase, Json } from "@/types/database.generated"

export type { CompositeTypes, Enums, Json, Tables, TablesInsert, TablesUpdate } from "@/types/database.generated"

type GeneratedPublicSchema = GeneratedDatabase["public"]
type GeneratedFunctions = GeneratedPublicSchema["Functions"]

type NullableOptional<T, Key extends keyof T> = Omit<T, Key> & {
  [Property in Key]?: T[Property] | null
}

type InvestmentTradeArgs = NullableOptional<
  Omit<GeneratedFunctions["record_investment_trade"]["Args"], "p_quantity" | "p_unit_price"> & {
    p_quantity: string
    p_unit_price: string
  },
  "p_note"
>

type ApplicationFunctions = Omit<
  GeneratedFunctions,
  | "export_user_data_v1"
  | "enable_daily_transaction_reminder"
  | "get_notification_settings"
  | "remove_current_push_subscription"
  | "reconcile_account_balance"
  | "set_daily_transaction_reminder"
  | "get_transaction_note_suggestions"
  | "get_transactions_page"
  | "record_goal_allocation"
  | "record_investment_trade"
  | "record_investment_cash_event"
  | "upsert_account"
  | "upsert_category"
  | "upsert_financial_transaction"
  | "upsert_investment_holding"
  | "upsert_manual_fx_rate"
  | "upsert_savings_goal"
> & {
  export_user_data_v1: {
    Args: Record<never, never>
    Returns: Json
  }
  enable_daily_transaction_reminder: {
    Args: {
      p_endpoint: string
      p_p256dh: string
      p_auth: string
    }
    Returns: Json
  }
  get_notification_settings: {
    Args: Record<never, never>
    Returns: Json
  }
  remove_current_push_subscription: {
    Args: { p_endpoint: string }
    Returns: boolean
  }
  set_daily_transaction_reminder: {
    Args: { p_enabled: boolean }
    Returns: Json
  }
  // Pending migration contracts; regenerate database.generated.ts after deployment.
  reconcile_account_balance: {
    Args: {
      p_account_id: string
      p_expected_current_balance_minor: number
      p_actual_balance_minor: number
      p_expected_currency_code: string
      p_note?: string | null
    }
    Returns: Json
  }
  get_transaction_note_suggestions: {
    Args: {
      p_query: string
      p_transaction_type: string
      p_limit?: number | null
    }
    Returns: Array<{
      note: string
      category_id: string | null
      category_name: string | null
      category_label: string | null
      usage_count: number
      last_used_on: string
      last_used_at: string
    }>
  }
  get_transactions_page: {
    Args: NullableOptional<
      GeneratedFunctions["get_transactions_page"]["Args"],
      | "p_account_id"
      | "p_category_id"
      | "p_cursor_created_at"
      | "p_cursor_id"
      | "p_cursor_transaction_date"
      | "p_end_date"
      | "p_start_date"
      | "p_transaction_type"
    > & {
      p_eligible_spending?: boolean | null
    }
    Returns: GeneratedFunctions["get_transactions_page"]["Returns"]
  }
  record_goal_allocation: {
    Args: NullableOptional<GeneratedFunctions["record_goal_allocation"]["Args"], "p_note">
    Returns: GeneratedFunctions["record_goal_allocation"]["Returns"]
  }
  record_investment_trade: {
    Args: InvestmentTradeArgs
    Returns: GeneratedFunctions["record_investment_trade"]["Returns"]
  }
  record_investment_cash_event: {
    Args: Omit<GeneratedFunctions["record_investment_cash_event"]["Args"], "p_holding_id"> & {
      p_holding_id: string | null
    }
    Returns: GeneratedFunctions["record_investment_cash_event"]["Returns"]
  }
  upsert_account: {
    Args: NullableOptional<GeneratedFunctions["upsert_account"]["Args"], "p_account_id" | "p_institution">
    Returns: GeneratedFunctions["upsert_account"]["Returns"]
  }
  upsert_category: {
    Args: NullableOptional<GeneratedFunctions["upsert_category"]["Args"], "p_category_id" | "p_parent_id">
    Returns: GeneratedFunctions["upsert_category"]["Returns"]
  }
  upsert_financial_transaction: {
    Args: NullableOptional<
      GeneratedFunctions["upsert_financial_transaction"]["Args"],
      "p_category_id" | "p_description" | "p_destination_account_id" | "p_transaction_id"
    >
    Returns: GeneratedFunctions["upsert_financial_transaction"]["Returns"]
  }
  upsert_investment_holding: {
    Args: NullableOptional<GeneratedFunctions["upsert_investment_holding"]["Args"], "p_holding_id">
    Returns: GeneratedFunctions["upsert_investment_holding"]["Returns"]
  }
  upsert_manual_fx_rate: {
    Args: Omit<GeneratedFunctions["upsert_manual_fx_rate"]["Args"], "p_rate"> & { p_rate: string }
    Returns: GeneratedFunctions["upsert_manual_fx_rate"]["Returns"]
  }
  upsert_savings_goal: {
    Args: NullableOptional<
      GeneratedFunctions["upsert_savings_goal"]["Args"],
      "p_goal_id" | "p_note" | "p_target_date"
    >
    Returns: GeneratedFunctions["upsert_savings_goal"]["Returns"]
  }
}

/**
 * Generated schema with narrow application-boundary corrections for nullable
 * RPC arguments and exact PostgreSQL NUMERIC inputs. Regenerate the source
 * artifact; keep corrections here rather than editing generated output.
 */
export type Database = Omit<GeneratedDatabase, "public"> & {
  public: Omit<GeneratedPublicSchema, "Functions"> & {
    Functions: ApplicationFunctions
  }
}
