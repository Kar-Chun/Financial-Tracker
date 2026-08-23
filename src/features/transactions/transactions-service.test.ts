// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest"

import { saveTransaction } from "@/features/transactions/transactions-service"

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
