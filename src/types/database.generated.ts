export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      accounts: {
        Row: {
          account_type: string
          archived_at: string | null
          created_at: string
          currency_code: string
          detailed_started_at: string | null
          detailed_started_on: string | null
          id: string
          institution: string | null
          investment_tracking_mode: string
          name: string
          opening_balance_minor: number
          updated_at: string
          user_id: string
        }
        Insert: {
          account_type: string
          archived_at?: string | null
          created_at?: string
          currency_code?: string
          detailed_started_at?: string | null
          detailed_started_on?: string | null
          id?: string
          institution?: string | null
          investment_tracking_mode?: string
          name: string
          opening_balance_minor?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          account_type?: string
          archived_at?: string | null
          created_at?: string
          currency_code?: string
          detailed_started_at?: string | null
          detailed_started_on?: string | null
          id?: string
          institution?: string | null
          investment_tracking_mode?: string
          name?: string
          opening_balance_minor?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_rate_limit_config: {
        Row: {
          global_day_limit: number
          lease_seconds: number
          per_day_limit: number
          per_hour_limit: number
          per_minute_limit: number
          singleton: boolean
          updated_at: string
        }
        Insert: {
          global_day_limit: number
          lease_seconds: number
          per_day_limit: number
          per_hour_limit: number
          per_minute_limit: number
          singleton?: boolean
          updated_at?: string
        }
        Update: {
          global_day_limit?: number
          lease_seconds?: number
          per_day_limit?: number
          per_hour_limit?: number
          per_minute_limit?: number
          singleton?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      ai_request_usage: {
        Row: {
          completed_at: string | null
          id: string
          lease_expires_at: string
          model: string | null
          requested_at: string
          status: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          id?: string
          lease_expires_at: string
          model?: string | null
          requested_at?: string
          status?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          id?: string
          lease_expires_at?: string
          model?: string | null
          requested_at?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          archived_at: string | null
          category_type: string
          created_at: string
          id: string
          name: string
          parent_id: string | null
          user_id: string
        }
        Insert: {
          archived_at?: string | null
          category_type: string
          created_at?: string
          id?: string
          name: string
          parent_id?: string | null
          user_id: string
        }
        Update: {
          archived_at?: string | null
          category_type?: string
          created_at?: string
          id?: string
          name?: string
          parent_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_same_user_fk"
            columns: ["parent_id", "user_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      category_budgets: {
        Row: {
          amount_minor: number
          category_id: string
          created_at: string
          id: string
          monthly_budget_id: string
          updated_at: string
        }
        Insert: {
          amount_minor: number
          category_id: string
          created_at?: string
          id?: string
          monthly_budget_id: string
          updated_at?: string
        }
        Update: {
          amount_minor?: number
          category_id?: string
          created_at?: string
          id?: string
          monthly_budget_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "category_budgets_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "category_budgets_monthly_budget_id_fkey"
            columns: ["monthly_budget_id"]
            isOneToOne: false
            referencedRelation: "monthly_budgets"
            referencedColumns: ["id"]
          },
        ]
      }
      goal_allocations: {
        Row: {
          allocation_date: string
          amount_minor: number
          created_at: string
          goal_id: string
          id: string
          note: string | null
        }
        Insert: {
          allocation_date: string
          amount_minor: number
          created_at?: string
          goal_id: string
          id?: string
          note?: string | null
        }
        Update: {
          allocation_date?: string
          amount_minor?: number
          created_at?: string
          goal_id?: string
          id?: string
          note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "goal_allocations_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "savings_goals"
            referencedColumns: ["id"]
          },
        ]
      }
      investment_cash_events: {
        Row: {
          account_id: string
          amount_minor: number
          created_at: string
          event_date: string
          event_type: string
          holding_id: string | null
          id: string
          note: string | null
          user_id: string
        }
        Insert: {
          account_id: string
          amount_minor: number
          created_at?: string
          event_date: string
          event_type: string
          holding_id?: string | null
          id?: string
          note?: string | null
          user_id: string
        }
        Update: {
          account_id?: string
          amount_minor?: number
          created_at?: string
          event_date?: string
          event_type?: string
          holding_id?: string | null
          id?: string
          note?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "investment_cash_events_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investment_cash_events_holding_id_fkey"
            columns: ["holding_id"]
            isOneToOne: false
            referencedRelation: "investment_holdings"
            referencedColumns: ["id"]
          },
        ]
      }
      investment_holdings: {
        Row: {
          account_id: string
          archived_at: string | null
          asset_type: string
          created_at: string
          currency_code: string
          id: string
          name: string
          symbol: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id: string
          archived_at?: string | null
          asset_type: string
          created_at?: string
          currency_code: string
          id?: string
          name: string
          symbol: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string
          archived_at?: string | null
          asset_type?: string
          created_at?: string
          currency_code?: string
          id?: string
          name?: string
          symbol?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "investment_holdings_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      investment_prices: {
        Row: {
          created_at: string
          holding_id: string
          id: string
          price: number
          priced_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          holding_id: string
          id?: string
          price: number
          priced_at: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          holding_id?: string
          id?: string
          price?: number
          priced_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "investment_prices_holding_id_fkey"
            columns: ["holding_id"]
            isOneToOne: false
            referencedRelation: "investment_holdings"
            referencedColumns: ["id"]
          },
        ]
      }
      investment_trades: {
        Row: {
          account_id: string
          cash_effect_minor: number
          cost_basis_effect_minor: number
          created_at: string
          fee_minor: number
          holding_id: string
          id: string
          note: string | null
          quantity: number
          realized_gain_minor: number
          trade_date: string
          trade_type: string
          unit_price: number
          user_id: string
        }
        Insert: {
          account_id: string
          cash_effect_minor: number
          cost_basis_effect_minor: number
          created_at?: string
          fee_minor?: number
          holding_id: string
          id?: string
          note?: string | null
          quantity: number
          realized_gain_minor?: number
          trade_date: string
          trade_type: string
          unit_price: number
          user_id: string
        }
        Update: {
          account_id?: string
          cash_effect_minor?: number
          cost_basis_effect_minor?: number
          created_at?: string
          fee_minor?: number
          holding_id?: string
          id?: string
          note?: string | null
          quantity?: number
          realized_gain_minor?: number
          trade_date?: string
          trade_type?: string
          unit_price?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "investment_trades_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investment_trades_holding_id_fkey"
            columns: ["holding_id"]
            isOneToOne: false
            referencedRelation: "investment_holdings"
            referencedColumns: ["id"]
          },
        ]
      }
      investment_valuations: {
        Row: {
          account_id: string
          base_value_minor: number
          created_at: string
          id: string
          native_value_minor: number
          updated_at: string
          user_id: string
          valued_at: string
        }
        Insert: {
          account_id: string
          base_value_minor: number
          created_at?: string
          id?: string
          native_value_minor: number
          updated_at?: string
          user_id: string
          valued_at: string
        }
        Update: {
          account_id?: string
          base_value_minor?: number
          created_at?: string
          id?: string
          native_value_minor?: number
          updated_at?: string
          user_id?: string
          valued_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "investment_valuations_account_same_user_fk"
            columns: ["account_id", "user_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      manual_fx_rates: {
        Row: {
          created_at: string
          from_currency: string
          id: string
          rate: number
          rate_date: string
          to_currency: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          from_currency: string
          id?: string
          rate: number
          rate_date: string
          to_currency: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          from_currency?: string
          id?: string
          rate?: number
          rate_date?: string
          to_currency?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      monthly_budgets: {
        Row: {
          amount_minor: number
          created_at: string
          currency_code: string
          id: string
          month_start: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_minor: number
          created_at?: string
          currency_code: string
          id?: string
          month_start: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_minor?: number
          created_at?: string
          currency_code?: string
          id?: string
          month_start?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      net_worth_snapshots: {
        Row: {
          bank_value_base_minor: number
          cash_value_base_minor: number
          created_at: string
          id: string
          investment_value_base_minor: number
          snapshot_date: string
          total_value_base_minor: number
          updated_at: string
          user_id: string
        }
        Insert: {
          bank_value_base_minor: number
          cash_value_base_minor: number
          created_at?: string
          id?: string
          investment_value_base_minor: number
          snapshot_date: string
          total_value_base_minor: number
          updated_at?: string
          user_id: string
        }
        Update: {
          bank_value_base_minor?: number
          cash_value_base_minor?: number
          created_at?: string
          id?: string
          investment_value_base_minor?: number
          snapshot_date?: string
          total_value_base_minor?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          base_currency: string
          created_at: string
          display_name: string | null
          id: string
          timezone: string
          updated_at: string
        }
        Insert: {
          base_currency?: string
          created_at?: string
          display_name?: string | null
          id: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          base_currency?: string
          created_at?: string
          display_name?: string | null
          id?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      savings_goals: {
        Row: {
          archived_at: string | null
          created_at: string
          currency_code: string
          id: string
          name: string
          note: string | null
          target_amount_minor: number
          target_date: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          currency_code: string
          id?: string
          name: string
          note?: string | null
          target_amount_minor: number
          target_date?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          currency_code?: string
          id?: string
          name?: string
          note?: string | null
          target_amount_minor?: number
          target_date?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      transaction_entries: {
        Row: {
          account_id: string
          amount_minor: number
          created_at: string
          id: string
          transaction_id: string
        }
        Insert: {
          account_id: string
          amount_minor: number
          created_at?: string
          id?: string
          transaction_id: string
        }
        Update: {
          account_id?: string
          amount_minor?: number
          created_at?: string
          id?: string
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transaction_entries_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_entries_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          category_id: string | null
          created_at: string
          deleted_at: string | null
          description: string | null
          id: string
          transaction_date: string
          transaction_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          transaction_date: string
          transaction_type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          transaction_date?: string
          transaction_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_category_same_user_fk"
            columns: ["category_id", "user_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      archive_account: { Args: { p_account_id: string }; Returns: undefined }
      claim_ai_request_slot: { Args: { p_model?: string }; Returns: Json }
      complete_ai_request_slot: {
        Args: { p_lease_id: string; p_status: string }
        Returns: boolean
      }
      copy_monthly_budget: {
        Args: {
          p_destination_month_start: string
          p_source_month_start: string
        }
        Returns: Json
      }
      delete_account_permanently: {
        Args: { p_account_id: string }
        Returns: Json
      }
      enable_detailed_investment_tracking: {
        Args: {
          p_account_id: string
          p_holdings: Json
          p_opening_cash_minor: number
          p_started_on: string
        }
        Returns: string
      }
      get_account_summaries: {
        Args: never
        Returns: {
          account_type: string
          base_value_available: boolean
          base_value_minor: number
          broker_cash_minor: number
          cost_basis_minor: number
          created_at: string
          currency_code: string
          current_balance_minor: number
          dividends_minor: number
          holdings_value_minor: number
          id: string
          included_in_net_worth: boolean
          institution: string
          investment_tracking_mode: string
          missing_price_count: number
          name: string
          native_value_minor: number
          opening_balance_minor: number
          realized_gain_minor: number
          unrealized_gain_minor: number
          updated_at: string
          valued_at: string
        }[]
      }
      get_ai_financial_overview: { Args: never; Returns: Json }
      get_dashboard_data: { Args: never; Returns: Json }
      get_detailed_investment_account: {
        Args: { p_account_id: string }
        Returns: Json
      }
      get_detailed_investment_value: {
        Args: { p_account_id: string; p_as_of_date: string }
        Returns: {
          base_value_available: boolean
          base_value_minor: number
          broker_cash_minor: number
          cost_basis_minor: number
          dividends_minor: number
          fx_rate: number
          fx_rate_date: string
          holdings_value_minor: number
          latest_price_date: string
          missing_price_count: number
          native_value_minor: number
          realized_gain_minor: number
          unrealized_gain_minor: number
        }[]
      }
      get_frequent_expense_categories: {
        Args: { p_days?: number; p_limit?: number }
        Returns: {
          category_id: string
          last_used_on: string
          usage_count: number
        }[]
      }
      get_investment_portfolio_summary: { Args: never; Returns: Json }
      get_monthly_budget_summary: {
        Args: { p_month_start: string }
        Returns: Json
      }
      get_savings_goal_detail: { Args: { p_goal_id: string }; Returns: Json }
      get_savings_goals_summary: {
        Args: { p_include_archived?: boolean }
        Returns: Json
      }
      get_spending_analytics: {
        Args: {
          p_end_date: string
          p_previous_end_date: string
          p_previous_start_date: string
          p_start_date: string
          p_trend_granularity?: string
        }
        Returns: Json
      }
      get_transactions_page: {
        Args: {
          p_account_id?: string
          p_category_id?: string
          p_cursor_created_at?: string
          p_cursor_id?: string
          p_cursor_transaction_date?: string
          p_end_date?: string
          p_limit?: number
          p_start_date?: string
          p_transaction_type?: string
        }
        Returns: Json
      }
      investment_currency_scale: {
        Args: { p_currency: string }
        Returns: number
      }
      preview_detailed_investment_conversion: {
        Args: {
          p_account_id: string
          p_holdings: Json
          p_opening_cash_minor: number
        }
        Returns: Json
      }
      record_goal_allocation: {
        Args: {
          p_allocation_date: string
          p_amount_minor: number
          p_goal_id: string
          p_note?: string
          p_operation: string
        }
        Returns: string
      }
      record_investment_cash_event: {
        Args: {
          p_account_id: string
          p_amount_minor: number
          p_event_date: string
          p_event_type: string
          p_holding_id: string
          p_note: string
        }
        Returns: string
      }
      record_investment_trade: {
        Args: {
          p_account_id: string
          p_fee_minor: number
          p_holding_id: string
          p_note?: string
          p_quantity: number
          p_trade_date: string
          p_trade_type: string
          p_unit_price: number
        }
        Returns: string
      }
      refresh_net_worth_snapshot: { Args: never; Returns: string }
      refresh_snapshot_for_user: {
        Args: { p_user_id: string }
        Returns: string
      }
      remove_category_budget: {
        Args: { p_category_id: string; p_month_start: string }
        Returns: undefined
      }
      reset_net_worth_history: { Args: never; Returns: string }
      restore_account: { Args: { p_account_id: string }; Returns: undefined }
      search_ai_transactions: {
        Args: {
          p_end_date?: string
          p_limit?: number
          p_order?: string
          p_query?: string
          p_start_date?: string
        }
        Returns: Json
      }
      seed_default_categories: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      set_category_archived: {
        Args: { p_archived: boolean; p_category_id: string }
        Returns: string
      }
      set_savings_goal_archived: {
        Args: { p_archived: boolean; p_goal_id: string }
        Returns: string
      }
      soft_delete_transaction: {
        Args: { p_transaction_id: string }
        Returns: undefined
      }
      update_investment_prices: {
        Args: { p_account_id: string; p_priced_at: string; p_prices: Json }
        Returns: number
      }
      upsert_account: {
        Args: {
          p_account_id?: string
          p_account_type: string
          p_currency_code: string
          p_institution?: string
          p_name: string
          p_opening_balance_minor?: number
        }
        Returns: string
      }
      upsert_category: {
        Args: {
          p_category_id?: string
          p_category_type: string
          p_name: string
          p_parent_id?: string
        }
        Returns: string
      }
      upsert_category_budget: {
        Args: {
          p_amount_minor: number
          p_category_id: string
          p_month_start: string
        }
        Returns: string
      }
      upsert_financial_transaction: {
        Args: {
          p_account_id: string
          p_amount_minor: number
          p_category_id?: string
          p_description?: string
          p_destination_account_id?: string
          p_transaction_date: string
          p_transaction_id?: string
          p_transaction_type: string
        }
        Returns: string
      }
      upsert_investment_holding: {
        Args: {
          p_account_id: string
          p_asset_type: string
          p_holding_id?: string
          p_name: string
          p_symbol: string
        }
        Returns: string
      }
      upsert_investment_valuation: {
        Args: {
          p_account_id: string
          p_base_value_minor: number
          p_native_value_minor: number
          p_valued_at: string
        }
        Returns: string
      }
      upsert_manual_fx_rate: {
        Args: { p_from_currency: string; p_rate: number; p_rate_date: string }
        Returns: string
      }
      upsert_monthly_budget: {
        Args: { p_amount_minor: number; p_month_start: string }
        Returns: string
      }
      upsert_savings_goal: {
        Args: {
          p_goal_id?: string
          p_name: string
          p_note?: string
          p_target_amount_minor: number
          p_target_date?: string
        }
        Returns: string
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
