import { describe, expect, it, vi } from "vitest"

import {
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
  it("removes expired subscriptions, continues other sends, and records delivery", async () => {
    const subscriptions = [subscription("gone"), subscription("active")]
    const removeSubscription = vi.fn().mockResolvedValue(undefined)
    const completeDelivery = vi.fn().mockResolvedValue(undefined)
    const result = await runDailyReminderWorker({
      claimReminders: async () => [claim],
      isReminderEnabled: async () => true,
      listSubscriptions: async () => subscriptions,
      sendPush: async (record) => record.id === "active",
      removeSubscription,
      completeDelivery,
    })

    expect(removeSubscription).toHaveBeenCalledExactlyOnceWith("gone", "user-a")
    expect(completeDelivery).toHaveBeenCalledExactlyOnceWith("delivery-a", "delivered")
    expect(result).toEqual({ claimed: 1, delivered: 1, gone: 1, failed: 0, disabled: 0, no_subscription: 0 })
  })

  it("records a failed outcome without scheduling another same-day attempt", async () => {
    const completeDelivery = vi.fn().mockResolvedValue(undefined)
    const result = await runDailyReminderWorker({
      claimReminders: async () => [claim],
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
      claimReminders: async () => [claim],
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
      claimReminders: async () => [claim],
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
