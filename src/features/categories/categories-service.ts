import type { CategoryType } from "@/features/categories/category-logic"
import { getSupabaseClient } from "@/lib/supabase"

export type SaveCategoryInput = {
  name: string
  categoryType: CategoryType
  parentId: string | null
  categoryId?: string
}

export async function saveCategory(input: SaveCategoryInput) {
  const { data, error } = await getSupabaseClient().rpc("upsert_category", {
    p_name: input.name,
    p_category_type: input.categoryType,
    p_parent_id: input.parentId,
    p_category_id: input.categoryId ?? null,
  })
  if (error) throw error
  return data
}

export async function setCategoryArchived(input: { categoryId: string; archived: boolean }) {
  const { data, error } = await getSupabaseClient().rpc("set_category_archived", {
    p_category_id: input.categoryId,
    p_archived: input.archived,
  })
  if (error) throw error
  return data
}
