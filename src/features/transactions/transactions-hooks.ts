import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import {
  getCategories,
  getTransactions,
  saveTransaction,
  softDeleteTransaction,
} from "@/features/transactions/transactions-service"

export const transactionsQueryKey = ["transactions"] as const
export const categoriesQueryKey = ["categories"] as const

export function useTransactions() {
  return useQuery({ queryKey: transactionsQueryKey, queryFn: getTransactions })
}

export function useCategories() {
  return useQuery({ queryKey: categoriesQueryKey, queryFn: getCategories, staleTime: 5 * 60_000 })
}

function useInvalidateFinanceData() {
  const queryClient = useQueryClient()
  return async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: transactionsQueryKey }),
      queryClient.invalidateQueries({ queryKey: ["accounts"] }),
      queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      queryClient.invalidateQueries({ queryKey: ["analytics"] }),
    ])
  }
}

export function useSaveTransaction() {
  const invalidate = useInvalidateFinanceData()
  return useMutation({ mutationFn: saveTransaction, onSuccess: invalidate })
}

export function useSoftDeleteTransaction() {
  const invalidate = useInvalidateFinanceData()
  return useMutation({ mutationFn: softDeleteTransaction, onSuccess: invalidate })
}
