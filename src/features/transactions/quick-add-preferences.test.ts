// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from "vitest"

import {
  getQuickExpenseCategories,
  getRememberedExpenseAccountId,
  rememberExpenseAccount,
} from "@/features/transactions/quick-add-preferences"
import type { AccountSummaryRow, Category, FrequentExpenseCategoryRow } from "@/types/database"

const account = (id: string, type: AccountSummaryRow["account_type"] = "bank"): AccountSummaryRow => ({
  id,
  name: id,
  account_type: type,
  institution: null,
  currency_code: "SGD",
  opening_balance_minor: 0,
  current_balance_minor: 0,
  native_value_minor: null,
  base_value_minor: null,
  valued_at: null,
  included_in_net_worth: true,
  created_at: "2026-08-23T00:00:00Z",
  updated_at: "2026-08-23T00:00:00Z",
})

const category = (id: string, overrides: Partial<Category> = {}): Category => ({
  id,
  user_id: "user-a",
  name: id,
  parent_id: null,
  category_type: "expense",
  created_at: "2026-08-23T00:00:00Z",
  archived_at: null,
  ...overrides,
})

beforeEach(() => localStorage.clear())

describe("quick-add preferences", () => {
  it("restores a valid remembered account for the same user", () => {
    rememberExpenseAccount("user-a", "daily")
    expect(getRememberedExpenseAccountId("user-a", [account("daily")])).toBe("daily")
  })

  it("does not share a remembered account with another user", () => {
    rememberExpenseAccount("user-a", "daily")
    expect(getRememberedExpenseAccountId("user-b", [account("daily")])).toBeNull()
  })

  it("ignores unavailable and investment remembered accounts", () => {
    rememberExpenseAccount("user-a", "archived")
    expect(getRememberedExpenseAccountId("user-a", [account("daily")])).toBeNull()

    rememberExpenseAccount("user-a", "portfolio")
    expect(getRememberedExpenseAccountId("user-a", [account("portfolio", "investment")])).toBeNull()
  })

  it("excludes archived and income categories from frequent choices", () => {
    const categories = [
      category("food", { name: "Food" }),
      category("archived", { archived_at: "2026-08-23T00:00:00Z" }),
      category("salary", { category_type: "income" }),
    ]
    const frequent: FrequentExpenseCategoryRow[] = [
      { category_id: "archived", usage_count: 9, last_used_on: "2026-08-23" },
      { category_id: "salary", usage_count: 8, last_used_on: "2026-08-23" },
      { category_id: "food", usage_count: 2, last_used_on: "2026-08-22" },
    ]

    expect(getQuickExpenseCategories(frequent, categories).map((item) => item.id)).toEqual(["food"])
  })
})
