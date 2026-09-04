import type { SavingsGoalDetail, SavingsGoalsSummary } from "@/features/goals/goal-types"
import { performFinancialMutation } from "@/lib/network"
import { parseRpcResponse } from "@/lib/rpc-validation"
import { getSupabaseClient } from "@/lib/supabase"
import { savingsGoalDetailSchema, savingsGoalsSummarySchema } from "@/types/rpc-schemas"

export type SaveGoalInput = {
  id?: string
  name: string
  targetAmountMinor: number
  targetDate: string | null
  note: string
}

export async function getSavingsGoalsSummary(includeArchived = false) {
  const { data, error } = await getSupabaseClient().rpc("get_savings_goals_summary", { p_include_archived: includeArchived })
  if (error) throw error
  return parseRpcResponse(savingsGoalsSummarySchema, data) satisfies SavingsGoalsSummary
}

export async function getSavingsGoalDetail(goalId: string) {
  const { data, error } = await getSupabaseClient().rpc("get_savings_goal_detail", { p_goal_id: goalId })
  if (error) throw error
  return parseRpcResponse(savingsGoalDetailSchema, data) satisfies SavingsGoalDetail
}

export function saveSavingsGoal(input: SaveGoalInput) {
  return performFinancialMutation(async () => {
    const { data, error } = await getSupabaseClient().rpc("upsert_savings_goal", {
      p_goal_id: input.id ?? null,
      p_name: input.name,
      p_target_amount_minor: input.targetAmountMinor,
      p_target_date: input.targetDate,
      p_note: input.note || null,
    })
    if (error) throw error
    return data
  })
}

export function setSavingsGoalArchived(input: { goalId: string; archived: boolean }) {
  return performFinancialMutation(async () => {
    const { data, error } = await getSupabaseClient().rpc("set_savings_goal_archived", {
      p_goal_id: input.goalId,
      p_archived: input.archived,
    })
    if (error) throw error
    return data
  })
}

export function recordGoalAllocation(input: {
  goalId: string
  operation: "allocate" | "reduce"
  amountMinor: number
  allocationDate: string
  note: string
}) {
  return performFinancialMutation(async () => {
    const { data, error } = await getSupabaseClient().rpc("record_goal_allocation", {
      p_goal_id: input.goalId,
      p_operation: input.operation,
      p_amount_minor: input.amountMinor,
      p_allocation_date: input.allocationDate,
      p_note: input.note || null,
    })
    if (error) throw error
    return data
  })
}
