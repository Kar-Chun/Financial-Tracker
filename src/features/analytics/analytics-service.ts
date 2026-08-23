import { getSupabaseClient } from "@/lib/supabase"
import type { AnalyticsPeriod } from "@/features/analytics/analytics-periods"
import type { SpendingAnalytics } from "@/features/analytics/analytics-types"

export async function getSpendingAnalytics(range: AnalyticsPeriod) {
  const { data, error } = await getSupabaseClient().rpc("get_spending_analytics", {
    p_start_date: range.startDate,
    p_end_date: range.endDate,
    p_previous_start_date: range.previousStartDate,
    p_previous_end_date: range.previousEndDate,
    p_trend_granularity: range.trendGranularity,
  })

  if (error) throw error
  return data as SpendingAnalytics
}
