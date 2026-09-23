export const dailyReminderNotification = {
  title: "Ledgerly",
  body: "Quick reminder: log anything you spent today.",
  url: "/transactions/new?type=expense",
  tag: "daily-transaction-reminder",
} as const

export type PushEventLike = {
  data?: { json(): unknown } | null
  waitUntil(promise: Promise<unknown>): void
}

export type NotificationClickEventLike = {
  notification: { close(): void; data?: unknown }
  waitUntil(promise: Promise<unknown>): void
}

export type WindowClientLike = {
  url: string
  focus(): Promise<unknown>
  navigate?(url: string): Promise<WindowClientLike | null>
}

export type ServiceWorkerScopeLike = {
  location: { origin: string }
  registration: {
    showNotification(title: string, options: {
      body: string
      icon: string
      tag: string
      data: { url: string }
    }): Promise<unknown>
  }
  clients: {
    matchAll(options: { type: "window"; includeUncontrolled: boolean }): Promise<readonly WindowClientLike[]>
    openWindow(url: string): Promise<WindowClientLike | null>
  }
}

export function handlePushEvent(event: PushEventLike, scope: ServiceWorkerScopeLike) {
  // Consume malformed/unexpected payloads safely, but never put server-provided
  // text on a lock screen. Every received push displays the fixed V1 reminder.
  try {
    event.data?.json()
  } catch {
    // A visible generic notification is still required for a received push.
  }
  event.waitUntil(scope.registration.showNotification(dailyReminderNotification.title, {
    body: dailyReminderNotification.body,
    icon: "/icons/pwa-192x192.png",
    tag: dailyReminderNotification.tag,
    data: { url: dailyReminderNotification.url },
  }))
}

export function handleNotificationClickEvent(event: NotificationClickEventLike, scope: ServiceWorkerScopeLike) {
  event.notification.close()
  const target = getSafeNotificationTarget(event.notification.data, scope.location.origin)
  event.waitUntil(openOrFocusClient(scope, target))
}

function getSafeNotificationTarget(data: unknown, origin: string) {
  if (isRecord(data) && data.url === dailyReminderNotification.url) {
    return new URL(dailyReminderNotification.url, origin).href
  }
  return new URL(dailyReminderNotification.url, origin).href
}

async function openOrFocusClient(scope: ServiceWorkerScopeLike, target: string) {
  const clients = await scope.clients.matchAll({ type: "window", includeUncontrolled: true })
  const targetUrl = new URL(target)
  const exactClient = clients.find((client) => client.url === target)
  if (exactClient) return exactClient.focus()

  const ledgerlyClient = clients.find((client) => new URL(client.url).origin === targetUrl.origin)
  if (ledgerlyClient?.navigate) {
    const navigated = await ledgerlyClient.navigate(target)
    return (navigated ?? ledgerlyClient).focus()
  }
  return scope.clients.openWindow(target)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
