import { beforeEach, describe, expect, it, vi } from "vitest"

import { getDashboardData } from "@/features/dashboard/dashboard-service"

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
        accounts: [{ id: "bank", name: "DBS", account_type: "bank" }],
        monthly: {
          income_minor: 100_000,
          expenses_minor: 12_345,
          net_cash_flow_minor: 87_655,
        },
        spending_groups: [{ label: "Food", amount_minor: 12_345 }],
        recent_transactions: [transaction("recent-1")],
        snapshots: [{ id: "snapshot", snapshot_date: "2026-09-04", total_value_base_minor: 500_000 }],
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
