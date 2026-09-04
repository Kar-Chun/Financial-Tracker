import type { Database as GeneratedDatabase } from "@/types/database.generated"

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
    >
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
