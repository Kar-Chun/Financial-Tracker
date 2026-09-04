import { performFinancialMutation } from "@/lib/network"
import { getSupabaseClient } from "@/lib/supabase"
import type { Json } from "@/types/database"
import type {
  DetailedInvestmentAccount,
  InvestmentPortfolioSummary,
  OpeningHoldingInput,
} from "@/features/investments/investment-types"
import { normalizeInvestmentDecimal } from "@/features/investments/investment-logic"

export async function getInvestmentPortfolio() {
  const { data, error } = await getSupabaseClient().rpc("get_investment_portfolio_summary")
  if (error) throw error
  return data as InvestmentPortfolioSummary
}

export async function getDetailedInvestmentAccount(accountId: string) {
  const { data, error } = await getSupabaseClient().rpc("get_detailed_investment_account", { p_account_id: accountId })
  if (error) throw error
  return data as DetailedInvestmentAccount
}

function serializeOpeningHoldings(holdings: OpeningHoldingInput[]) {
  return holdings.map((holding) => ({
    ...holding,
    quantity: requireInvestmentDecimal(holding.quantity, "quantity"),
    average_cost: requireInvestmentDecimal(holding.average_cost, "average cost", { allowZero: true }),
    current_price: requireInvestmentDecimal(holding.current_price, "current price"),
  })) as Json
}

function requireInvestmentDecimal(
  value: string,
  label: string,
  options: { maximumDecimals?: number; allowZero?: boolean } = {},
) {
  const normalized = normalizeInvestmentDecimal(value, options)
  if (normalized === null) throw new Error(`Enter a valid ${label}.`)
  return normalized
}

export async function previewDetailedConversion(input: { accountId: string; openingCashMinor: number; holdings: OpeningHoldingInput[] }) {
  const { data, error } = await getSupabaseClient().rpc("preview_detailed_investment_conversion", {
    p_account_id: input.accountId,
    p_opening_cash_minor: input.openingCashMinor,
    p_holdings: serializeOpeningHoldings(input.holdings),
  })
  if (error) throw error
  return data as { simple_native_value_minor: number; detailed_native_value_minor: number; difference_minor: number; currency_code: string }
}

export function enableDetailedTracking(input: { accountId: string; startedOn: string; openingCashMinor: number; holdings: OpeningHoldingInput[] }) {
  return performFinancialMutation(async () => {
    const { data, error } = await getSupabaseClient().rpc("enable_detailed_investment_tracking", {
      p_account_id: input.accountId,
      p_started_on: input.startedOn,
      p_opening_cash_minor: input.openingCashMinor,
      p_holdings: serializeOpeningHoldings(input.holdings),
    })
    if (error) throw error
    return data
  })
}

export function saveHolding(input: { accountId: string; holdingId?: string; symbol: string; name: string; assetType: string }) {
  return performFinancialMutation(async () => {
    const { data, error } = await getSupabaseClient().rpc("upsert_investment_holding", {
      p_account_id: input.accountId, p_holding_id: input.holdingId ?? null,
      p_symbol: input.symbol, p_name: input.name, p_asset_type: input.assetType,
    })
    if (error) throw error
    return data
  })
}

export function recordTrade(input: { accountId: string; holdingId: string; tradeType: "buy" | "sell"; quantity: string; unitPrice: string; feeMinor: number; tradeDate: string; note: string }) {
  return performFinancialMutation(async () => {
    const { data, error } = await getSupabaseClient().rpc("record_investment_trade", {
      p_account_id: input.accountId, p_holding_id: input.holdingId, p_trade_type: input.tradeType,
      p_quantity: requireInvestmentDecimal(input.quantity, "quantity"),
      p_unit_price: requireInvestmentDecimal(input.unitPrice, "unit price"),
      p_fee_minor: input.feeMinor,
      p_trade_date: input.tradeDate, p_note: input.note || null,
    })
    if (error) throw error
    return data
  })
}

export function updatePrices(input: { accountId: string; pricedAt: string; prices: Array<{ holding_id: string; price: string }> }) {
  return performFinancialMutation(async () => {
    const { data, error } = await getSupabaseClient().rpc("update_investment_prices", {
      p_account_id: input.accountId, p_priced_at: input.pricedAt,
      p_prices: input.prices.map((item) => ({
        holding_id: item.holding_id,
        price: requireInvestmentDecimal(item.price, "price"),
      })) as Json,
    })
    if (error) throw error
    return data
  })
}

export function saveManualFx(input: { fromCurrency: string; rate: string; rateDate: string }) {
  return performFinancialMutation(async () => {
    const { data, error } = await getSupabaseClient().rpc("upsert_manual_fx_rate", {
      p_from_currency: input.fromCurrency,
      p_rate: requireInvestmentDecimal(input.rate, "FX rate", { maximumDecimals: 12 }),
      p_rate_date: input.rateDate,
    })
    if (error) throw error
    return data
  })
}

export function recordCashEvent(input: { accountId: string; holdingId: string | null; eventType: "dividend" | "cash_adjustment"; amountMinor: number; eventDate: string; note: string }) {
  return performFinancialMutation(async () => {
    const { data, error } = await getSupabaseClient().rpc("record_investment_cash_event", {
      p_account_id: input.accountId, p_holding_id: input.holdingId, p_event_type: input.eventType,
      p_amount_minor: input.amountMinor, p_event_date: input.eventDate, p_note: input.note,
    })
    if (error) throw error
    return data
  })
}
