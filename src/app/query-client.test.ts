import { MutationObserver, onlineManager, QueryObserver } from "@tanstack/react-query"
import { afterEach, describe, expect, it, vi } from "vitest"

import { createAppQueryClient } from "@/app/query-client"
import { clearSensitiveCacheForUserChange } from "@/features/auth/auth-cache"
import { invalidateTransactionFinanceData } from "@/features/transactions/transactions-hooks"
import { UnexpectedRpcResponseError } from "@/lib/rpc-validation"
import { isBlockingReadError, retryRead } from "@/lib/query-policy"

afterEach(() => { vi.restoreAllMocks(); onlineManager.setOnline(true) })

describe("read reliability policy", () => {
  it.each([
    { label: "baseline", staleTime: 15_000, expectedReads: 2 },
    { label: "V1", staleTime: 30_000, expectedReads: 0 },
  ])("measures $label Dashboard/budget remounts with 20-second-old cached data", async ({ staleTime, expectedReads }) => {
    const client = createAppQueryClient()
    const read = vi.fn().mockResolvedValue({ loaded: true })
    const stops = [["dashboard"], ["budgets", "2026-09-01"]].map((queryKey) => {
      client.setQueryData(queryKey, { loaded: true }, { updatedAt: Date.now() - 20_000 })
      return new QueryObserver(client, { queryKey, queryFn: read, staleTime }).subscribe(() => undefined)
    })
    expect(read).toHaveBeenCalledTimes(expectedReads)
    stops.forEach((stop) => stop())
    client.clear()
  })

  it.each([
    { status: 401 }, { status: 403 }, { code: "42501" }, { code: "PGRST301" },
    { code: "P0001" }, { code: "22003" }, { code: "PGRST202" },
    { status: 500 }, new UnexpectedRpcResponseError(), new Error("unexpected bug"),
  ])("does not retry permanent or unknown errors: %o", (error) => {
    expect(retryRead(0, error)).toBe(false)
    expect(isBlockingReadError({ data: [], error, isError: true })).toBe(true)
  })

  it.each([
    new TypeError("Failed to fetch"), { code: "", message: "TypeError: Load failed" },
    { status: 503 }, { code: "PGRST003" },
  ])("retries recognized transient errors only once: %o", (error) => {
    expect(retryRead(0, error)).toBe(true)
    expect(retryRead(1, error)).toBe(false)
    expect(isBlockingReadError({ data: [], error, isError: true })).toBe(false)
    expect(isBlockingReadError({ data: undefined, error, isError: true })).toBe(true)
  })

  it("makes exactly two attempts for a transient read and one for an auth error", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined)
    const client = createAppQueryClient()
    const read = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"))
    await expect(client.fetchQuery({ queryKey: ["dashboard"], queryFn: read, retryDelay: 0 })).rejects.toThrow()
    expect(read).toHaveBeenCalledTimes(2)
    read.mockClear().mockRejectedValue({ code: "42501" })
    await expect(client.fetchQuery({ queryKey: ["accounts"], queryFn: read })).rejects.toEqual({ code: "42501" })
    expect(read).toHaveBeenCalledTimes(1)
    client.clear()
  })

  it("does not automatically repeat a financial mutation after a transport failure", async () => {
    const client = createAppQueryClient()
    const write = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"))
    const mutation = new MutationObserver(client, { mutationFn: write })
    await expect(mutation.mutate(undefined)).rejects.toThrow()
    expect(write).toHaveBeenCalledTimes(1)
    client.clear()
  })

  it("reuses reference data on remount and still refreshes financial data after 30 seconds", async () => {
    const client = createAppQueryClient()
    for (const key of [["profile", "user"], ["accounts", "archived"], ["accounts", "summaries"]]) {
      const read = vi.fn().mockResolvedValue([])
      client.setQueryData(key, [], { updatedAt: Date.now() - 60_000 })
      const observer = new QueryObserver(client, { queryKey: key, queryFn: read })
      const unsubscribe = observer.subscribe(() => undefined)
      if (key[1] === "summaries") await vi.waitFor(() => expect(read).toHaveBeenCalledTimes(1))
      else expect(read).not.toHaveBeenCalled()
      unsubscribe()
    }
    client.clear()
  })

  it("reuses a 20-second-old Dashboard on return, but mutation invalidation refreshes immediately", async () => {
    const client = createAppQueryClient()
    const read = vi.fn().mockResolvedValue({ version: 2 })
    client.setQueryData(["dashboard"], { version: 1 }, { updatedAt: Date.now() - 20_000 })
    const observer = new QueryObserver(client, { queryKey: ["dashboard"], queryFn: read, staleTime: 30_000 })
    const unsubscribe = observer.subscribe(() => undefined)
    expect(observer.getCurrentResult().data).toEqual({ version: 1 })
    expect(read).not.toHaveBeenCalled()
    await invalidateTransactionFinanceData(client)
    expect(read).toHaveBeenCalledTimes(1)
    expect(observer.getCurrentResult().data).toEqual({ version: 2 })
    unsubscribe()
    client.clear()
  })

  it("deduplicates concurrent observers of the same profile", async () => {
    const client = createAppQueryClient()
    const read = vi.fn().mockResolvedValue({ display_name: "fixture" })
    const options = { queryKey: ["profile", "user"], queryFn: read }
    const first = new QueryObserver(client, options)
    const second = new QueryObserver(client, options)
    const stopFirst = first.subscribe(() => undefined)
    const stopSecond = second.subscribe(() => undefined)
    await vi.waitFor(() => expect(second.getCurrentResult().isSuccess).toBe(true))
    expect(read).toHaveBeenCalledTimes(1)
    stopFirst(); stopSecond(); client.clear()
  })

  it("keeps cached data on a failed background read, then recovers on reconnect", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined)
    const client = createAppQueryClient()
    client.mount()
    client.setQueryData(["accounts"], ["loaded"], { updatedAt: Date.now() - 60_000 })
    const read = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"))
    const observer = new QueryObserver(client, { queryKey: ["accounts"], queryFn: read, retryDelay: 0 })
    const unsubscribe = observer.subscribe(() => undefined)
    await vi.waitFor(() => expect(observer.getCurrentResult().isError).toBe(true))
    expect(observer.getCurrentResult().data).toEqual(["loaded"])
    expect(isBlockingReadError(observer.getCurrentResult())).toBe(false)
    onlineManager.setOnline(false)
    read.mockResolvedValue(["refreshed"])
    onlineManager.setOnline(true)
    await vi.waitFor(() => expect(observer.getCurrentResult().data).toEqual(["refreshed"]))
    unsubscribe(); client.unmount(); client.clear()
  })

  it("does not fetch while offline and starts the pending read on reconnect", async () => {
    const client = createAppQueryClient()
    client.mount()
    onlineManager.setOnline(false)
    const read = vi.fn().mockResolvedValue([])
    const observer = new QueryObserver(client, { queryKey: ["accounts"], queryFn: read })
    const unsubscribe = observer.subscribe(() => undefined)
    expect(observer.getCurrentResult().fetchStatus).toBe("paused")
    expect(read).not.toHaveBeenCalled()
    onlineManager.setOnline(true)
    await vi.waitFor(() => expect(observer.getCurrentResult().isSuccess).toBe(true))
    expect(read).toHaveBeenCalledTimes(1)
    unsubscribe(); client.unmount(); client.clear()
  })

  it("clears long-lived reference data and prevents an old in-flight read repopulating a new user's cache", async () => {
    const client = createAppQueryClient()
    let finish!: (value: string[]) => void
    const request = client.fetchQuery({ queryKey: ["accounts"], queryFn: () => new Promise<string[]>((resolve) => { finish = resolve }) }).catch(() => undefined)
    client.setQueryData(["profile", "old-user"], { display_name: "old" })
    clearSensitiveCacheForUserChange(client, "old-user", "new-user")
    finish(["old user's account"])
    await request
    expect(client.getQueryData(["profile", "old-user"])).toBeUndefined()
    expect(client.getQueryData(["accounts"])).toBeUndefined()
    client.clear()
  })
})
