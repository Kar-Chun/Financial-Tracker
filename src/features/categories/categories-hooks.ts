import { useMutation, useQueryClient } from "@tanstack/react-query"

import { saveCategory, setCategoryArchived } from "@/features/categories/categories-service"
import { categoriesQueryKey } from "@/features/transactions/transactions-hooks"

function useInvalidateCategoryData() {
  const queryClient = useQueryClient()
  return async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: categoriesQueryKey }),
      queryClient.invalidateQueries({ queryKey: ["transactions"] }),
      queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      queryClient.invalidateQueries({ queryKey: ["analytics"] }),
      queryClient.invalidateQueries({ queryKey: ["budgets"] }),
    ])
  }
}

export function useSaveCategory() {
  const invalidate = useInvalidateCategoryData()
  return useMutation({ mutationFn: saveCategory, onSuccess: invalidate })
}

export function useSetCategoryArchived() {
  const invalidate = useInvalidateCategoryData()
  return useMutation({ mutationFn: setCategoryArchived, onSuccess: invalidate })
}
