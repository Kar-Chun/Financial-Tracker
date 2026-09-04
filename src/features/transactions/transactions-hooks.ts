import { useInfiniteQuery, useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query"

import {
  getCategories,
  getFrequentExpenseCategories,
  getTransactionsPage,
  saveTransaction,
  softDeleteTransaction,
  transactionPageSize,
  type TransactionCursor,
  type TransactionPageFilters,
} from "@/features/transactions/transactions-service"

export const transactionsQueryKey = ["transactions"] as const
export const categoriesQueryKey = ["categories"] as const
export const frequentExpenseCategoriesQueryKey = ["transactions", "frequent-expense-categories"] as const

export function transactionListQueryKey(userId: string | undefined, filters: TransactionPageFilters) {
  return [...transactionsQueryKey, "list", userId ?? "signed-out", filters, transactionPageSize] as const
}

export function useTransactions(filters: TransactionPageFilters, userId: string | undefined) {
  return useInfiniteQuery({
    queryKey: transactionListQueryKey(userId, filters),
    queryFn: ({ pageParam }) => getTransactionsPage({ filters, cursor: pageParam, pageSize: transactionPageSize }),
    initialPageParam: null as TransactionCursor | null,
    getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
    enabled: Boolean(userId),
  })
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
