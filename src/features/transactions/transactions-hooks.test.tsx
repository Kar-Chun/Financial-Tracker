// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act, renderHook, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  transactionListQueryKey,
  transactionNoteSuggestionsQueryKey,
  useTransactionNoteSuggestions,
  useTransactions,
} from "@/features/transactions/transactions-hooks"
import type { TransactionPageFilters } from "@/features/transactions/transactions-service"

const serviceMocks = vi.hoisted(() => ({
  getTransactionNoteSuggestions: vi.fn(),
  getTransactionsPage: vi.fn(),
}))

vi.mock("@/features/transactions/transactions-service", () => ({
  getCategories: vi.fn(),
  getFrequentExpenseCategories: vi.fn(),
  getTransactionNoteSuggestions: serviceMocks.getTransactionNoteSuggestions,
  getTransactionsPage: serviceMocks.getTransactionsPage,
  isNoteSuggestionQueryEligible: (query: string) => query.trim().replace(/\s/gu, "").length >= 2,
  normalizeNoteSuggestionQuery: (query: string) => query.trim().replace(/\s+/gu, " "),
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
  eligibleSpending: false,
}

beforeEach(() => {
  Object.defineProperty(navigator, "onLine", { configurable: true, value: true })
  serviceMocks.getTransactionNoteSuggestions.mockReset()
  serviceMocks.getTransactionsPage.mockReset()
})

describe("transaction Note suggestion query", () => {
  it("waits for two characters and debounces the bounded request", async () => {
    serviceMocks.getTransactionNoteSuggestions.mockResolvedValue([])
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
    const { rerender } = renderHook(
      ({ query }) => useTransactionNoteSuggestions({ query, transactionType: "expense", userId: "user-a" }),
      { initialProps: { query: "w" }, wrapper },
    )

    await new Promise((resolve) => setTimeout(resolve, 260))
    expect(serviceMocks.getTransactionNoteSuggestions).not.toHaveBeenCalled()

    rerender({ query: "wa" })
    expect(serviceMocks.getTransactionNoteSuggestions).not.toHaveBeenCalled()
    await waitFor(() => expect(serviceMocks.getTransactionNoteSuggestions).toHaveBeenCalledWith("wa", "expense"))
  })

  it("does not let an older request replace results for newer input", async () => {
    const older = deferred<Array<{ note: string }>>()
    serviceMocks.getTransactionNoteSuggestions.mockImplementation((query: string) => {
      if (query === "wa") return older.promise
      return Promise.resolve([noteSuggestion("Watsons")])
    })
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
    const { result, rerender } = renderHook(
      ({ query }) => useTransactionNoteSuggestions({ query, transactionType: "expense", userId: "user-a" }),
      { initialProps: { query: "wa" }, wrapper },
    )
    await waitFor(() => expect(serviceMocks.getTransactionNoteSuggestions).toHaveBeenCalledWith("wa", "expense"))

    rerender({ query: "wat" })
    expect(result.current.data).toBeUndefined()
    await waitFor(() => expect(serviceMocks.getTransactionNoteSuggestions).toHaveBeenCalledWith("wat", "expense"))
    await waitFor(() => expect(result.current.data?.[0]?.note).toBe("Watsons"))

    await act(async () => older.resolve([noteSuggestion("Watermelon Juice")]))
    expect(result.current.data?.[0]?.note).toBe("Watsons")
  })

  it("does not search for transfers and scopes cache keys by user and transaction type", async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
    renderHook(
      () => useTransactionNoteSuggestions({ query: "wa", transactionType: "transfer", userId: "user-a" }),
      { wrapper },
    )
    await new Promise((resolve) => setTimeout(resolve, 260))
    expect(serviceMocks.getTransactionNoteSuggestions).not.toHaveBeenCalled()
    expect(transactionNoteSuggestionsQueryKey("user-a", "expense", "wa"))
      .not.toEqual(transactionNoteSuggestionsQueryKey("user-b", "expense", "wa"))
    expect(transactionNoteSuggestionsQueryKey("user-a", "expense", "wa"))
      .not.toEqual(transactionNoteSuggestionsQueryKey("user-a", "income", "wa"))
  })

  it("fails quietly when suggestions are unavailable and skips requests offline", async () => {
    serviceMocks.getTransactionNoteSuggestions.mockRejectedValue(new Error("Network unavailable"))
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
    const { result, unmount } = renderHook(
      () => useTransactionNoteSuggestions({ query: "wa", transactionType: "expense", userId: "user-a" }),
      { wrapper },
    )
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.data).toBeUndefined()
    unmount()

    serviceMocks.getTransactionNoteSuggestions.mockReset()
    Object.defineProperty(navigator, "onLine", { configurable: true, value: false })
    renderHook(
      () => useTransactionNoteSuggestions({ query: "wa", transactionType: "expense", userId: "user-a" }),
      { wrapper },
    )
    await new Promise((resolve) => setTimeout(resolve, 260))
    expect(serviceMocks.getTransactionNoteSuggestions).not.toHaveBeenCalled()
  })
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
    expect(transactionListQueryKey("user-a", september)).not.toEqual(transactionListQueryKey("user-a", {
      ...september,
      eligibleSpending: true,
    }))
  })
})

function noteSuggestion(note: string) {
  return {
    note,
    category_id: null,
    category_name: null,
    category_label: null,
    usage_count: 1,
    last_used_on: "2026-09-10",
    last_used_at: "2026-09-10T08:00:00Z",
  }
}

function deferred<T>() {
  let resolvePromise!: (value: T) => void
  const promise = new Promise<T>((resolve) => { resolvePromise = resolve })
  return { promise, resolve: resolvePromise }
}
