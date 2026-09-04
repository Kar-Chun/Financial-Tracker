import { beforeEach, describe, expect, it, vi } from "vitest"

import { getDashboardData } from "@/features/dashboard/dashboard-service"
import { UnexpectedRpcResponseError } from "@/lib/rpc-validation"

const supabaseMock = vi.hoisted(() => ({ rpc: vi.fn() }))

vi.mock("@/lib/supabase", () => ({
  getSupabaseClient: () => supabaseMock,
}))

beforeEach(() => {
  supabaseMock.rpc.mockReset()
})

describe("bounded Dashboard reads", () => {
  it("loads the Dashboard through one bounded aggregate RPC", async () => {
    supabaseMock.rpc.mockResolvedValue({
      data: {
        accounts: [accountSummary()],
        monthly: {
          income_minor: 100_000,
          expenses_minor: 12_345,
          net_cash_flow_minor: 87_655,
        },
        spending_groups: [{ label: "Food", amount_minor: 12_345 }],
        recent_transactions: [transaction("recent-1")],
        snapshots: [snapshot()],
      },
      error: null,
    })

    const result = await getDashboardData()

    expect(supabaseMock.rpc).toHaveBeenCalledTimes(1)
    expect(supabaseMock.rpc).toHaveBeenCalledWith("get_dashboard_data")
    expect(result.monthly).toEqual({
      incomeMinor: 100_000,
      expensesMinor: 12_345,
      netCashFlowMinor: 87_655,
    })
    expect(result.spendingGroups).toEqual([{ label: "Food", amountMinor: 12_345 }])
    expect(result.transactions.map(({ id }) => id)).toEqual(["recent-1"])
    expect(result.snapshots).toHaveLength(1)
  })

  it("does not issue a lifetime transactions table query", async () => {
    supabaseMock.rpc.mockResolvedValue({
      data: {
        accounts: [],
        monthly: { income_minor: 0, expenses_minor: 0, net_cash_flow_minor: 0 },
        spending_groups: [],
        recent_transactions: [],
        snapshots: [],
      },
      error: null,
    })

    await getDashboardData()

    expect(supabaseMock.rpc).toHaveBeenCalledWith("get_dashboard_data")
  })

  it("rejects malformed financial totals instead of silently coercing them", async () => {
    supabaseMock.rpc.mockResolvedValue({
      data: {
        accounts: [],
        monthly: { income_minor: 0, expenses_minor: "12345", net_cash_flow_minor: 0 },
        spending_groups: [],
        recent_transactions: [],
        snapshots: [],
      },
      error: null,
    })

    await expect(getDashboardData()).rejects.toBeInstanceOf(UnexpectedRpcResponseError)
  })
})

function transaction(id: string) {
  return {
    id,
    transaction_type: "expense",
    category_id: null,
    description: null,
    transaction_date: "2026-09-04",
    created_at: "2026-09-04T02:00:00Z",
    category: null,
    entries: [],
  }
}

function accountSummary() {
  return {
    id: "bank",
    name: "DBS",
    account_type: "bank",
    institution: "DBS",
    currency_code: "SGD",
    opening_balance_minor: 500_000,
    current_balance_minor: 500_000,
    native_value_minor: null,
    base_value_minor: null,
    valued_at: null,
    included_in_net_worth: true,
    created_at: "2026-09-01T00:00:00Z",
    updated_at: "2026-09-04T00:00:00Z",
    investment_tracking_mode: "simple",
    base_value_available: true,
    broker_cash_minor: null,
    holdings_value_minor: null,
    cost_basis_minor: null,
    unrealized_gain_minor: null,
    realized_gain_minor: null,
    dividends_minor: null,
    missing_price_count: 0,
  }
}

function snapshot() {
  return {
    id: "snapshot",
    user_id: "user-id",
    snapshot_date: "2026-09-04",
    bank_value_base_minor: 500_000,
    cash_value_base_minor: 0,
    investment_value_base_minor: 0,
    total_value_base_minor: 500_000,
    created_at: "2026-09-04T00:00:00Z",
    updated_at: "2026-09-04T00:00:00Z",
  }
}
