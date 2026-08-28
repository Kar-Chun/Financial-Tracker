import { type QueryClient, useMutation, useQueryClient } from "@tanstack/react-query"

import { resetNetWorthHistory } from "@/features/settings/net-worth-history-service"

export async function invalidateNetWorthHistory(queryClient: QueryClient) {
  await queryClient.invalidateQueries({ queryKey: ["dashboard"] })
}

export function useResetNetWorthHistory() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: resetNetWorthHistory,
    onSuccess: () => invalidateNetWorthHistory(queryClient),
  })
}
