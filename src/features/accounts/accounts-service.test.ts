// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  archiveAccount,
  deleteAccountPermanently,
  restoreAccount,
} from "@/features/accounts/accounts-service"
import { OfflineFinancialMutationError } from "@/lib/network"

const supabaseMock = vi.hoisted(() => ({ rpc: vi.fn() }))

vi.mock("@/lib/supabase", () => ({
  getSupabaseClient: () => supabaseMock,
}))

beforeEach(() => {
  Object.defineProperty(navigator, "onLine", { configurable: true, value: true })
  supabaseMock.rpc.mockReset()
  supabaseMock.rpc.mockResolvedValue({ data: {}, error: null })
})

describe("account lifecycle services", () => {
  it("uses the authenticated archive and restore RPCs", async () => {
    await archiveAccount("account-a")
    await restoreAccount("account-a")

    expect(supabaseMock.rpc).toHaveBeenNthCalledWith(1, "archive_account", { p_account_id: "account-a" })
    expect(supabaseMock.rpc).toHaveBeenNthCalledWith(2, "restore_account", { p_account_id: "account-a" })
  })

  it("uses one permanent-delete RPC call rather than browser table deletes", async () => {
    await deleteAccountPermanently("test-investment")

    expect(supabaseMock.rpc).toHaveBeenCalledTimes(1)
    expect(supabaseMock.rpc).toHaveBeenCalledWith("delete_account_permanently", {
      p_account_id: "test-investment",
    })
  })

  it.each([
    ["archive", archiveAccount],
    ["restore", restoreAccount],
    ["permanent delete", deleteAccountPermanently],
  ])("blocks %s while offline and never queues an RPC", async (_label, action) => {
    Object.defineProperty(navigator, "onLine", { configurable: true, value: false })

    await expect(action("account-a")).rejects.toBeInstanceOf(OfflineFinancialMutationError)
    expect(supabaseMock.rpc).not.toHaveBeenCalled()
  })
})
