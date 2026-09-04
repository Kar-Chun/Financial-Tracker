import type { MonthlyBudgetSummary } from "@/features/budgets/budget-types"
import { performFinancialMutation } from "@/lib/network"
import { parseRpcResponse } from "@/lib/rpc-validation"
import { getSupabaseClient } from "@/lib/supabase"
import { copyBudgetResultSchema, monthlyBudgetSummarySchema } from "@/types/rpc-schemas"

export async function getMonthlyBudgetSummary(monthStart: string) {
  const { data, error } = await getSupabaseClient().rpc("get_monthly_budget_summary", { p_month_start: monthStart })
  if (error) throw error
  return parseRpcResponse(monthlyBudgetSummarySchema, data) satisfies MonthlyBudgetSummary
}

export function saveMonthlyBudget(input: { monthStart: string; amountMinor: number }) {
  return performFinancialMutation(async () => {
    const { data, error } = await getSupabaseClient().rpc("upsert_monthly_budget", {
      p_month_start: input.monthStart,
      p_amount_minor: input.amountMinor,
    })
    if (error) throw error
    return data
  })
}

export function saveCategoryBudget(input: { monthStart: string; categoryId: string; amountMinor: number }) {
  return performFinancialMutation(async () => {
    const { data, error } = await getSupabaseClient().rpc("upsert_category_budget", {
      p_month_start: input.monthStart,
      p_category_id: input.categoryId,
      p_amount_minor: input.amountMinor,
    })
    if (error) throw error
    return data
  })
}

export function removeCategoryBudget(input: { monthStart: string; categoryId: string }) {
  return performFinancialMutation(async () => {
    const { error } = await getSupabaseClient().rpc("remove_category_budget", {
      p_month_start: input.monthStart,
      p_category_id: input.categoryId,
    })
    if (error) throw error
  })
}

export function copyPreviousBudget(input: { sourceMonthStart: string; destinationMonthStart: string }) {
  return performFinancialMutation(async () => {
    const { data, error } = await getSupabaseClient().rpc("copy_monthly_budget", {
      p_source_month_start: input.sourceMonthStart,
      p_destination_month_start: input.destinationMonthStart,
    })
    if (error) throw error
    return parseRpcResponse(copyBudgetResultSchema, data)
  })
}
