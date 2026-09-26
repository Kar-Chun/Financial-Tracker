import { type QueryClient, useQueryClient } from "@tanstack/react-query"

import { useFinancialMutation } from "@/lib/use-financial-mutation"
import { resetNetWorthHistory } from "@/features/settings/net-worth-history-service"

export async function invalidateNetWorthHistory(queryClient: QueryClient) {
  await queryClient.invalidateQueries({ queryKey: ["dashboard"] })
}

export function useResetNetWorthHistory() {
  const queryClient = useQueryClient()

  return useFinancialMutation({
    mutationFn: resetNetWorthHistory,
    onSuccess: () => invalidateNetWorthHistory(queryClient),
  })
}
