import type { AccountSummaryRow } from "@/types/database"

export type InvestmentPortfolioSummary = {
  currency_code: string
  portfolio_value_base_minor: number
  unrealized_gain_base_minor: number
  excluded_account_count: number
  accounts: AccountSummaryRow[]
}

export type DetailedHolding = {
  id: string
  symbol: string
  name: string
  asset_type: "stock" | "etf" | "fund" | "other"
  currency_code: string
  archived_at: string | null
  quantity: number
  cost_basis_minor: number
  average_cost_minor: number | null
  latest_price: number | null
  latest_price_date: string | null
  market_value_minor: number | null
  unrealized_gain_minor: number | null
}

export type DetailedTrade = {
  id: string
  holding_id: string
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

export type DetailedCashEvent = {
  id: string
  holding_id: string | null
  event_type: "opening_cash" | "dividend" | "cash_adjustment"
  amount_minor: number
  event_date: string
  note: string | null
  created_at: string
}

export type DetailedInvestmentAccount = {
  account: {
    id: string
    name: string
    institution: string | null
    currency_code: string
    investment_tracking_mode: "detailed"
    detailed_started_on: string
    archived_at: string | null
  }
  value: {
    native_value_minor: number | null
    base_value_minor: number | null
    base_value_available: boolean
    broker_cash_minor: number
    holdings_value_minor: number
    cost_basis_minor: number
    unrealized_gain_minor: number | null
    realized_gain_minor: number
    dividends_minor: number
    missing_price_count: number
    fx_rate: number | null
    fx_rate_date: string | null
    latest_price_date: string | null
  }
  holdings: DetailedHolding[]
  trades: DetailedTrade[]
  cash_events: DetailedCashEvent[]
  prices: Array<{ id: string; holding_id: string; price: number; priced_at: string; created_at: string }>
}

export type OpeningHoldingInput = {
  symbol: string
  name: string
  asset_type: "stock" | "etf" | "fund" | "other"
  quantity: string
  average_cost: string
  current_price: string
}
