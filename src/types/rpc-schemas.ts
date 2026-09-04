import { z } from "zod"

export const accountTypeSchema = z.enum(["bank", "cash", "investment"])
export const transactionTypeSchema = z.enum(["expense", "income", "transfer", "refund", "adjustment"])
export const categoryTypeSchema = z.enum(["expense", "income"])

export const categorySchema = z.object({
  id: z.string(),
  user_id: z.string(),
  name: z.string(),
  parent_id: z.string().nullable(),
  category_type: categoryTypeSchema,
  created_at: z.string(),
  archived_at: z.string().nullable(),
})

export const frequentExpenseCategorySchema = z.object({
  category_id: z.string(),
  usage_count: z.number().int(),
  last_used_on: z.string(),
})

export const accountSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  account_type: accountTypeSchema,
  institution: z.string().nullable(),
  currency_code: z.string(),
  opening_balance_minor: z.number().int(),
  current_balance_minor: z.number().int().nullable(),
  native_value_minor: z.number().int().nullable(),
  base_value_minor: z.number().int().nullable(),
  valued_at: z.string().nullable(),
  included_in_net_worth: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
  investment_tracking_mode: z.enum(["simple", "detailed"]).optional(),
  base_value_available: z.boolean().optional(),
  broker_cash_minor: z.number().int().nullable().optional(),
  holdings_value_minor: z.number().int().nullable().optional(),
  cost_basis_minor: z.number().int().nullable().optional(),
  unrealized_gain_minor: z.number().int().nullable().optional(),
  realized_gain_minor: z.number().int().nullable().optional(),
  dividends_minor: z.number().int().nullable().optional(),
  missing_price_count: z.number().int().optional(),
})

const embeddedCategorySchema = categorySchema.pick({
  id: true,
  name: true,
  parent_id: true,
  category_type: true,
})

const embeddedAccountSchema = z.object({
  id: z.string(),
  name: z.string(),
  currency_code: z.string(),
  account_type: accountTypeSchema,
})

export const transactionRecordSchema = z.object({
  id: z.string(),
  transaction_type: transactionTypeSchema,
  category_id: z.string().nullable(),
  description: z.string().nullable(),
  transaction_date: z.string(),
  created_at: z.string(),
  category: embeddedCategorySchema.nullable(),
  entries: z.array(z.object({
    id: z.string(),
    account_id: z.string(),
    amount_minor: z.number().int(),
    account: embeddedAccountSchema.nullable(),
  })),
})

export const transactionPageSchema = z.object({
  items: z.array(transactionRecordSchema),
  has_more: z.boolean(),
  next_cursor: z.object({
    transaction_date: z.string(),
    created_at: z.string(),
    id: z.string(),
  }).nullable(),
})

export const netWorthSnapshotSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  snapshot_date: z.string(),
  bank_value_base_minor: z.number().int(),
  cash_value_base_minor: z.number().int(),
  investment_value_base_minor: z.number().int(),
  total_value_base_minor: z.number().int(),
  created_at: z.string(),
  updated_at: z.string(),
})

export const dashboardRpcSchema = z.object({
  accounts: z.array(accountSummarySchema),
  monthly: z.object({
    income_minor: z.number().int(),
    expenses_minor: z.number().int(),
    net_cash_flow_minor: z.number().int(),
  }),
  spending_groups: z.array(z.object({
    label: z.string(),
    amount_minor: z.number().int(),
  })),
  recent_transactions: z.array(transactionRecordSchema),
  snapshots: z.array(netWorthSnapshotSchema),
})

const spendingSummarySchema = z.object({
  total_spent_minor: z.number().int(),
  average_daily_spend_minor: z.number().int(),
  expense_count: z.number().int(),
  largest_category_name: z.string().nullable(),
})

export const spendingAnalyticsSchema = z.object({
  period: z.object({
    start_date: z.string(),
    end_date: z.string(),
    previous_start_date: z.string(),
    previous_end_date: z.string(),
    trend_granularity: z.enum(["day", "month"]),
  }),
  summary: spendingSummarySchema,
  previous_summary: spendingSummarySchema.pick({
    total_spent_minor: true,
    expense_count: true,
  }),
  categories: z.array(z.object({
    category_id: z.string().nullable(),
    name: z.string(),
    amount_minor: z.number().int(),
    previous_amount_minor: z.number().int(),
    direct_amount_minor: z.number().int(),
    subcategories: z.array(z.object({
      category_id: z.string(),
      name: z.string(),
      amount_minor: z.number().int(),
    })),
  })),
  trend: z.array(z.object({
    bucket_date: z.string(),
    amount_minor: z.number().int(),
  })),
  excluded_foreign_expense_count: z.number().int(),
})

export const monthlyBudgetSummarySchema = z.object({
  month_start: z.string(),
  month_end: z.string(),
  period_status: z.enum(["past", "current", "future"]),
  budget_exists: z.boolean(),
  previous_budget_exists: z.boolean(),
  budget_id: z.string().nullable(),
  currency_code: z.string(),
  currency_mismatch: z.boolean(),
  overall_budget_minor: z.number().int().nullable(),
  spent_minor: z.number().int(),
  remaining_minor: z.number().int().nullable(),
  over_budget_minor: z.number().int().nullable(),
  days_in_month: z.number().int(),
  elapsed_days: z.number().int(),
  remaining_days_including_today: z.number().int(),
  safe_daily_spend_minor: z.number().int().nullable(),
  expected_spend_minor: z.number().int().nullable(),
  pace_status: z.enum(["no_budget", "not_started", "on_track", "ahead_of_pace", "within_budget", "over_budget"]),
  category_budgets: z.array(z.object({
    id: z.string(),
    category_id: z.string(),
    category_name: z.string(),
    category_archived: z.boolean(),
    budget_minor: z.number().int(),
    spent_minor: z.number().int(),
    remaining_minor: z.number().int(),
  })),
  excluded_foreign_expense_count: z.number().int(),
})

