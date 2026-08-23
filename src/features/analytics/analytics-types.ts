export type SpendingSummary = {
  total_spent_minor: number
  average_daily_spend_minor: number
  expense_count: number
  largest_category_name: string | null
}

export type SpendingSubcategory = {
  category_id: string
  name: string
  amount_minor: number
}

export type SpendingCategory = {
  category_id: string | null
  name: string
  amount_minor: number
  previous_amount_minor: number
  direct_amount_minor: number
  subcategories: SpendingSubcategory[]
}

export type SpendingAnalytics = {
  period: {
    start_date: string
    end_date: string
    previous_start_date: string
    previous_end_date: string
    trend_granularity: "day" | "month"
  }
  summary: SpendingSummary
  previous_summary: Pick<SpendingSummary, "total_spent_minor" | "expense_count">
  categories: SpendingCategory[]
  trend: Array<{ bucket_date: string; amount_minor: number }>
  excluded_foreign_expense_count: number
}
