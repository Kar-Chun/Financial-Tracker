import type { Category } from "@/types/database"

export type CategoryType = Category["category_type"]

export function getActiveTransactionCategories(categories: Category[], type: CategoryType) {
  return categories.filter((category) => category.category_type === type && category.archived_at === null)
}

export function validateCategoryDraft({
  name,
  type,
  parentId,
  categoryId,
  categories,
  userId,
}: {
  name: string
  type: CategoryType
  parentId: string | null
  categoryId?: string
  categories: Category[]
  userId: string
}) {
  const trimmedName = name.trim()
  if (!trimmedName) throw new Error("Category name is required.")
  if (trimmedName.length > 100) throw new Error("Category name must be at most 100 characters.")

  const existingCategory = categoryId ? categories.find((category) => category.id === categoryId) : undefined
  if (categoryId && (!existingCategory || existingCategory.user_id !== userId)) throw new Error("Category could not be found.")
  if (existingCategory && (existingCategory.category_type !== type || existingCategory.parent_id !== parentId)) {
    throw new Error("Category type and parent cannot be changed.")
  }

  if (parentId) {
    const parent = categories.find((category) => category.id === parentId)
    if (!parent || parent.user_id !== userId) throw new Error("Parent category could not be found.")
    if (parent.parent_id) throw new Error("Categories support only one parent level.")
    if (parent.category_type !== type) throw new Error("A subcategory must have the same type as its parent.")
    if (parent.archived_at) throw new Error("Archived parents cannot receive new subcategories.")
  }

  const duplicate = categories.some((category) =>
    category.id !== categoryId
    && category.user_id === userId
    && category.category_type === type
    && category.parent_id === parentId
    && category.archived_at === null
    && category.name.trim().toLocaleLowerCase() === trimmedName.toLocaleLowerCase(),
  )
  if (duplicate) throw new Error("An active category with this name already exists in this location.")
  return trimmedName
}

export function validateCategoryArchive(category: Category, categories: Category[], userId: string) {
  if (category.user_id !== userId) throw new Error("Category could not be found.")
  if (!category.parent_id && categories.some((child) => child.parent_id === category.id && child.archived_at === null)) {
    throw new Error("Archive its subcategories first.")
  }
}

export function validateCategoryRestore(category: Category, categories: Category[], userId: string) {
  if (category.user_id !== userId) throw new Error("Category could not be found.")
  if (category.parent_id) {
    const parent = categories.find((candidate) => candidate.id === category.parent_id)
    if (!parent || parent.user_id !== userId || parent.archived_at) throw new Error("Restore the parent category first.")
  }
  validateCategoryDraft({
    name: category.name,
    type: category.category_type,
    parentId: category.parent_id,
    categoryId: category.id,
    categories,
    userId,
  })
}
