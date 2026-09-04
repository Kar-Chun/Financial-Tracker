// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  getSavingsGoalDetail,
  getSavingsGoalsSummary,
  recordGoalAllocation,
  saveSavingsGoal,
} from "@/features/goals/goals-service"
import { OfflineFinancialMutationError } from "@/lib/network"
import { UnexpectedRpcResponseError } from "@/lib/rpc-validation"

const supabaseMock = vi.hoisted(() => ({ rpc: vi.fn() }))

vi.mock("@/lib/supabase", () => ({ getSupabaseClient: () => supabaseMock }))

beforeEach(() => {
  Object.defineProperty(navigator, "onLine", { configurable: true, value: true })
  supabaseMock.rpc.mockReset()
  supabaseMock.rpc.mockResolvedValue({ data: "goal-id", error: null })
})

describe("savings goal services", () => {
  it("does not send ownership or currency when creating a goal", async () => {
    await saveSavingsGoal({ name: "Japan Trip", targetAmountMinor: 300_000, targetDate: null, note: "Travel" })
    expect(supabaseMock.rpc).toHaveBeenCalledWith("upsert_savings_goal", {
      p_goal_id: null,
      p_name: "Japan Trip",
      p_target_amount_minor: 300_000,
      p_target_date: null,
      p_note: "Travel",
    })
    expect(supabaseMock.rpc.mock.calls[0][1]).not.toHaveProperty("user_id")
    expect(supabaseMock.rpc.mock.calls[0][1]).not.toHaveProperty("currency_code")
  })

  it("sends a positive amount plus an explicit reduction operation", async () => {
    await recordGoalAllocation({ goalId: "goal", operation: "reduce", amountMinor: 5_000, allocationDate: "2026-08-24", note: "Replanned" })
    expect(supabaseMock.rpc).toHaveBeenCalledWith("record_goal_allocation", expect.objectContaining({ p_operation: "reduce", p_amount_minor: 5_000 }))
  })

  it("blocks goal mutations offline without calling Supabase", async () => {
    Object.defineProperty(navigator, "onLine", { configurable: true, value: false })
    await expect(saveSavingsGoal({ name: "Laptop", targetAmountMinor: 100_000, targetDate: null, note: "" })).rejects.toBeInstanceOf(OfflineFinancialMutationError)
    expect(supabaseMock.rpc).not.toHaveBeenCalled()
  })

  it("validates summary and detail responses including nullable dates and notes", async () => {
    supabaseMock.rpc
      .mockResolvedValueOnce({
        data: {
          currency_code: "SGD",
          available_cash_minor: 500_000,
          total_allocated_minor: 80_000,
          unallocated_cash_minor: 420_000,
          foreign_liquid_account_count: 0,
          goals: [goalSummary()],
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          ...goalSummary(),
          allocations: [{
            id: "allocation-id",
            amount_minor: 80_000,
            allocation_date: "2026-09-04",
            note: null,
            created_at: "2026-09-04T00:00:00Z",
          }],
        },
        error: null,
      })

    const summary = await getSavingsGoalsSummary()
    const detail = await getSavingsGoalDetail("goal-id")

    expect(summary.goals[0]?.target_date).toBeNull()
    expect(detail.allocations[0]?.note).toBeNull()
  })

  it("rejects malformed goal totals", async () => {
    supabaseMock.rpc.mockResolvedValue({ data: { total_allocated_minor: "80000" }, error: null })

    await expect(getSavingsGoalsSummary()).rejects.toBeInstanceOf(UnexpectedRpcResponseError)
  })
})

function goalSummary() {
  return {
    id: "goal-id",
    name: "Japan",
    target_amount_minor: 300_000,
    currency_code: "SGD",
    target_date: null,
    note: null,
    archived_at: null,
    allocated_minor: 80_000,
    remaining_minor: 220_000,
    reached: false,
    target_date_passed: false,
    months_remaining: null,
    required_monthly_minor: null,
    created_at: "2026-09-01T00:00:00Z",
    updated_at: "2026-09-04T00:00:00Z",
  }
}
