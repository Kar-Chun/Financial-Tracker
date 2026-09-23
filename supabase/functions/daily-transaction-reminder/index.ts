import { sendPushNotification } from "npm:@mmmike/web-push@1.0.1/send"
import { createClient } from "npm:@supabase/supabase-js@2"

import {
  runDailyReminderWorker,
  type DeliveryOutcome,
  type PushSubscriptionRecord,
  type ReminderClaim,
} from "./worker.ts"

const payload = {
  title: "Ledgerly",
  body: "Quick reminder: log anything you spent today.",
  url: "/transactions/new?type=expense",
  tag: "daily-transaction-reminder",
} as const

Deno.serve(async (request) => {
  const requestId = crypto.randomUUID()
  try {
    if (request.method !== "POST") return json({ error: "Method not allowed." }, 405)
    const cronSecret = Deno.env.get("DAILY_REMINDER_CRON_SECRET") ?? ""
    if (!cronSecret || !constantTimeEqual(request.headers.get("Authorization") ?? "", `Bearer ${cronSecret}`)) {
      return json({ error: "Authentication is required." }, 401)
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? ""
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    const publicKey = Deno.env.get("WEB_PUSH_VAPID_PUBLIC_KEY") ?? ""
    const privateKey = Deno.env.get("WEB_PUSH_VAPID_PRIVATE_KEY") ?? ""
    const subject = Deno.env.get("WEB_PUSH_VAPID_SUBJECT") ?? ""
    if (!supabaseUrl || !serviceRoleKey || !publicKey || !privateKey || !subject) {
      console.error(JSON.stringify({ request_id: requestId, category: "configuration" }))
      return json({ error: "Daily reminder worker is not configured." }, 503)
    }

    const client = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })
    const result = await runDailyReminderWorker({
      claimReminders: async () => {
        const { data, error } = await client.rpc("claim_daily_transaction_reminders", { p_limit: 50 })
        if (error) throw error
        return (data ?? []) as ReminderClaim[]
      },
      isReminderEnabled: async (userId) => {
        const { data, error } = await client
          .from("notification_preferences")
          .select("daily_reminder_enabled")
          .eq("user_id", userId)
          .maybeSingle()
        if (error) throw error
        return data?.daily_reminder_enabled === true
      },
      listSubscriptions: async (userId) => {
        const { data, error } = await client
          .from("push_subscriptions")
          .select("id,endpoint,p256dh,auth")
          .eq("user_id", userId)
        if (error) throw error
        return (data ?? []) as PushSubscriptionRecord[]
      },
      sendPush: (subscription, claim) => sendPushNotification(
        {
          endpoint: subscription.endpoint,
          keys: { p256dh: subscription.p256dh, auth: subscription.auth },
        },
        payload,
        { publicKey, privateKey, subject },
        { ttl: 3_600, timeoutMs: 15_000, topic: `daily-${claim.reminder_local_date}` },
      ),
      removeSubscription: async (subscriptionId, userId) => {
        const { error } = await client
          .from("push_subscriptions")
          .delete()
          .eq("id", subscriptionId)
          .eq("user_id", userId)
        if (error) throw error
      },
      completeDelivery: async (deliveryId, outcome: DeliveryOutcome, failureCode?: string) => {
        const { data, error } = await client.rpc("complete_daily_transaction_reminder", {
          p_delivery_id: deliveryId,
          p_outcome: outcome,
          p_failure_code: failureCode ?? null,
        })
        if (error || data !== true) throw error ?? new Error("Reminder claim completion was rejected.")
      },
    })
    return json(result, 200)
  } catch {
    console.error(JSON.stringify({ request_id: requestId, category: "worker_failure" }))
    return json({ error: "Daily reminder worker failed." }, 503)
  }
})

function constantTimeEqual(actual: string, expected: string) {
  const actualBytes = new TextEncoder().encode(actual)
  const expectedBytes = new TextEncoder().encode(expected)
  if (actualBytes.length !== expectedBytes.length) return false
  let difference = 0
  for (let index = 0; index < actualBytes.length; index += 1) {
    difference |= actualBytes[index] ^ expectedBytes[index]
  }
  return difference === 0
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  })
}
