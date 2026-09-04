// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  archiveAccount,
  deleteAccountPermanently,
  getAccountSummaries,
  restoreAccount,
} from "@/features/accounts/accounts-service"
import { OfflineFinancialMutationError } from "@/lib/network"
import { UnexpectedRpcResponseError } from "@/lib/rpc-validation"

const supabaseMock = vi.hoisted(() => ({ rpc: vi.fn() }))

vi.mock("@/lib/supabase", () => ({
  getSupabaseClient: () => supabaseMock,
}))

beforeEach(() => {
  Object.defineProperty(navigator, "onLine", { configurable: true, value: true })
  supabaseMock.rpc.mockReset()
  supabaseMock.rpc.mockResolvedValue({ data: {}, error: null })
})

describe("account lifecycle services", () => {
  it("uses the authenticated archive and restore RPCs", async () => {
    await archiveAccount("account-a")
    await restoreAccount("account-a")

    expect(supabaseMock.rpc).toHaveBeenNthCalledWith(1, "archive_account", { p_account_id: "account-a" })
    expect(supabaseMock.rpc).toHaveBeenNthCalledWith(2, "restore_account", { p_account_id: "account-a" })
  })

  it("uses one permanent-delete RPC call rather than browser table deletes", async () => {
    supabaseMock.rpc.mockResolvedValue({
      data: {
        account_id: "test-investment",
        soft_deleted_transactions_purged: 0,
        investment_valuations_deleted: 0,
        investment_holdings_deleted: 2,
        investment_trades_deleted: 3,
        investment_prices_deleted: 2,
        investment_cash_events_deleted: 1,
      },
      error: null,
    })
    await deleteAccountPermanently("test-investment")

    expect(supabaseMock.rpc).toHaveBeenCalledTimes(1)
    expect(supabaseMock.rpc).toHaveBeenCalledWith("delete_account_permanently", {
      p_account_id: "test-investment",
    })
  })

  it("rejects a malformed permanent-delete result", async () => {
    supabaseMock.rpc.mockResolvedValue({ data: { account_id: "test-investment" }, error: null })

    await expect(deleteAccountPermanently("test-investment")).rejects.toBeInstanceOf(UnexpectedRpcResponseError)
  })

  it("accepts nullable account-summary values and rejects malformed account types", async () => {
    supabaseMock.rpc.mockResolvedValueOnce({ data: [accountSummary()], error: null })
    const summaries = await getAccountSummaries()
    expect(summaries[0]?.current_balance_minor).toBeNull()

    supabaseMock.rpc.mockResolvedValueOnce({
      data: [{ ...accountSummary(), account_type: "credit_card" }],
      error: null,
    })
    await expect(getAccountSummaries()).rejects.toBeInstanceOf(UnexpectedRpcResponseError)
  })

  it.each([
    ["archive", archiveAccount],
    ["restore", restoreAccount],
    ["permanent delete", deleteAccountPermanently],
  ])("blocks %s while offline and never queues an RPC", async (_label, action) => {
    Object.defineProperty(navigator, "onLine", { configurable: true, value: false })

    await expect(action("account-a")).rejects.toBeInstanceOf(OfflineFinancialMutationError)
    expect(supabaseMock.rpc).not.toHaveBeenCalled()
  })
})

function accountSummary() {
  return {
    id: "investment-id",
    name: "IBKR",
    account_type: "investment",
    institution: null,
    currency_code: "USD",
    opening_balance_minor: 0,
    current_balance_minor: null,
    native_value_minor: null,
    base_value_minor: null,
    valued_at: null,
    included_in_net_worth: false,
    created_at: "2026-09-01T00:00:00Z",
    updated_at: "2026-09-04T00:00:00Z",
    investment_tracking_mode: "detailed",
    base_value_available: false,
    broker_cash_minor: 0,
    holdings_value_minor: null,
    cost_basis_minor: 0,
    unrealized_gain_minor: null,
    realized_gain_minor: 0,
    dividends_minor: 0,
    missing_price_count: 1,
  }
}
