import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import {
  archiveAccount,
  getAccountSummaries,
  saveAccount,
  saveInvestmentValuation,
} from "@/features/accounts/accounts-service"

export const accountsQueryKey = ["accounts", "summaries"] as const

function useInvalidateFinanceData() {
  const queryClient = useQueryClient()
  return async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: accountsQueryKey }),
      queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      queryClient.invalidateQueries({ queryKey: ["transactions"] }),
      queryClient.invalidateQueries({ queryKey: ["analytics"] }),
      queryClient.invalidateQueries({ queryKey: ["budgets"] }),
    ])
  }
}

export function useAccounts() {
  return useQuery({
    queryKey: accountsQueryKey,
    queryFn: getAccountSummaries,
  })
}

export function useSaveAccount() {
  const invalidate = useInvalidateFinanceData()
  return useMutation({ mutationFn: saveAccount, onSuccess: invalidate })
}

export function useArchiveAccount() {
  const invalidate = useInvalidateFinanceData()
  return useMutation({ mutationFn: archiveAccount, onSuccess: invalidate })
}

export function useSaveInvestmentValuation() {
  const invalidate = useInvalidateFinanceData()
  return useMutation({ mutationFn: saveInvestmentValuation, onSuccess: invalidate })
}
