export type ExpenseFact = {
  transactionType: "expense" | "income" | "transfer" | "adjustment" | "refund"
  amountMinor: number
  deletedAt: string | null
  categoryId: string
  categoryName: string
  parentCategoryId: string | null
  parentCategoryName: string | null
}

export function aggregateExpenseFacts(facts: ExpenseFact[]) {
  const categories = new Map<string, { name: string; amountMinor: number; subcategories: Map<string, number> }>()
  let totalSpentMinor = 0

  for (const fact of facts) {
    if (fact.transactionType !== "expense" || fact.deletedAt !== null) continue
    if (!Number.isSafeInteger(fact.amountMinor)) throw new Error("Expense amounts must be safe integer minor units.")
    totalSpentMinor += fact.amountMinor
    const rootId = fact.parentCategoryId ?? fact.categoryId
    const rootName = fact.parentCategoryName ?? fact.categoryName
    const aggregate = categories.get(rootId) ?? { name: rootName, amountMinor: 0, subcategories: new Map() }
    aggregate.amountMinor += fact.amountMinor
    if (fact.parentCategoryId) {
      aggregate.subcategories.set(
        fact.categoryId,
        (aggregate.subcategories.get(fact.categoryId) ?? 0) + fact.amountMinor,
      )
    }
    categories.set(rootId, aggregate)
  }

  return { totalSpentMinor, categories }
}