export const copyBudgetResultSchema = z.object({
  monthly_budget_id: z.string(),
  copied_category_count: z.number().int(),
  skipped_category_count: z.number().int(),
})

const savingsGoalSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  target_amount_minor: z.number().int(),
  currency_code: z.string(),
  target_date: z.string().nullable(),
  note: z.string().nullable(),
  archived_at: z.string().nullable(),
  allocated_minor: z.number().int(),
  remaining_minor: z.number().int(),
  reached: z.boolean(),
  target_date_passed: z.boolean(),
  months_remaining: z.number().int().nullable(),
  required_monthly_minor: z.number().int().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
})

export const savingsGoalsSummarySchema = z.object({
  currency_code: z.string(),
  available_cash_minor: z.number().int(),
  total_allocated_minor: z.number().int(),
  unallocated_cash_minor: z.number().int(),
  foreign_liquid_account_count: z.number().int(),
  goals: z.array(savingsGoalSummarySchema),
})

export const savingsGoalDetailSchema = savingsGoalSummarySchema.omit({
  target_date_passed: true,
  months_remaining: true,
  required_monthly_minor: true,
}).extend({
  allocations: z.array(z.object({
    id: z.string(),
    amount_minor: z.number().int(),
    allocation_date: z.string(),
    note: z.string().nullable(),
    created_at: z.string(),
  })),
})

export const investmentPortfolioSummarySchema = z.object({
  currency_code: z.string(),
  portfolio_value_base_minor: z.number().int(),
  unrealized_gain_base_minor: z.number().int(),
  excluded_account_count: z.number().int(),
  accounts: z.array(accountSummarySchema),
})

const detailedHoldingSchema = z.object({
  id: z.string(),
  symbol: z.string(),
  name: z.string(),
  asset_type: z.enum(["stock", "etf", "fund", "other"]),
  currency_code: z.string(),
  archived_at: z.string().nullable(),
  quantity: z.number(),
  cost_basis_minor: z.number().int(),
  average_cost_minor: z.number().int().nullable(),
  latest_price: z.number().nullable(),
  latest_price_date: z.string().nullable(),
  market_value_minor: z.number().int().nullable(),
  unrealized_gain_minor: z.number().int().nullable(),
})

export const detailedInvestmentAccountSchema = z.object({
  account: z.object({
    id: z.string(),
    name: z.string(),
    institution: z.string().nullable(),
    currency_code: z.string(),
    investment_tracking_mode: z.literal("detailed"),
    detailed_started_on: z.string(),
    archived_at: z.string().nullable(),
  }),
  value: z.object({
    native_value_minor: z.number().int().nullable(),
    base_value_minor: z.number().int().nullable(),
    base_value_available: z.boolean(),
    broker_cash_minor: z.number().int(),
    holdings_value_minor: z.number().int(),
    cost_basis_minor: z.number().int(),
    unrealized_gain_minor: z.number().int().nullable(),
    realized_gain_minor: z.number().int(),
    dividends_minor: z.number().int(),
    missing_price_count: z.number().int(),
    fx_rate: z.number().nullable(),
    fx_rate_date: z.string().nullable(),
    latest_price_date: z.string().nullable(),
  }),
  holdings: z.array(detailedHoldingSchema),
  trades: z.array(z.object({
    id: z.string(),
    holding_id: z.string(),
    trade_type: z.enum(["opening_position", "buy", "sell"]),
    quantity: z.number(),
    unit_price: z.number(),
    fee_minor: z.number().int(),
    cash_effect_minor: z.number().int(),
    cost_basis_effect_minor: z.number().int(),
    realized_gain_minor: z.number().int(),
    trade_date: z.string(),
    note: z.string().nullable(),
    created_at: z.string(),
  })),
  cash_events: z.array(z.object({
    id: z.string(),
    holding_id: z.string().nullable(),
    event_type: z.enum(["opening_cash", "dividend", "cash_adjustment"]),
    amount_minor: z.number().int(),
    event_date: z.string(),
    note: z.string().nullable(),
    created_at: z.string(),
  })),
  prices: z.array(z.object({
    id: z.string(),
    holding_id: z.string(),
    price: z.number(),
    priced_at: z.string(),
    created_at: z.string(),
  })),
})

export const detailedConversionPreviewSchema = z.object({
  simple_native_value_minor: z.number().int(),
  detailed_native_value_minor: z.number().int(),
  difference_minor: z.number().int(),
  currency_code: z.string(),
})

export const archivedAccountSchema = z.object({
  id: z.string(),
  name: z.string(),
  account_type: accountTypeSchema,
  institution: z.string().nullable(),
  currency_code: z.string(),
  opening_balance_minor: z.number().int(),
  archived_at: z.string(),
  investment_tracking_mode: z.enum(["simple", "detailed"]),
  detailed_started_on: z.string().nullable(),
})

export const accountDeletionResultSchema = z.object({
  account_id: z.string(),
  soft_deleted_transactions_purged: z.number().int(),
  investment_valuations_deleted: z.number().int(),
  investment_holdings_deleted: z.number().int(),
  investment_trades_deleted: z.number().int(),
  investment_prices_deleted: z.number().int(),
  investment_cash_events_deleted: z.number().int(),
})
