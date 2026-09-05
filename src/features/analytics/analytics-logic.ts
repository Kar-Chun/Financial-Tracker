import type { SpendingAnalytics, SpendingCategory } from "@/features/analytics/analytics-types"
import { formatCurrency } from "@/lib/currency"

export type SpendingComparison = {
  percentage: number | null
  direction: "increase" | "decrease" | "same" | "no_prior"
}

export function getSpendingComparison(currentMinor: number, previousMinor: number): SpendingComparison {
  if (previousMinor === 0) return { percentage: null, direction: "no_prior" }
  const difference = currentMinor - previousMinor
  if (difference === 0) return { percentage: 0, direction: "same" }
  return {
    percentage: Math.round((Math.abs(difference) / previousMinor) * 1_000) / 10,
    direction: difference > 0 ? "increase" : "decrease",
  }
}

export function getCategoryPercentage(amountMinor: number, totalMinor: number) {
  if (totalMinor <= 0) return 0
  return Math.round((amountMinor / totalMinor) * 1_000) / 10
}

export function getSpendingInsights(data: SpendingAnalytics, currency: string) {
  if (data.summary.total_spent_minor === 0) return []

  const insights: string[] = []
  const largest = data.categories[0]
  if (largest) {
    insights.push(
      `${largest.name} is your largest spending category at ${getCategoryPercentage(largest.amount_minor, data.summary.total_spent_minor)}% of recorded spending.`,
    )
  }

  const comparison = getSpendingComparison(
    data.summary.total_spent_minor,
    data.previous_summary.total_spent_minor,
  )
  if (comparison.direction === "no_prior") {
    insights.push("There is no prior spending in the comparable period yet.")
  } else if (comparison.direction === "same") {
    insights.push("Total spending is unchanged from the comparable period.")
  } else {
    insights.push(
      `You spent ${comparison.percentage}% ${comparison.direction === "increase" ? "more" : "less"} than the comparable period.`,
    )
  }

  const increase = findLargestCategoryIncrease(data.categories)
  if (increase && data.previous_summary.total_spent_minor > 0) {
    insights.push(
      `${increase.name} spending increased by ${formatCurrency(increase.increaseMinor, currency)} compared with the previous period.`,
    )
  }
  return insights
}

function findLargestCategoryIncrease(categories: SpendingCategory[]) {
  return categories
    .map((category) => ({
      name: category.name,
      increaseMinor: category.amount_minor - category.previous_amount_minor,
    }))
    .filter((category) => category.increaseMinor > 0)
    .sort((left, right) => right.increaseMinor - left.increaseMinor)[0]
}
