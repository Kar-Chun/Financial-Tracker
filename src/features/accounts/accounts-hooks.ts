import { type QueryClient, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import {
  archiveAccount,
  deleteAccountPermanently,
  getArchivedAccounts,
  getAccountSummaries,
  restoreAccount,
  saveAccount,
  saveInvestmentValuation,
} from "@/features/accounts/accounts-service"

export const accountsQueryKey = ["accounts", "summaries"] as const
export const archivedAccountsQueryKey = ["accounts", "archived"] as const

export async function invalidateAccountDependentData(queryClient: QueryClient) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: accountsQueryKey }),
    queryClient.invalidateQueries({ queryKey: archivedAccountsQueryKey }),
    queryClient.invalidateQueries({ queryKey: ["investments"] }),
    queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
    queryClient.invalidateQueries({ queryKey: ["transactions"] }),
    queryClient.invalidateQueries({ queryKey: ["analytics"] }),
    queryClient.invalidateQueries({ queryKey: ["budgets"] }),
    queryClient.invalidateQueries({ queryKey: ["goals"] }),
  ])
}

export function useInvalidateAccountDependentData() {
  const queryClient = useQueryClient()
  return () => invalidateAccountDependentData(queryClient)
}

export function useAccounts() {
  return useQuery({
    queryKey: accountsQueryKey,
    queryFn: getAccountSummaries,
  })
}

export function useArchivedAccounts() {
  return useQuery({
    queryKey: archivedAccountsQueryKey,
    queryFn: getArchivedAccounts,
  })
}

export function useSaveAccount() {
  const invalidate = useInvalidateAccountDependentData()
  return useMutation({ mutationFn: saveAccount, onSuccess: invalidate })
}

export function useArchiveAccount() {
  const invalidate = useInvalidateAccountDependentData()
  return useMutation({ mutationFn: archiveAccount, onSuccess: invalidate })
}

export function useRestoreAccount() {
  const invalidate = useInvalidateAccountDependentData()
  return useMutation({ mutationFn: restoreAccount, onSuccess: invalidate })
}

export function useDeleteAccountPermanently() {
  const invalidate = useInvalidateAccountDependentData()
  return useMutation({ mutationFn: deleteAccountPermanently, onSuccess: invalidate })
}

export function useSaveInvestmentValuation() {
  const invalidate = useInvalidateAccountDependentData()
  return useMutation({ mutationFn: saveInvestmentValuation, onSuccess: invalidate })
}
