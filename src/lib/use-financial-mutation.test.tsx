// @vitest-environment jsdom

import { act, cleanup, renderHook } from "@testing-library/react"
import { onlineManager, QueryClientProvider } from "@tanstack/react-query"
import type { ReactNode } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { createAppQueryClient } from "@/app/query-client"
import { useArchiveAccount, useDeleteAccountPermanently, useReconcileAccount, useRestoreAccount, useSaveAccount, useSaveInvestmentValuation } from "@/features/accounts/accounts-hooks"
import { useCopyPreviousBudget, useRemoveCategoryBudget, useSaveCategoryBudget, useSaveMonthlyBudget } from "@/features/budgets/budget-hooks"
import { useSaveCategory, useSetCategoryArchived } from "@/features/categories/categories-hooks"
import { useRecordGoalAllocation, useSaveSavingsGoal, useSetSavingsGoalArchived } from "@/features/goals/goals-hooks"
import { useEnableDetailedTracking, useRecordCashEvent, useRecordTrade, useSaveHolding, useSaveManualFx, useUpdatePrices } from "@/features/investments/investments-hooks"
import { useResetNetWorthHistory } from "@/features/settings/net-worth-history-hooks"
import { useSaveTransaction, useSoftDeleteTransaction } from "@/features/transactions/transactions-hooks"
import { offlineFinancialMutationMessage } from "@/lib/network"

const { rpc, getClient } = vi.hoisted(() => {
  const rpc = vi.fn()
  return { rpc, getClient: vi.fn(() => ({ rpc })) }
})
vi.mock("@/lib/supabase", () => ({ getSupabaseClient: getClient }))

const originalOnline = navigator.onLine
const clients: ReturnType<typeof createAppQueryClient>[] = []
function connectivity(online: boolean) {
  Object.defineProperty(navigator, "onLine", { configurable: true, value: online })
  onlineManager.setOnline(online)
}
afterEach(() => {
  cleanup()
  clients.forEach((client) => client.clear())
  clients.length = 0
  connectivity(originalOnline)
  vi.clearAllMocks()
})

function setup() {
  const client = createAppQueryClient()
  // The financial policy must win even over an unsafe generic default.
  client.setDefaultOptions({ mutations: { retry: 3, retryDelay: 0 } })
  clients.push(client)
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>
  return { client, wrapper }
}

type FinancialHook = () => { mutateAsync: (input: never) => Promise<unknown> }
const hooks: Array<[string, FinancialHook]> = [
  ["transaction create/update and transfers", useSaveTransaction],
  ["transaction deletion", useSoftDeleteTransaction],
  ["account create/update", useSaveAccount], ["reconciliation", useReconcileAccount],
  ["account archive", useArchiveAccount], ["account restore", useRestoreAccount],
  ["permanent account cleanup", useDeleteAccountPermanently], ["Simple valuation", useSaveInvestmentValuation],
  ["overall budget", useSaveMonthlyBudget], ["category budget", useSaveCategoryBudget],
  ["budget removal", useRemoveCategoryBudget], ["budget copy", useCopyPreviousBudget],
  ["category create/update", useSaveCategory], ["category archive/restore", useSetCategoryArchived],
  ["goal create/update", useSaveSavingsGoal], ["goal archive/restore", useSetSavingsGoalArchived],
  ["goal allocations", useRecordGoalAllocation], ["Detailed setup", useEnableDetailedTracking],
  ["holding metadata", useSaveHolding], ["buy/sell", useRecordTrade],
  ["manual prices", useUpdatePrices], ["manual FX", useSaveManualFx],
  ["dividends/cash adjustments", useRecordCashEvent], ["Net Worth history reset", useResetNetWorthHistory],
]

describe("financial mutation network behavior through the real feature hooks and services", () => {
  it.each(hooks)("rejects %s offline and never executes it on reconnect", async (_name, hook) => {
    const { client, wrapper } = setup()
    connectivity(false)
    const { result, unmount } = renderHook(hook, { wrapper })
    await act(async () => {
      // Input is deliberately unused: every service must reject before processing it.
      await expect(result.current.mutateAsync(undefined as never)).rejects.toThrow(offlineFinancialMutationMessage)
    })
    const mutation = client.getMutationCache().getAll()[0]
    expect(mutation.state).toMatchObject({ status: "error", isPaused: false })
    expect(mutation.options).toMatchObject({ retry: false, networkMode: "always" })
    expect(getClient).not.toHaveBeenCalled()
    expect(rpc).not.toHaveBeenCalled()
    unmount() // Closing the form must not leave a queued write behind.
    connectivity(true)
    await client.resumePausedMutations()
    expect(rpc).not.toHaveBeenCalled()
    expect(mutation.state.status).toBe("error")
  })

  const transaction = { transactionType: "expense" as const, amountMinor: 100, accountId: "bank", categoryId: "category", transactionDate: "2026-09-26", description: "" }

  it("requires a new explicit submission after reconnect", async () => {
    const { client, wrapper } = setup()
    rpc.mockResolvedValue({ data: "transaction-id", error: null })
    connectivity(false)
    const { result } = renderHook(useSaveTransaction, { wrapper })
    await act(async () => { await expect(result.current.mutateAsync(transaction)).rejects.toThrow(offlineFinancialMutationMessage) })
    connectivity(true)
    await client.resumePausedMutations()
    expect(rpc).not.toHaveBeenCalled()
    await act(async () => { await result.current.mutateAsync(transaction) })
    expect(rpc).toHaveBeenCalledTimes(1)
  })

  it("never retries an online transport failure", async () => {
    const { client, wrapper } = setup()
    connectivity(true)
    rpc.mockRejectedValue(new TypeError("Failed to fetch"))
    const { result } = renderHook(useSaveTransaction, { wrapper })
    await act(async () => { await expect(result.current.mutateAsync(transaction)).rejects.toThrow("Failed to fetch") })
    connectivity(false)
    connectivity(true)
    await client.resumePausedMutations()
    expect(rpc).toHaveBeenCalledTimes(1)
  })
})
