// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  flattenTransactionPages,
  getTransactionMonthRange,
  getTransactionsPage,
  saveTransaction,
  transactionPageSize,
  type TransactionPageFilters,
} from "@/features/transactions/transactions-service"

const supabaseMock = vi.hoisted(() => ({ rpc: vi.fn() }))

vi.mock("@/lib/supabase", () => ({
  getSupabaseClient: () => supabaseMock,
}))

beforeEach(() => {
  Object.defineProperty(navigator, "onLine", { configurable: true, value: true })
  supabaseMock.rpc.mockReset()
  supabaseMock.rpc.mockResolvedValue({ data: "transaction-id", error: null })
})

describe("transaction description persistence", () => {
  it("passes a transfer Note through the existing p_description RPC parameter", async () => {
    await saveTransaction({
      transactionType: "transfer",
      amountMinor: 10_000,
      accountId: "bank-account",
      destinationAccountId: "cash-account",
      transactionDate: "2026-08-23",
      description: "Withdraw cash",
    })

    expect(supabaseMock.rpc).toHaveBeenCalledWith("upsert_financial_transaction", expect.objectContaining({
      p_transaction_type: "transfer",
      p_description: "Withdraw cash",
    }))
  })
})

describe("bounded transaction retrieval", () => {
  const filters: TransactionPageFilters = {
    startDate: "2026-09-01",
    endDate: "2026-09-30",
    transactionType: "expense",
    accountId: "account-id",
    categoryId: "category-id",
  }

  it("requests only the fixed first page and sends every active filter to the server", async () => {
    supabaseMock.rpc.mockResolvedValue({ data: page([transaction("first")]), error: null })

    const result = await getTransactionsPage({ filters })

    expect(result.items.map(({ id }) => id)).toEqual(["first"])
    expect(supabaseMock.rpc).toHaveBeenCalledOnce()
    expect(supabaseMock.rpc).toHaveBeenCalledWith("get_transactions_page", {
      p_start_date: "2026-09-01",
      p_end_date: "2026-09-30",
      p_transaction_type: "expense",
      p_account_id: "account-id",
      p_category_id: "category-id",
      p_limit: transactionPageSize,
      p_cursor_transaction_date: null,
      p_cursor_created_at: null,
      p_cursor_id: null,
    })
  })

  it("requests the next page from the complete stable cursor only", async () => {
    supabaseMock.rpc.mockResolvedValue({ data: page([transaction("second")]), error: null })
    const cursor = {
      transaction_date: "2026-09-03",
      created_at: "2026-09-03T08:00:00Z",
      id: "cursor-id",
    }

    await getTransactionsPage({ filters, cursor })

    expect(supabaseMock.rpc).toHaveBeenCalledWith("get_transactions_page", expect.objectContaining({
      p_limit: 40,
      p_cursor_transaction_date: cursor.transaction_date,
      p_cursor_created_at: cursor.created_at,
      p_cursor_id: cursor.id,
    }))
  })

  it("deduplicates appended pages without changing their server order", () => {
    const first = transaction("same")
    const second = transaction("second")

    expect(flattenTransactionPages([
      page([first, second]),
      page([first, transaction("third")]),
    ]).map(({ id }) => id)).toEqual(["same", "second", "third"])
  })

  it("turns the month control into an inclusive server date range", () => {
    expect(getTransactionMonthRange("2026-02")).toEqual({ startDate: "2026-02-01", endDate: "2026-02-28" })
    expect(getTransactionMonthRange("2024-02")).toEqual({ startDate: "2024-02-01", endDate: "2024-02-29" })
    expect(getTransactionMonthRange("")).toEqual({ startDate: null, endDate: null })
  })
})

function page(items: ReturnType<typeof transaction>[]) {
  return { items, has_more: false, next_cursor: null }
}

function transaction(id: string) {
  return {
    id,
    transaction_type: "expense" as const,
    category_id: "category-id",
    description: null,
    transaction_date: "2026-09-04",
    created_at: "2026-09-04T02:00:00Z",
    category: {
      id: "category-id",
      name: "Food",
      parent_id: null,
      category_type: "expense" as const,
    },
    entries: [],
  }
}
