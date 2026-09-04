// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  enableDetailedTracking,
  getDetailedInvestmentAccount,
  getInvestmentPortfolio,
  previewDetailedConversion,
  recordTrade,
  saveManualFx,
  updatePrices,
} from "@/features/investments/investments-service"
import { UnexpectedRpcResponseError } from "@/lib/rpc-validation"

const supabaseMock = vi.hoisted(() => ({ rpc: vi.fn() }))

vi.mock("@/lib/supabase", () => ({ getSupabaseClient: () => supabaseMock }))

beforeEach(() => {
  Object.defineProperty(navigator, "onLine", { configurable: true, value: true })
  supabaseMock.rpc.mockReset()
  supabaseMock.rpc.mockResolvedValue({ data: "result-id", error: null })
})

describe("detailed investment decimal RPC boundaries", () => {
  const openingHoldings = [
    {
      symbol: "TINY",
      name: "Fractional holding",
      asset_type: "etf" as const,
      quantity: "0.000001",
      average_cost: "123.456789",
      current_price: "1.284736",
    },
    {
      symbol: "LONG",
      name: "Long fractional holding",
      asset_type: "stock" as const,
      quantity: "1.23456789",
      average_cost: "0",
      current_price: "123.456789",
    },
  ]

  it("keeps opening-position decimals as exact strings for preview and persistence", async () => {
    supabaseMock.rpc
      .mockResolvedValueOnce({
        data: {
          simple_native_value_minor: 10_000,
          detailed_native_value_minor: 10_000,
          difference_minor: 0,
          currency_code: "SGD",
        },
        error: null,
      })
      .mockResolvedValueOnce({ data: "result-id", error: null })
    await previewDetailedConversion({
      accountId: "account-id",
      openingCashMinor: 10_000,
      holdings: openingHoldings,
    })
    await enableDetailedTracking({
      accountId: "account-id",
      startedOn: "2026-09-04",
      openingCashMinor: 10_000,
      holdings: openingHoldings,
    })

    for (const call of supabaseMock.rpc.mock.calls) {
      expect(call[1].p_holdings).toEqual(openingHoldings)
      expect(typeof call[1].p_holdings[0].quantity).toBe("string")
      expect(typeof call[1].p_holdings[0].average_cost).toBe("string")
      expect(typeof call[1].p_holdings[0].current_price).toBe("string")
    }
  })

  it.each(["buy", "sell"] as const)("keeps %s quantity and price exact at the RPC boundary", async (tradeType) => {
    await recordTrade({
      accountId: "account-id",
      holdingId: "holding-id",
      tradeType,
      quantity: "1.23456789",
      unitPrice: "123.456789",
      feeMinor: 25,
      tradeDate: "2026-09-04",
      note: "Precision test",
    })

    expect(supabaseMock.rpc).toHaveBeenCalledWith("record_investment_trade", expect.objectContaining({
      p_trade_type: tradeType,
      p_quantity: "1.23456789",
      p_unit_price: "123.456789",
    }))
  })

  it("keeps manual prices exact inside the JSON RPC payload", async () => {
    await updatePrices({
      accountId: "account-id",
      pricedAt: "2026-09-04",
      prices: [{ holding_id: "holding-id", price: "123.456789" }],
    })

    expect(supabaseMock.rpc).toHaveBeenCalledWith("update_investment_prices", {
      p_account_id: "account-id",
      p_priced_at: "2026-09-04",
      p_prices: [{ holding_id: "holding-id", price: "123.456789" }],
    })
  })

  it("keeps a twelve-decimal-capable manual FX rate exact", async () => {
    await saveManualFx({ fromCurrency: "USD", rate: "1.284736", rateDate: "2026-09-04" })

    expect(supabaseMock.rpc).toHaveBeenCalledWith("upsert_manual_fx_rate", {
      p_from_currency: "USD",
      p_rate: "1.284736",
      p_rate_date: "2026-09-04",
    })
  })

  it("rejects malformed conversion previews without affecting decimal persistence", async () => {
    supabaseMock.rpc.mockResolvedValue({ data: { detailed_native_value_minor: "10000" }, error: null })

    await expect(previewDetailedConversion({
      accountId: "account-id",
      openingCashMinor: 10_000,
      holdings: openingHoldings,
    })).rejects.toBeInstanceOf(UnexpectedRpcResponseError)
  })

  it("validates portfolio and Detailed account read models with nullable values", async () => {
    supabaseMock.rpc
      .mockResolvedValueOnce({
        data: {
          currency_code: "SGD",
          portfolio_value_base_minor: 0,
          unrealized_gain_base_minor: 0,
          excluded_account_count: 0,
          accounts: [],
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          account: {
            id: "account-id",
            name: "IBKR",
            institution: null,
            currency_code: "USD",
            investment_tracking_mode: "detailed",
            detailed_started_on: "2026-09-01",
            archived_at: null,
          },
          value: {
            native_value_minor: null,
            base_value_minor: null,
            base_value_available: false,
            broker_cash_minor: 0,
            holdings_value_minor: 0,
            cost_basis_minor: 0,
            unrealized_gain_minor: null,
            realized_gain_minor: 0,
            dividends_minor: 0,
            missing_price_count: 1,
            fx_rate: null,
            fx_rate_date: null,
            latest_price_date: null,
          },
          holdings: [],
          trades: [],
          cash_events: [],
          prices: [],
        },
        error: null,
      })

    const portfolio = await getInvestmentPortfolio()
    const account = await getDetailedInvestmentAccount("account-id")

    expect(portfolio.accounts).toEqual([])
    expect(account.value.base_value_minor).toBeNull()
    expect(account.value.fx_rate).toBeNull()
  })

  it("rejects malformed Detailed account responses", async () => {
    supabaseMock.rpc.mockResolvedValue({ data: { account: { id: "account-id" } }, error: null })

    await expect(getDetailedInvestmentAccount("account-id")).rejects.toBeInstanceOf(UnexpectedRpcResponseError)
  })
})
