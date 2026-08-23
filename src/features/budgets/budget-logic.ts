export type BudgetExpenseFact = {
  amountMinor: number
  transactionType: "expense" | "income" | "transfer" | "refund" | "adjustment"
  deleted: boolean
  accountCurrency: string
  baseCurrency: string
  parentCategoryId: string | null
}

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

export function sumEligibleBudgetSpending(facts: BudgetExpenseFact[]) {
  return facts.reduce((total, fact) => (
    fact.transactionType === "expense"
    && !fact.deleted
    && fact.accountCurrency === fact.baseCurrency
      ? total + fact.amountMinor
      : total
  ), 0)
}

export function sumParentCategorySpending(facts: BudgetExpenseFact[], parentCategoryId: string) {
  return sumEligibleBudgetSpending(facts.filter((fact) => fact.parentCategoryId === parentCategoryId))
}

export function getBudgetProgress(spentMinor: number, budgetMinor: number) {
  if (budgetMinor <= 0) return { percentageUsed: 0, visualPercentage: 0 }
  if (!Number.isSafeInteger(spentMinor) || !Number.isSafeInteger(budgetMinor)) {
    throw new Error("Budget progress requires safe integer minor units.")
  }
  const percentageUsed = Number((BigInt(spentMinor) * 1000n + BigInt(budgetMinor) / 2n) / BigInt(budgetMinor)) / 10
  return { percentageUsed, visualPercentage: Math.min(Math.max(percentageUsed, 0), 100) }
}

export function getRemainingBudget(budgetMinor: number, spentMinor: number) {
  return {
    remainingMinor: budgetMinor - spentMinor,
    overBudgetMinor: Math.max(spentMinor - budgetMinor, 0),
  }
}

export function divideMinorUnitsRounded(amountMinor: number, divisor: number) {
  if (!Number.isSafeInteger(amountMinor) || !Number.isSafeInteger(divisor) || divisor <= 0) {
    throw new Error("Budget division requires safe integer values.")
  }
  const amount = BigInt(Math.max(amountMinor, 0))
  const denominator = BigInt(divisor)
  return Number((amount + denominator / 2n) / denominator)
}

function multiplyAndDivideMinorUnitsRounded(amountMinor: number, multiplier: number, divisor: number) {
  if (!Number.isSafeInteger(amountMinor) || !Number.isSafeInteger(multiplier) || !Number.isSafeInteger(divisor) || divisor <= 0) {
    throw new Error("Budget pace requires safe integer values.")
  }
  const denominator = BigInt(divisor)
  return Number((BigInt(amountMinor) * BigInt(multiplier) + denominator / 2n) / denominator)
}

export function getSafeDailySpend(remainingMinor: number, remainingDaysIncludingToday: number, isCurrentMonth: boolean) {
  if (!isCurrentMonth) return null
  return divideMinorUnitsRounded(Math.max(remainingMinor, 0), remainingDaysIncludingToday)
}

export function getPaceStatus(input: {
  budgetMinor: number
  spentMinor: number
  elapsedDays: number
  daysInMonth: number
  period: "past" | "current" | "future"
}) {
  if (input.period === "future") return { status: "not_started" as const, expectedMinor: null }
  if (input.period === "past") {
    return { status: input.spentMinor > input.budgetMinor ? "over_budget" as const : "within_budget" as const, expectedMinor: null }
  }
  const expectedMinor = multiplyAndDivideMinorUnitsRounded(input.budgetMinor, input.elapsedDays, input.daysInMonth)
  if (input.spentMinor > input.budgetMinor) return { status: "over_budget" as const, expectedMinor }
  if (input.spentMinor <= expectedMinor) return { status: "on_track" as const, expectedMinor }
  return { status: "ahead_of_pace" as const, expectedMinor }
}
