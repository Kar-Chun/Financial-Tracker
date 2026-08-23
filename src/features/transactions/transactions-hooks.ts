import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query"

import {
  getCategories,
  getFrequentExpenseCategories,
  getTransactions,
  saveTransaction,
  softDeleteTransaction,
} from "@/features/transactions/transactions-service"

export const transactionsQueryKey = ["transactions"] as const
export const categoriesQueryKey = ["categories"] as const
export const frequentExpenseCategoriesQueryKey = ["transactions", "frequent-expense-categories"] as const

export function useTransactions() {
  return useQuery({ queryKey: transactionsQueryKey, queryFn: getTransactions })
}

export function useCategories() {
  return useQuery({ queryKey: categoriesQueryKey, queryFn: getCategories, staleTime: 5 * 60_000 })
}

export function useFrequentExpenseCategories() {
  return useQuery({
    queryKey: frequentExpenseCategoriesQueryKey,
    queryFn: getFrequentExpenseCategories,
    staleTime: 5 * 60_000,
  })
}

export async function invalidateTransactionFinanceData(queryClient: QueryClient) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: transactionsQueryKey }),
    queryClient.invalidateQueries({ queryKey: ["accounts"] }),
    queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
    queryClient.invalidateQueries({ queryKey: ["analytics"] }),
    queryClient.invalidateQueries({ queryKey: ["budgets"] }),
    queryClient.invalidateQueries({ queryKey: ["goals"] }),
    queryClient.invalidateQueries({ queryKey: ["investments"] }),
  ])
}

function useInvalidateFinanceData() {
  const queryClient = useQueryClient()
  return () => invalidateTransactionFinanceData(queryClient)
}

export function useSaveTransaction() {
  const invalidate = useInvalidateFinanceData()
  return useMutation({ mutationFn: saveTransaction, onSuccess: invalidate })
}

export function useSoftDeleteTransaction() {
  const invalidate = useInvalidateFinanceData()
  return useMutation({ mutationFn: softDeleteTransaction, onSuccess: invalidate })
}
