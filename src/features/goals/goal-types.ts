export type GoalAllocation = {
  id: string
  amount_minor: number
  allocation_date: string
  note: string | null
  created_at: string
}

export type SavingsGoalSummary = {
  id: string
  name: string
  target_amount_minor: number
  currency_code: string
  target_date: string | null
  note: string | null
  archived_at: string | null
  allocated_minor: number
  remaining_minor: number
  reached: boolean
  target_date_passed: boolean
  months_remaining: number | null
  required_monthly_minor: number | null
  created_at: string
  updated_at: string
}

export type SavingsGoalsSummary = {
  currency_code: string
  available_cash_minor: number
  total_allocated_minor: number
  unallocated_cash_minor: number
  foreign_liquid_account_count: number
  goals: SavingsGoalSummary[]
}

export type SavingsGoalDetail = Omit<SavingsGoalSummary, "target_date_passed" | "months_remaining" | "required_monthly_minor"> & {
  allocations: GoalAllocation[]
}

