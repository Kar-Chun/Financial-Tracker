import { useQuery } from "@tanstack/react-query"

import { getSpendingAnalytics } from "@/features/analytics/analytics-service"
import type { AnalyticsPeriod, AnalyticsPeriodPreset } from "@/features/analytics/analytics-periods"

export const analyticsQueryKey = ["analytics"] as const

export function useSpendingAnalytics(preset: AnalyticsPeriodPreset, range: AnalyticsPeriod | null) {
  return useQuery({
    queryKey: [...analyticsQueryKey, preset, range],
    queryFn: () => getSpendingAnalytics(range!),
    enabled: Boolean(range),
  })
}
