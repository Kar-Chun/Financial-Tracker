// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  enableDailyReminder,
  getNotificationPermissionStatus,
  removeCurrentPushSubscription,
  saveDailyReminderPreference,
} from "@/features/notifications/notification-service"

const supabaseMock = vi.hoisted(() => ({ rpc: vi.fn() }))
vi.mock("@/lib/supabase", () => ({ getSupabaseClient: () => supabaseMock }))

const storedPreference = {
  user_id: "owner",
  daily_reminder_enabled: true,
}

beforeEach(() => {
  vi.unstubAllEnvs()
  vi.stubEnv("VITE_WEB_PUSH_VAPID_PUBLIC_KEY", "B".repeat(87))
  Object.defineProperty(navigator, "onLine", { configurable: true, value: true })
  supabaseMock.rpc.mockReset()
  supabaseMock.rpc.mockResolvedValue({ data: storedPreference, error: null })
})

describe("daily reminder browser subscription", () => {
  it("does not request permission while checking support", () => {
    const requestPermission = installWebPush({ permission: "default" }).requestPermission
    expect(getNotificationPermissionStatus()).toBe("not_allowed")
    expect(requestPermission).not.toHaveBeenCalled()
  })

  it("reports unsupported Web Push safely", () => {
    installWebPush({ permission: "default" })
    Reflect.deleteProperty(window, "PushManager")
    expect(getNotificationPermissionStatus()).toBe("unsupported")
  })

  it("does not enable the preference when permission is denied", async () => {
    const { requestPermission, subscribe } = installWebPush({ permission: "default", requestedPermission: "denied" })
    await expect(enableDailyReminder()).rejects.toThrow("not allowed")
    expect(requestPermission).toHaveBeenCalledOnce()
    expect(subscribe).not.toHaveBeenCalled()
    expect(supabaseMock.rpc).not.toHaveBeenCalled()
  })

  it("does not request permission or queue preference changes while offline", async () => {
    const { requestPermission } = installWebPush({ permission: "default", requestedPermission: "granted" })
    Object.defineProperty(navigator, "onLine", { configurable: true, value: false })
    await expect(enableDailyReminder()).rejects.toThrow("offline")
    expect(requestPermission).not.toHaveBeenCalled()
    expect(supabaseMock.rpc).not.toHaveBeenCalled()
  })

  it("creates and persists the correct visible subscription after permission", async () => {
    const { requestPermission, subscribe } = installWebPush({ permission: "default", requestedPermission: "granted" })
    await expect(enableDailyReminder()).resolves.toEqual(storedPreference)
    expect(requestPermission).toHaveBeenCalledOnce()
    expect(subscribe).toHaveBeenCalledWith(expect.objectContaining({
      userVisibleOnly: true,
      applicationServerKey: expect.any(Uint8Array),
    }))
    expect(supabaseMock.rpc).toHaveBeenCalledExactlyOnceWith("enable_daily_transaction_reminder", {
      p_endpoint: "https://fcm.googleapis.com/fcm/send/device-a",
      p_p256dh: "p".repeat(87),
      p_auth: "a".repeat(22),
    })
  })

  it("reuses an existing device subscription instead of creating a duplicate", async () => {
    const existing = subscription()
    const { subscribe } = installWebPush({ permission: "granted", existing })
    await enableDailyReminder()
    expect(subscribe).not.toHaveBeenCalled()
    expect(supabaseMock.rpc).toHaveBeenCalledOnce()
  })

  it("disables the daily reminder without unsubscribing the device", async () => {
    const { unsubscribe } = installWebPush({ permission: "granted", existing: subscription() })
    supabaseMock.rpc.mockResolvedValueOnce({
      data: { ...storedPreference, daily_reminder_enabled: false }, error: null,
    })
    await saveDailyReminderPreference(false)

    expect(supabaseMock.rpc).toHaveBeenCalledExactlyOnceWith("set_daily_transaction_reminder", {
      p_enabled: false,
    })
    expect(unsubscribe).not.toHaveBeenCalled()
  })

  it("removes and unsubscribes the current device explicitly", async () => {
    const existing = subscription()
    installWebPush({ permission: "granted", existing })
    supabaseMock.rpc.mockResolvedValueOnce({ data: true, error: null })

    await expect(removeCurrentPushSubscription()).resolves.toBe(true)

    expect(supabaseMock.rpc).toHaveBeenCalledExactlyOnceWith("remove_current_push_subscription", {
      p_endpoint: existing.endpoint,
    })
    expect(existing.unsubscribe).toHaveBeenCalledOnce()
  })
})

function installWebPush({
  permission,
  requestedPermission = permission,
  existing = null,
}: {
  permission: NotificationPermission
  requestedPermission?: NotificationPermission
  existing?: PushSubscription | null
}) {
  const requestPermission = vi.fn().mockResolvedValue(requestedPermission)
  Object.defineProperty(window, "Notification", {
    configurable: true,
    value: { permission, requestPermission },
  })
  Object.defineProperty(window, "PushManager", { configurable: true, value: class PushManagerMock {} })
  const created = subscription()
  const subscribe = vi.fn().mockResolvedValue(created)
  const getSubscription = vi.fn().mockResolvedValue(existing)
  const registration = { pushManager: { subscribe, getSubscription } }
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: { ready: Promise.resolve(registration), getRegistration: vi.fn().mockResolvedValue(registration) },
  })
  return { requestPermission, subscribe, unsubscribe: vi.mocked(created.unsubscribe) }
}

function subscription() {
  return {
    endpoint: "https://fcm.googleapis.com/fcm/send/device-a",
    toJSON: () => ({
      endpoint: "https://fcm.googleapis.com/fcm/send/device-a",
      keys: { p256dh: "p".repeat(87), auth: "a".repeat(22) },
    }),
    unsubscribe: vi.fn().mockResolvedValue(true),
  } as unknown as PushSubscription
}
