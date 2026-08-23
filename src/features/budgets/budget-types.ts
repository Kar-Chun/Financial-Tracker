export type BudgetPeriodStatus = "past" | "current" | "future"
export type BudgetPaceStatus = "no_budget" | "not_started" | "on_track" | "ahead_of_pace" | "within_budget" | "over_budget"

export type CategoryBudgetSummary = {
  id: string
  category_id: string
  category_name: string
  category_archived: boolean
  budget_minor: number
  spent_minor: number
  remaining_minor: number
}

export type MonthlyBudgetSummary = {
  month_start: string
  month_end: string
  period_status: BudgetPeriodStatus
  budget_exists: boolean
  previous_budget_exists: boolean
  budget_id: string | null
  currency_code: string
  currency_mismatch: boolean
  overall_budget_minor: number | null
  spent_minor: number
  remaining_minor: number | null
  over_budget_minor: number | null
  days_in_month: number
  elapsed_days: number
  remaining_days_including_today: number
  safe_daily_spend_minor: number | null
  expected_spend_minor: number | null
  pace_status: BudgetPaceStatus
  category_budgets: CategoryBudgetSummary[]
  excluded_foreign_expense_count: number
}

