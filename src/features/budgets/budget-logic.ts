export function isEligibleParentExpenseCategory(category: {
  user_id: string
  category_type: "expense" | "income"
  parent_id: string | null
  archived_at: string | null
}, currentUserId: string) {
  return category.user_id === currentUserId
    && category.category_type === "expense"
    && category.parent_id === null
    && category.archived_at === null
}

export function getBudgetProgress(spentMinor: number, budgetMinor: number) {
  if (budgetMinor <= 0) return { percentageUsed: 0, visualPercentage: 0 }
  if (!Number.isSafeInteger(spentMinor) || !Number.isSafeInteger(budgetMinor)) {
    throw new Error("Budget progress requires safe integer minor units.")
  }
  const percentageUsed = Number((BigInt(spentMinor) * 1000n + BigInt(budgetMinor) / 2n) / BigInt(budgetMinor)) / 10
  return { percentageUsed, visualPercentage: Math.min(Math.max(percentageUsed, 0), 100) }
}
