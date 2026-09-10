import { useInfiniteQuery, useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query"
import { useEffect, useState } from "react"

import {
  getCategories,
  getFrequentExpenseCategories,
  getTransactionNoteSuggestions,
  getTransactionsPage,
  isNoteSuggestionQueryEligible,
  normalizeNoteSuggestionQuery,
  saveTransaction,
  softDeleteTransaction,
  transactionPageSize,
  type TransactionCursor,
  type NoteSuggestionTransactionType,
  type TransactionPageFilters,
} from "@/features/transactions/transactions-service"
import { isBrowserOnline } from "@/lib/network"

export const transactionsQueryKey = ["transactions"] as const
export const categoriesQueryKey = ["categories"] as const
export const frequentExpenseCategoriesQueryKey = ["transactions", "frequent-expense-categories"] as const
export const transactionNoteSuggestionDelay = 225

export function transactionNoteSuggestionsQueryKey(
  userId: string | undefined,
  transactionType: NoteSuggestionTransactionType | null,
  query: string,
) {
  return [...transactionsQueryKey, "note-suggestions", userId ?? "signed-out", transactionType ?? "unsupported", query] as const
}

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

export function useTransactionNoteSuggestions({
  query,
  transactionType,
  userId,
  enabled = true,
}: {
  query: string
  transactionType: "expense" | "income" | "transfer"
  userId: string | undefined
  enabled?: boolean
}) {
  const normalizedQuery = normalizeNoteSuggestionQuery(query)
  const queryEligible = isNoteSuggestionQueryEligible(normalizedQuery)
  const supportedType = transactionType === "expense" || transactionType === "income" ? transactionType : null
  const [debouncedQuery, setDebouncedQuery] = useState("")

  useEffect(() => {
    const nextQuery = enabled && queryEligible && supportedType ? normalizedQuery : ""
    const delay = nextQuery ? transactionNoteSuggestionDelay : 0
    const timer = window.setTimeout(() => setDebouncedQuery(nextQuery), delay)
    return () => window.clearTimeout(timer)
  }, [enabled, normalizedQuery, queryEligible, supportedType])

  const currentInputIsDebounced = debouncedQuery === normalizedQuery
  const result = useQuery({
    queryKey: transactionNoteSuggestionsQueryKey(userId, supportedType, debouncedQuery),
    queryFn: () => supportedType ? getTransactionNoteSuggestions(debouncedQuery, supportedType) : Promise.resolve([]),
    enabled: enabled
      && Boolean(userId)
      && Boolean(supportedType)
      && isNoteSuggestionQueryEligible(debouncedQuery)
      && currentInputIsDebounced
      && isBrowserOnline(),
    retry: false,
    staleTime: 60_000,
  })

  return {
    ...result,
    data: currentInputIsDebounced ? result.data : undefined,
    isDebouncing: enabled && queryEligible && Boolean(supportedType) && !currentInputIsDebounced,
  }
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
