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
  readonly code: "unsupported" | "blocked" | "configuration" | "subscription" | "subscription_conflict" | "device_limit"

  constructor(
    message: string,
    code: NotificationSetupError["code"],
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
    const client = getSupabaseClient()
    // Start reading the identity without delaying the permission user gesture.
    const initialSession = client.auth.getSession().catch(() => ({ data: { session: null }, error: true }))

    const permission = Notification.permission === "granted"
      ? "granted"
      : await Notification.requestPermission()
    if (permission !== "granted") {
      throw new NotificationSetupError("Notification permission was not allowed.", "blocked")
    }

    const { data: sessionData, error: sessionError } = await initialSession
    const userId = sessionData.session?.user.id
    if (sessionError || !userId) throw new NotificationSetupError("Sign in again to enable notifications.", "subscription")
    const assertCurrentUser = async () => {
      const { data, error } = await client.auth.getSession()
      if (error || data.session?.user.id !== userId) {
        throw new NotificationSetupError("The session changed. Enable notifications again.", "subscription")
      }
    }

    const registration = await navigator.serviceWorker.ready
    const existing = await registration.pushManager.getSubscription()
    const subscribe = async () => {
      await assertCurrentUser()
      try {
        return await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey,
        })
      } catch {
        throw new NotificationSetupError("This device could not enable notifications.", "subscription")
      }
    }
    const register = async (subscription: PushSubscription) => {
      const serialised = subscriptionJsonSchema.safeParse(subscription.toJSON())
      if (!serialised.success) {
        throw new NotificationSetupError("This device returned an invalid notification subscription.", "subscription")
      }
      await assertCurrentUser()
      const { data, error } = await client.rpc("enable_daily_transaction_reminder", {
        p_endpoint: serialised.data.endpoint,
        p_p256dh: serialised.data.keys.p256dh,
        p_auth: serialised.data.keys.auth,
      })
      if (error?.code === "P2001") throw new NotificationSetupError("This notification subscription cannot be registered.", "subscription_conflict")
      if (error?.code === "P2002") throw new NotificationSetupError("Notification device limit reached.", "device_limit")
      if (error) throw new NotificationSetupError("Notifications could not be enabled.", "subscription")
      await assertCurrentUser()
      const preference = parseRpcResponse(notificationPreferenceSchema, data)
      if (preference.user_id !== userId) throw new NotificationSetupError("The session changed. Enable notifications again.", "subscription")
      return preference
    }

    try {
      return await register(existing ?? await subscribe())
    } catch (error) {
      // Only an existing local subscription with an explicit ownership conflict
      // may be replaced. Do not unsubscribe on quota, auth or transport errors.
      if (!existing || !(error instanceof NotificationSetupError) || error.code !== "subscription_conflict") throw error
      await assertCurrentUser()
      let removed = false
      try { removed = await existing.unsubscribe() } catch { /* Safe local failure below. */ }
      if (!removed) throw new NotificationSetupError("This device could not renew notifications. Try again.", "subscription")
      const fresh = await subscribe()
      if (fresh.endpoint === existing.endpoint) throw new NotificationSetupError("This device could not renew notifications. Try again.", "subscription")
      // One fresh attempt only. The old server row remains owned by its account
      // until normal expired-subscription cleanup removes it.
      return register(fresh)
    }
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
