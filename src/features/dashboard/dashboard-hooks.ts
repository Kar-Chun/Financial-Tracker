import { useQuery } from "@tanstack/react-query"

import { getDashboardData } from "@/features/dashboard/dashboard-service"

export function useDashboard() {
  return useQuery({
    queryKey: ["dashboard"],
    queryFn: getDashboardData,
    staleTime: 15_000,
  })
}
