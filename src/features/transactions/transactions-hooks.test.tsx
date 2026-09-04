// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act, renderHook, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { transactionListQueryKey, useTransactions } from "@/features/transactions/transactions-hooks"
import type { TransactionPageFilters } from "@/features/transactions/transactions-service"

const serviceMocks = vi.hoisted(() => ({
  getTransactionsPage: vi.fn(),
}))

vi.mock("@/features/transactions/transactions-service", () => ({
  getCategories: vi.fn(),
  getFrequentExpenseCategories: vi.fn(),
  getTransactionsPage: serviceMocks.getTransactionsPage,
  saveTransaction: vi.fn(),
  softDeleteTransaction: vi.fn(),
  transactionPageSize: 40,
}))

const september: TransactionPageFilters = {
  startDate: "2026-09-01",
  endDate: "2026-09-30",
  transactionType: null,
  accountId: null,
  categoryId: null,
}

beforeEach(() => {
  serviceMocks.getTransactionsPage.mockReset()
})

describe("paginated transaction query", () => {
  it("loads the next cursor and restarts from page one when a server filter changes", async () => {
    const cursor = {
      transaction_date: "2026-09-15",
      created_at: "2026-09-15T08:00:00Z",
      id: "cursor-id",
    }
    serviceMocks.getTransactionsPage
      .mockResolvedValueOnce({ items: [], has_more: true, next_cursor: cursor })
      .mockResolvedValueOnce({ items: [], has_more: false, next_cursor: null })
      .mockResolvedValueOnce({ items: [], has_more: false, next_cursor: null })
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )

    const { result, rerender } = renderHook(
      ({ filters }) => useTransactions(filters, "user-a"),
      { initialProps: { filters: september }, wrapper },
    )
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    await act(async () => {
      await result.current.fetchNextPage()
    })
    expect(serviceMocks.getTransactionsPage.mock.calls[1]?.[0]).toEqual({
      filters: september,
      cursor,
      pageSize: 40,
    })

    const expenses = { ...september, transactionType: "expense" as const }
    rerender({ filters: expenses })
    await waitFor(() => expect(serviceMocks.getTransactionsPage).toHaveBeenCalledTimes(3))
    expect(serviceMocks.getTransactionsPage.mock.calls[2]?.[0]).toEqual({
      filters: expenses,
      cursor: null,
      pageSize: 40,
    })
  })

  it("scopes list cache keys to the authenticated user and all filters", () => {
    expect(transactionListQueryKey("user-a", september)).not.toEqual(transactionListQueryKey("user-b", september))
    expect(transactionListQueryKey("user-a", september)).not.toEqual(transactionListQueryKey("user-a", {
      ...september,
      accountId: "account-id",
    }))
  })
})
