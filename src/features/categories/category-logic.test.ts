import { describe, expect, it } from "vitest"

import {
  getActiveTransactionCategories,
  validateCategoryArchive,
  validateCategoryDraft,
  validateCategoryRestore,
} from "@/features/categories/category-logic"
import { getCategoryDisplayName } from "@/features/transactions/transaction-logic"
import type { Category } from "@/types/database"

const userId = "user-a"
const category = (overrides: Partial<Category> = {}): Category => ({
  id: "food",
  user_id: userId,
  name: "Food",
  parent_id: null,
  category_type: "expense",
  created_at: "2026-08-23T00:00:00Z",
  archived_at: null,
  ...overrides,
})

describe("category rules", () => {
  it("creates trimmed parent and child category drafts", () => {
    const categories = [category()]
    expect(validateCategoryDraft({ name: "  Travel  ", type: "expense", parentId: null, categories, userId })).toBe("Travel")
    expect(validateCategoryDraft({ name: "Eating Out", type: "expense", parentId: "food", categories, userId })).toBe("Eating Out")
  })

  it("rejects grandchildren, mixed types, and cross-user parents", () => {
    const child = category({ id: "eating-out", name: "Eating Out", parent_id: "food" })
    expect(() => validateCategoryDraft({ name: "Cafe", type: "expense", parentId: child.id, categories: [category(), child], userId })).toThrow("one parent level")
    expect(() => validateCategoryDraft({ name: "Salary", type: "income", parentId: "food", categories: [category()], userId })).toThrow("same type")
    expect(() => validateCategoryDraft({ name: "Cafe", type: "expense", parentId: "other-user", categories: [category({ id: "other-user", user_id: "user-b" })], userId })).toThrow("could not be found")
  })

  it("rejects case-insensitive active duplicates in the same scope", () => {
    expect(() => validateCategoryDraft({ name: " FOOD ", type: "expense", parentId: null, categories: [category()], userId })).toThrow("already exists")
  })

  it("allows a rename without changing type or parent", () => {
    expect(validateCategoryDraft({ name: "Dining", type: "expense", parentId: null, categoryId: "food", categories: [category()], userId })).toBe("Dining")
  })

  it("prevents archiving a parent with active children", () => {
    const categories = [category(), category({ id: "eating-out", parent_id: "food" })]
    expect(() => validateCategoryArchive(categories[0], categories, userId)).toThrow("Archive its subcategories first")
    expect(() => validateCategoryArchive(categories[1], categories, userId)).not.toThrow()
  })

  it("excludes archived categories from new choices but keeps their historical label", () => {
    const archivedChild = category({ id: "eating-out", name: "Eating Out", parent_id: "food", archived_at: "2026-08-23T00:00:00Z" })
    const categories = [category(), archivedChild]
    expect(getActiveTransactionCategories(categories, "expense").map((item) => item.id)).toEqual(["food"])
    expect(getCategoryDisplayName(archivedChild, categories)).toBe("Food › Eating Out")
  })

  it("restores a child only when its parent is active and no duplicate exists", () => {
    const archivedParent = category({ archived_at: "2026-08-23T00:00:00Z" })
    const archivedChild = category({ id: "eating-out", parent_id: "food", archived_at: "2026-08-23T00:00:00Z" })
    expect(() => validateCategoryRestore(archivedChild, [archivedParent, archivedChild], userId)).toThrow("Restore the parent")

    const activeParent = category()
    expect(() => validateCategoryRestore(archivedChild, [activeParent, archivedChild], userId)).not.toThrow()
  })

  it("rejects cross-user archive operations", () => {
    expect(() => validateCategoryArchive(category({ user_id: "user-b" }), [], userId)).toThrow("could not be found")
  })
})
