// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest"

import { offlineFinancialMutationMessage, performFinancialMutation } from "@/lib/network"

const originalOnline = navigator.onLine

afterEach(() => {
  Object.defineProperty(navigator, "onLine", { configurable: true, value: originalOnline })
})

describe("financial mutation connectivity guard", () => {
  it("blocks an offline save without calling or queueing the operation", async () => {
    Object.defineProperty(navigator, "onLine", { configurable: true, value: false })
    const operation = vi.fn(async () => "saved")

    await expect(performFinancialMutation(operation)).rejects.toThrow(offlineFinancialMutationMessage)
    expect(operation).not.toHaveBeenCalled()
  })

  it("runs an online mutation exactly once", async () => {
    Object.defineProperty(navigator, "onLine", { configurable: true, value: true })
    const operation = vi.fn(async () => "saved")

    await expect(performFinancialMutation(operation)).resolves.toBe("saved")
    expect(operation).toHaveBeenCalledTimes(1)
  })
})
