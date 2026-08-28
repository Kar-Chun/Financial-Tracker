// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest"

import { resetNetWorthHistory } from "@/features/settings/net-worth-history-service"
import { OfflineFinancialMutationError } from "@/lib/network"

const supabaseMock = vi.hoisted(() => ({ rpc: vi.fn() }))

vi.mock("@/lib/supabase", () => ({ getSupabaseClient: () => supabaseMock }))

beforeEach(() => {
  Object.defineProperty(navigator, "onLine", { configurable: true, value: true })
  supabaseMock.rpc.mockReset()
  supabaseMock.rpc.mockResolvedValue({ data: "snapshot-id", error: null })
})

describe("resetNetWorthHistory", () => {
  it("uses one authenticated no-argument RPC", async () => {
    await expect(resetNetWorthHistory()).resolves.toBe("snapshot-id")
    expect(supabaseMock.rpc).toHaveBeenCalledTimes(1)
    expect(supabaseMock.rpc).toHaveBeenCalledWith("reset_net_worth_history")
  })

  it("blocks offline without calling or queueing the RPC", async () => {
    Object.defineProperty(navigator, "onLine", { configurable: true, value: false })

    await expect(resetNetWorthHistory()).rejects.toBeInstanceOf(OfflineFinancialMutationError)
    expect(supabaseMock.rpc).not.toHaveBeenCalled()
  })
})
