import { z } from "zod"

import { performFinancialMutation } from "@/lib/network"
import { parseRpcResponse } from "@/lib/rpc-validation"
import { getSupabaseClient } from "@/lib/supabase"

const notificationPreferenceSchema = z.object({
  user_id: z.string().min(1),
  daily_reminder_enabled: z.boolean(),
})

const subscriptionJsonSchema = z.object({
  endpoint: z.string().url().startsWith("https://"),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
})

export type NotificationPreference = z.infer<typeof notificationPreferenceSchema>
export type NotificationPermissionStatus = "allowed" | "not_allowed" | "blocked" | "unsupported"

export class NotificationSetupError extends Error {
  readonly code: "unsupported" | "blocked" | "configuration" | "subscription"

  constructor(
    message: string,
    code: "unsupported" | "blocked" | "configuration" | "subscription",
  ) {
    super(message)
    this.name = "NotificationSetupError"
    this.code = code
  }
}

export function getNotificationPermissionStatus(): NotificationPermissionStatus {
  if (typeof window === "undefined"
    || !("serviceWorker" in navigator)
    || !("PushManager" in window)
    || !("Notification" in window)) return "unsupported"
  if (Notification.permission === "granted") return "allowed"
  if (Notification.permission === "denied") return "blocked"
  return "not_allowed"
}

export async function getNotificationPreference() {
  const { data, error } = await getSupabaseClient().rpc("get_notification_settings")
  if (error) throw error
  return parseRpcResponse(notificationPreferenceSchema, data)
}

export async function enableDailyReminder() {
  return performFinancialMutation(async () => {
    if (getNotificationPermissionStatus() === "unsupported") {
      throw new NotificationSetupError(
        "Notifications are available when Ledgerly is installed as a supported Home Screen app.",
        "unsupported",
      )
    }
    if (Notification.permission === "denied") {
      throw new NotificationSetupError("Notifications are blocked in your device settings.", "blocked")
    }

    const publicKey = import.meta.env.VITE_WEB_PUSH_VAPID_PUBLIC_KEY
    if (!publicKey) {
      throw new NotificationSetupError("Notifications are not configured yet.", "configuration")
    }
    const applicationServerKey = urlBase64ToUint8Array(publicKey)

    const permission = Notification.permission === "granted"
      ? "granted"
      : await Notification.requestPermission()
    if (permission !== "granted") {
      throw new NotificationSetupError("Notification permission was not allowed.", "blocked")
    }

    const registration = await navigator.serviceWorker.ready
    let subscription = await registration.pushManager.getSubscription()
    if (!subscription) {
      try {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey,
        })
      } catch {
        throw new NotificationSetupError("This device could not enable notifications.", "subscription")
      }
    }

    const serialised = subscriptionJsonSchema.safeParse(subscription.toJSON())
    if (!serialised.success) {
      throw new NotificationSetupError("This device returned an invalid notification subscription.", "subscription")
    }
    const { data, error } = await getSupabaseClient().rpc("enable_daily_transaction_reminder", {
      p_endpoint: serialised.data.endpoint,
      p_p256dh: serialised.data.keys.p256dh,
      p_auth: serialised.data.keys.auth,
    })
    if (error) throw error
    return parseRpcResponse(notificationPreferenceSchema, data)
  })
}

export async function saveDailyReminderPreference(enabled: boolean) {
  return performFinancialMutation(async () => {
    const { data, error } = await getSupabaseClient().rpc("set_daily_transaction_reminder", {
      p_enabled: enabled,
    })
    if (error) throw error
    return parseRpcResponse(notificationPreferenceSchema, data)
  })
}

export async function getCurrentPushSubscription() {
  if (getNotificationPermissionStatus() === "unsupported") return null
  const registration = await navigator.serviceWorker.getRegistration()
  return registration?.pushManager.getSubscription() ?? null
}

export async function removeCurrentPushSubscription() {
  return performFinancialMutation(async () => {
    const subscription = await getCurrentPushSubscription()
    if (!subscription) return false
    const { data, error } = await getSupabaseClient().rpc("remove_current_push_subscription", {
      p_endpoint: subscription.endpoint,
    })
    if (error) throw error
    await subscription.unsubscribe()
    return data
  })
}

export function urlBase64ToUint8Array(value: string) {
  const padding = "=".repeat((4 - value.length % 4) % 4)
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/")
  let binary: string
  try {
    binary = window.atob(base64)
  } catch {
    throw new NotificationSetupError("Notifications are not configured yet.", "configuration")
  }
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0))
  if (bytes.length !== 65 || bytes[0] !== 4) {
    throw new NotificationSetupError("Notifications are not configured yet.", "configuration")
  }
  return bytes
}
