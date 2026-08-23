import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { getSavingsGoalDetail, getSavingsGoalsSummary, recordGoalAllocation, saveSavingsGoal, setSavingsGoalArchived } from "@/features/goals/goals-service"

export const goalsQueryKey = ["goals"] as const

export function useSavingsGoals(includeArchived = false, enabled = true) {
  return useQuery({
    queryKey: [...goalsQueryKey, "summary", includeArchived],
    queryFn: () => getSavingsGoalsSummary(includeArchived),
    enabled,
    staleTime: 15_000,
  })
}

export function useSavingsGoalDetail(goalId: string | undefined) {
  return useQuery({
    queryKey: [...goalsQueryKey, "detail", goalId],
    queryFn: () => getSavingsGoalDetail(goalId!),
    enabled: Boolean(goalId),
  })
}

function useGoalMutation<TInput, TResult>(mutationFn: (input: TInput) => Promise<TResult>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: goalsQueryKey }),
  })
}

export const useSaveSavingsGoal = () => useGoalMutation(saveSavingsGoal)
export const useSetSavingsGoalArchived = () => useGoalMutation(setSavingsGoalArchived)
export const useRecordGoalAllocation = () => useGoalMutation(recordGoalAllocation)

