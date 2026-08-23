import type { AccountSummaryRow, Category, FrequentExpenseCategoryRow } from "@/types/database"

type PreferenceStorage = Pick<Storage, "getItem" | "setItem">

const preferredFallbackNames = ["food", "transport", "shopping", "drinks"]

export function rememberExpenseAccount(userId: string, accountId: string, storage: PreferenceStorage | null = getStorage()) {
  storage?.setItem(preferenceKey(userId), accountId)
}

export function getRememberedExpenseAccountId(
  userId: string,
  accounts: AccountSummaryRow[],
  storage: PreferenceStorage | null = getStorage(),
) {
  const rememberedId = storage?.getItem(preferenceKey(userId))
  if (!rememberedId) return null
  const account = accounts.find((candidate) =>
    candidate.id === rememberedId
    && (candidate.account_type === "bank" || candidate.account_type === "cash"),
  )
  if (account) return account.id
  return null
}

export function getQuickExpenseCategories(
  frequent: FrequentExpenseCategoryRow[],
  categories: Category[],
  limit = 4,
) {
  const activeExpenses = categories.filter((category) =>
    category.category_type === "expense" && category.archived_at === null,
  )
  const byId = new Map(activeExpenses.map((category) => [category.id, category]))
  const selected: Category[] = []

  for (const item of frequent) {
    const category = byId.get(item.category_id)
    if (category && !selected.some((candidate) => candidate.id === category.id)) selected.push(category)
    if (selected.length === limit) return selected
  }

  const fallbacks = [...activeExpenses].sort((left, right) => {
    const leftRank = fallbackRank(left.name)
    const rightRank = fallbackRank(right.name)
    return leftRank - rightRank || left.name.localeCompare(right.name)
  })
  for (const category of fallbacks) {
    if (!selected.some((candidate) => candidate.id === category.id)) selected.push(category)
    if (selected.length === limit) break
  }
  return selected
}

function preferenceKey(userId: string) {
  return `finance-tracker:last-expense-account:${userId}`
}

function getStorage() {
  if (typeof window === "undefined") return null
  try {
    return window.localStorage
  } catch {
    return null
  }
}

function fallbackRank(name: string) {
  const index = preferredFallbackNames.indexOf(name.trim().toLocaleLowerCase())
  return index === -1 ? preferredFallbackNames.length : index
}
