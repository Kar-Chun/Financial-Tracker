export type ReminderClaim = {
  delivery_id: string
  claimed_user_id: string
  reminder_local_date: string
}

export type PushSubscriptionRecord = {
  id: string
  endpoint: string
  p256dh: string
  auth: string
}

export type DeliveryOutcome = "delivered" | "failed" | "disabled" | "no_subscription"

export const MAX_PUSH_SUBSCRIPTIONS = 5
export const REMINDER_BATCH_SIZE = 50
export const MAX_REMINDER_BATCHES = 20

export type ReminderWorkerDependencies = {
  claimReminders(): Promise<ReminderClaim[]>
  isReminderEnabled(userId: string): Promise<boolean>
  listSubscriptions(userId: string): Promise<PushSubscriptionRecord[]>
  sendPush(subscription: PushSubscriptionRecord, claim: ReminderClaim): Promise<boolean>
  removeSubscription(subscriptionId: string, userId: string): Promise<void>
  completeDelivery(deliveryId: string, outcome: DeliveryOutcome, failureCode?: string): Promise<void>
}

export type ReminderWorkerResult = {
  batches: number
  stop_reason: "batch_limit_reached" | "invalid_claim_batch" | null
  claimed: number
  delivered: number
  gone: number
  failed: number
  disabled: number
  no_subscription: number
}

export async function runDailyReminderWorker(dependencies: ReminderWorkerDependencies): Promise<ReminderWorkerResult> {
  const result: ReminderWorkerResult = {
    batches: 0,
    stop_reason: null,
    claimed: 0,
    delivered: 0,
    gone: 0,
    failed: 0,
    disabled: 0,
    no_subscription: 0,
  }

  const seen = new Set<string>()
  for (let batch = 0; batch < MAX_REMINDER_BATCHES; batch += 1) {
    const claims = await dependencies.claimReminders()
    if (claims.length === 0) return result
    const ids = new Set(claims.map((claim) => claim.delivery_id))
    if (claims.length > REMINDER_BATCH_SIZE || ids.size !== claims.length || claims.some((claim) => seen.has(claim.delivery_id))) {
      result.stop_reason = "invalid_claim_batch"
      return result
    }
    ids.forEach((id) => seen.add(id))
    result.batches += 1
    result.claimed += claims.length
    // At most five users, each with at most five devices, send concurrently.
    for (let index = 0; index < claims.length; index += 5) {
      await Promise.all(claims.slice(index, index + 5).map((claim) => processClaim(claim, dependencies, result)))
    }
  }
  result.stop_reason = "batch_limit_reached"
  return result
}

async function processClaim(
  claim: ReminderClaim,
  dependencies: ReminderWorkerDependencies,
  result: ReminderWorkerResult,
) {
  try {
    if (!await dependencies.isReminderEnabled(claim.claimed_user_id)) {
      await dependencies.completeDelivery(claim.delivery_id, "disabled")
      result.disabled += 1
      return
    }
    const subscriptions = (await dependencies.listSubscriptions(claim.claimed_user_id)).slice(0, MAX_PUSH_SUBSCRIPTIONS)
    if (subscriptions.length === 0) {
      await dependencies.completeDelivery(claim.delivery_id, "no_subscription")
      result.no_subscription += 1
      return
    }

    const sends = await Promise.all(subscriptions.map(async (subscription) => {
      try {
        return await dependencies.sendPush(subscription, claim) ? "delivered" as const : "gone" as const
      } catch {
        return "failed" as const
      }
    }))

    const gone = subscriptions.filter((_subscription, subscriptionIndex) => sends[subscriptionIndex] === "gone")
    await Promise.all(gone.map((subscription) =>
      dependencies.removeSubscription(subscription.id, claim.claimed_user_id)))
    result.gone += gone.length

    if (sends.includes("delivered")) {
      await dependencies.completeDelivery(claim.delivery_id, "delivered")
      result.delivered += 1
      return
    }
    if (sends.includes("failed")) {
      await dependencies.completeDelivery(claim.delivery_id, "failed", "push_service_unavailable")
      result.failed += 1
      return
    }

    await dependencies.completeDelivery(claim.delivery_id, "no_subscription", "subscriptions_expired")
    result.no_subscription += 1
  } catch {
    // The durable claim is intentionally never reclaimed for this Singapore
    // calendar day, so a retry cannot produce a duplicate notification.
    try {
      await dependencies.completeDelivery(claim.delivery_id, "failed", "worker_failure")
    } catch {
      // The original claim still provides the at-most-once guarantee.
    }
    result.failed += 1
  }
}
