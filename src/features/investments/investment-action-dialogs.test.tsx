// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { CashEventDialog, FxDialog, HoldingDialog, PricesDialog, TradeDialog } from "@/features/investments/investment-action-dialogs"
import type { DetailedHolding } from "@/features/investments/investment-types"

const mutations = vi.hoisted(() => ({
  cashEvent: { isPending: false, mutate: vi.fn() },
  fx: { isPending: false, mutate: vi.fn() },
  holding: { isPending: false, mutate: vi.fn() },
  prices: { isPending: false, mutate: vi.fn() },
  trade: { isPending: false, mutate: vi.fn() },
}))

vi.mock("@/features/investments/investments-hooks", () => ({
  useRecordCashEvent: () => mutations.cashEvent,
  useRecordTrade: () => mutations.trade,
  useSaveHolding: () => mutations.holding,
  useSaveManualFx: () => mutations.fx,
  useUpdatePrices: () => mutations.prices,
}))
vi.mock("sonner", () => ({ toast: { success: vi.fn() } }))

const holding: DetailedHolding = {
  id: "holding-cspx",
  symbol: "CSPX",
  name: "iShares Core S&P 500",
  asset_type: "etf",
  currency_code: "USD",
  archived_at: null,
  quantity: 1.23456789,
  cost_basis_minor: 12_345,
  average_cost_minor: 10_000,
  latest_price: 123.456789,
  latest_price_date: "2026-08-22",
  market_value_minor: 15_241,
  unrealized_gain_minor: 2_896,
}

beforeEach(() => {
  for (const mutation of Object.values(mutations)) {
    mutation.isPending = false
    mutation.mutate.mockReset()
  }
})

describe("investment action dialogs", () => {
  it.each(["buy", "sell"] as const)("keeps exact decimal strings when recording a %s", (type) => {
    render(
      <TradeDialog
        accountId="account-investment"
        currencyCode="USD"
        today="2026-08-23"
        holdings={[holding]}
        type={type}
        open
        onOpenChange={vi.fn()}
      />,
    )

    fireEvent.change(screen.getByLabelText("Quantity"), { target: { value: "1.23456789" } })
    fireEvent.change(screen.getByLabelText("Price per unit (USD)"), { target: { value: "123.456789" } })
    fireEvent.click(screen.getByRole("button", { name: `Record ${type}` }))

    expect(mutations.trade.mutate).toHaveBeenCalledOnce()
    expect(mutations.trade.mutate.mock.calls[0][0]).toMatchObject({
      accountId: "account-investment",
      holdingId: holding.id,
      tradeType: type,
      quantity: "1.23456789",
      unitPrice: "123.456789",
      tradeDate: "2026-08-23",
    })
  })

  it("preserves manual price precision at the mutation boundary", () => {
    render(
      <PricesDialog
        accountId="account-investment"
        currencyCode="USD"
        today="2026-08-23"
        holdings={[holding]}
        open
        onOpenChange={vi.fn()}
      />,
    )

    fireEvent.change(screen.getByLabelText("CSPX · iShares Core S&P 500 (USD)"), { target: { value: "123.456789" } })
    fireEvent.click(screen.getByRole("button", { name: "Save prices" }))

    expect(mutations.prices.mutate.mock.calls[0][0]).toEqual({
      accountId: "account-investment",
      pricedAt: "2026-08-23",
      prices: [{ holding_id: holding.id, price: "123.456789" }],
    })
  })

  it("preserves manual FX precision at the mutation boundary", () => {
    render(
      <FxDialog fromCurrency="USD" baseCurrency="SGD" today="2026-08-23" open onOpenChange={vi.fn()} />,
    )

    fireEvent.change(screen.getByLabelText("1 USD = SGD"), { target: { value: "1.284736" } })
    fireEvent.click(screen.getByRole("button", { name: "Save rate" }))

    expect(mutations.fx.mutate.mock.calls[0][0]).toEqual({
      fromCurrency: "USD",
      rate: "1.284736",
      rateDate: "2026-08-23",
    })
  })

  it("shows validation errors without issuing a malformed trade", () => {
    render(
      <TradeDialog
        accountId="account-investment"
        currencyCode="USD"
        today="2026-08-23"
        holdings={[holding]}
        type="buy"
        open
        onOpenChange={vi.fn()}
      />,
    )

    fireEvent.change(screen.getByLabelText("Quantity"), { target: { value: "1e-6" } })
    fireEvent.change(screen.getByLabelText("Price per unit (USD)"), { target: { value: "123.45" } })
    fireEvent.click(screen.getByRole("button", { name: "Record buy" }))

    expect(screen.getByRole("alert")).toHaveTextContent("Check the trade details.")
    expect(mutations.trade.mutate).not.toHaveBeenCalled()
  })

  it("surfaces a friendly mutation error and keeps the dialog open", async () => {
    mutations.fx.mutate.mockImplementation((_input, options: { onError: (error: Error) => void }) => {
      options.onError(new Error("Provider unavailable"))
    })
    render(
      <FxDialog fromCurrency="USD" baseCurrency="SGD" today="2026-08-23" open onOpenChange={vi.fn()} />,
    )

    fireEvent.change(screen.getByLabelText("1 USD = SGD"), { target: { value: "1.284736" } })
    fireEvent.click(screen.getByRole("button", { name: "Save rate" }))

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("The FX rate could not be saved."))
    expect(screen.getByRole("dialog")).toBeInTheDocument()
  })

  it("retains holding and cash-event actions after the split", () => {
    const { unmount } = render(<HoldingDialog accountId="account-investment" open onOpenChange={vi.fn()} />)
    fireEvent.change(screen.getByLabelText("Symbol"), { target: { value: "CSPX" } })
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "iShares Core S&P 500" } })
    fireEvent.click(screen.getByRole("button", { name: "Add holding" }))
    expect(mutations.holding.mutate.mock.calls[0][0]).toMatchObject({ accountId: "account-investment", symbol: "CSPX" })
    unmount()

    render(
      <CashEventDialog
        accountId="account-investment"
        currencyCode="USD"
        today="2026-08-23"
        holdings={[holding]}
        type="dividend"
        open
        onOpenChange={vi.fn()}
      />,
    )
    fireEvent.change(screen.getByLabelText("Amount (USD)"), { target: { value: "12.34" } })
    fireEvent.change(screen.getByLabelText("Note / source"), { target: { value: "Quarterly distribution" } })
    fireEvent.click(screen.getByRole("button", { name: "Save" }))
    expect(mutations.cashEvent.mutate.mock.calls[0][0]).toMatchObject({ eventType: "dividend", amountMinor: 1_234 })
  })
})
