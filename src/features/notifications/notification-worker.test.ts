import { describe, expect, it, vi } from "vitest"

import {
  MAX_PUSH_SUBSCRIPTIONS,
  MAX_REMINDER_BATCHES,
  REMINDER_BATCH_SIZE,
  runDailyReminderWorker,
  type PushSubscriptionRecord,
  type ReminderClaim,
} from "../../../supabase/functions/daily-transaction-reminder/worker.ts"

const claim: ReminderClaim = {
  delivery_id: "delivery-a",
  claimed_user_id: "user-a",
  reminder_local_date: "2026-09-22",
}

describe("daily reminder worker", () => {
  it("drains more than 50 users in bounded batches and stops on the empty batch", async () => {
    const users = Array.from({ length: 123 }, (_, index) => ({ ...claim, delivery_id: `delivery-${index}`, claimed_user_id: `user-${index}` }))
    const claimReminders = vi.fn().mockResolvedValueOnce(users.slice(0, 50)).mockResolvedValueOnce(users.slice(50, 100))
      .mockResolvedValueOnce(users.slice(100)).mockResolvedValue([])
    const sendPush = vi.fn().mockResolvedValue(true)
    const result = await runDailyReminderWorker({
      claimReminders, isReminderEnabled: async () => true,
      listSubscriptions: async () => [subscription("active")], sendPush,
      removeSubscription: vi.fn(), completeDelivery: vi.fn().mockResolvedValue(undefined),
    })
    expect(result).toMatchObject({ claimed: 123, delivered: 123, batches: 3, stop_reason: null })
    expect(claimReminders).toHaveBeenCalledTimes(4)
    expect(new Set(sendPush.mock.calls.map((call) => call[1].delivery_id)).size).toBe(123)
  })

  it("sends to at most five devices even if legacy storage returns more", async () => {
    const sendPush = vi.fn().mockResolvedValue(true)
    const result = await runDailyReminderWorker({
      claimReminders: vi.fn().mockResolvedValueOnce([claim]).mockResolvedValue([]),
      isReminderEnabled: async () => true,
      listSubscriptions: async () => Array.from({ length: 12 }, (_, index) => subscription(String(index))),
      sendPush, removeSubscription: vi.fn(), completeDelivery: vi.fn(),
    })
    expect(sendPush).toHaveBeenCalledTimes(MAX_PUSH_SUBSCRIPTIONS)
    expect(MAX_PUSH_SUBSCRIPTIONS).toBe(5)
    expect(result.delivered).toBe(1)
  })

  it("keeps concurrent user/device sends bounded", async () => {
    let active = 0
    let peak = 0
    const releases: Array<() => void> = []
    const users = Array.from({ length: 11 }, (_, index) => ({ ...claim, delivery_id: `d-${index}`, claimed_user_id: `u-${index}` }))
    const work = runDailyReminderWorker({
      claimReminders: vi.fn().mockResolvedValueOnce(users).mockResolvedValue([]),
      isReminderEnabled: async () => true,
      listSubscriptions: async () => Array.from({ length: 5 }, (_, index) => subscription(String(index))),
      sendPush: async () => {
        active += 1
        peak = Math.max(peak, active)
        await new Promise<void>((resolve) => { releases.push(resolve) })
        active -= 1
        return true
      },
      removeSubscription: vi.fn(), completeDelivery: vi.fn(),
    })
    for (const expected of [25, 25, 5]) {
      await vi.waitFor(() => expect(releases).toHaveLength(expected))
      releases.splice(0).forEach((release) => release())
    }
    await work
    expect(peak).toBe(25)
  })

  it("stops at the iteration guard and reports only operational counts", async () => {
    let sequence = 0
    const claimReminders = vi.fn(async () => Array.from({ length: REMINDER_BATCH_SIZE }, () => ({ ...claim, delivery_id: `d-${sequence++}` })))
    const result = await runDailyReminderWorker({
      claimReminders, isReminderEnabled: async () => true, listSubscriptions: async () => [],
      sendPush: vi.fn(), removeSubscription: vi.fn(), completeDelivery: vi.fn(),
    })
    expect(claimReminders).toHaveBeenCalledTimes(MAX_REMINDER_BATCHES)
    expect(result).toMatchObject({ claimed: 1000, batches: 20, stop_reason: "batch_limit_reached" })
    expect(JSON.stringify(result)).not.toMatch(/user-a|delivery-|endpoint|p256dh|auth/)
  })

  it("does not send a repeated claim twice if the claim dependency malfunctions", async () => {
    const sendPush = vi.fn().mockResolvedValue(true)
    const result = await runDailyReminderWorker({
      claimReminders: async () => [claim], isReminderEnabled: async () => true,
      listSubscriptions: async () => [subscription("active")], sendPush,
      removeSubscription: vi.fn(), completeDelivery: vi.fn(),
    })
    expect(sendPush).toHaveBeenCalledOnce()
    expect(result.stop_reason).toBe("invalid_claim_batch")
  })

  it("rejects an oversized claim batch without starting sends", async () => {
    const sendPush = vi.fn()
    const result = await runDailyReminderWorker({
      claimReminders: async () => Array.from({ length: 51 }, (_, index) => ({ ...claim, delivery_id: `d-${index}` })),
      isReminderEnabled: async () => true, listSubscriptions: async () => [subscription("active")], sendPush,
      removeSubscription: vi.fn(), completeDelivery: vi.fn(),
    })
    expect(result.stop_reason).toBe("invalid_claim_batch")
    expect(sendPush).not.toHaveBeenCalled()
  })

  it("never logs subscription details from a failed send", async () => {
    const record = subscription("private-endpoint")
    const errorLog = vi.spyOn(console, "error")
    const log = vi.spyOn(console, "log")
    try {
      const result = await runDailyReminderWorker({
        claimReminders: vi.fn().mockResolvedValueOnce([claim]).mockResolvedValue([]),
        isReminderEnabled: async () => true, listSubscriptions: async () => [record],
        sendPush: async () => { throw new Error(JSON.stringify(record)) },
        removeSubscription: vi.fn(), completeDelivery: vi.fn(),
      })
      expect(errorLog).not.toHaveBeenCalled()
      expect(log).not.toHaveBeenCalled()
      expect(JSON.stringify(result)).not.toContain(record.endpoint)
      expect(result.failed).toBe(1)
    } finally { errorLog.mockRestore(); log.mockRestore() }
  })
  it("removes expired subscriptions, continues other sends, and records delivery", async () => {
    const subscriptions = [subscription("gone"), subscription("active")]
    const removeSubscription = vi.fn().mockResolvedValue(undefined)
    const completeDelivery = vi.fn().mockResolvedValue(undefined)
    const result = await runDailyReminderWorker({
      claimReminders: vi.fn().mockResolvedValueOnce([claim]).mockResolvedValue([]),
      isReminderEnabled: async () => true,
      listSubscriptions: async () => subscriptions,
      sendPush: async (record) => record.id === "active",
      removeSubscription,
      completeDelivery,
    })

    expect(removeSubscription).toHaveBeenCalledExactlyOnceWith("gone", "user-a")
    expect(completeDelivery).toHaveBeenCalledExactlyOnceWith("delivery-a", "delivered")
    expect(result).toEqual({ batches: 1, stop_reason: null, claimed: 1, delivered: 1, gone: 1, failed: 0, disabled: 0, no_subscription: 0 })
  })

  it("records a failed outcome without scheduling another same-day attempt", async () => {
    const completeDelivery = vi.fn().mockResolvedValue(undefined)
    const result = await runDailyReminderWorker({
      claimReminders: vi.fn().mockResolvedValueOnce([claim]).mockResolvedValue([]),
      isReminderEnabled: async () => true,
      listSubscriptions: async () => [subscription("active")],
      sendPush: async () => { throw new TypeError("network unavailable") },
      removeSubscription: vi.fn(),
      completeDelivery,
    })
    expect(completeDelivery).toHaveBeenCalledExactlyOnceWith(
      "delivery-a", "failed", "push_service_unavailable",
    )
    expect(result.failed).toBe(1)
  })

  it("finishes a claim without sending when no subscription remains", async () => {
    const sendPush = vi.fn()
    const completeDelivery = vi.fn().mockResolvedValue(undefined)
    const result = await runDailyReminderWorker({
      claimReminders: vi.fn().mockResolvedValueOnce([claim]).mockResolvedValue([]),
      isReminderEnabled: async () => true,
      listSubscriptions: async () => [],
      sendPush,
      removeSubscription: vi.fn(),
      completeDelivery,
    })
    expect(sendPush).not.toHaveBeenCalled()
    expect(completeDelivery).toHaveBeenCalledWith("delivery-a", "no_subscription")
    expect(result.no_subscription).toBe(1)
  })

  it("rechecks the preference before sending so disabling stops a claimed reminder", async () => {
    const sendPush = vi.fn()
    const completeDelivery = vi.fn().mockResolvedValue(undefined)
    const result = await runDailyReminderWorker({
      claimReminders: vi.fn().mockResolvedValueOnce([claim]).mockResolvedValue([]),
      isReminderEnabled: async () => false,
      listSubscriptions: async () => [subscription("active")],
      sendPush,
      removeSubscription: vi.fn(),
      completeDelivery,
    })
    expect(sendPush).not.toHaveBeenCalled()
    expect(completeDelivery).toHaveBeenCalledWith("delivery-a", "disabled")
    expect(result.disabled).toBe(1)
  })
})

function subscription(id: string): PushSubscriptionRecord {
  return {
    id,
    endpoint: `https://fcm.googleapis.com/fcm/send/${id}`,
    p256dh: "p".repeat(87),
    auth: "a".repeat(22),
  }
}
