// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest"

import { recordGoalAllocation, saveSavingsGoal } from "@/features/goals/goals-service"
import { OfflineFinancialMutationError } from "@/lib/network"

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
})
