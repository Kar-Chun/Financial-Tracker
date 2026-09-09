import { describe, expect, it } from "vitest"

import { buildTransactionPageFilters, getInitialTransactionFilterState } from "@/features/transactions/transaction-filter-state"

describe("transaction URL filter state", () => {
  it("initialises the Dashboard drill-through as one eligible expense day", () => {
    const state = getInitialTransactionFilterState(
      new URLSearchParams("date=2026-09-09&type=expense&eligible=true"),
      "2026-08",
    )

    expect(buildTransactionPageFilters(state)).toEqual({
      startDate: "2026-09-09",
      endDate: "2026-09-09",
      transactionType: "expense",
      accountId: null,
      categoryId: null,
      eligibleSpending: true,
    })
  })

  it("ignores malformed dates instead of enabling an unbounded eligible filter", () => {
    const state = getInitialTransactionFilterState(
      new URLSearchParams("date=not-a-date&type=expense&eligible=true"),
      "2026-09",
    )

    expect(buildTransactionPageFilters(state)).toMatchObject({
      startDate: "2026-09-01",
      endDate: "2026-09-30",
      transactionType: "expense",
      eligibleSpending: false,
    })
  })
})
