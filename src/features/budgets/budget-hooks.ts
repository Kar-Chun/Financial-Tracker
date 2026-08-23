import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { copyPreviousBudget, getMonthlyBudgetSummary, removeCategoryBudget, saveCategoryBudget, saveMonthlyBudget } from "@/features/budgets/budget-service"

export const budgetQueryKey = ["budgets"] as const

export function useBudgetSummary(monthStart: string, enabled = true) {
  return useQuery({
    queryKey: [...budgetQueryKey, monthStart],
    queryFn: () => getMonthlyBudgetSummary(monthStart),
    enabled,
    staleTime: 15_000,
  })
}

function useBudgetMutation<TInput, TResult>(mutationFn: (input: TInput) => Promise<TResult>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: budgetQueryKey }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      ])
    },
  })
}

export const useSaveMonthlyBudget = () => useBudgetMutation(saveMonthlyBudget)
export const useSaveCategoryBudget = () => useBudgetMutation(saveCategoryBudget)
export const useRemoveCategoryBudget = () => useBudgetMutation(removeCategoryBudget)
export const useCopyPreviousBudget = () => useBudgetMutation(copyPreviousBudget)

