import { describe, expect, it, vi } from "vitest"

import {
  dailyReminderNotification,
  handleNotificationClickEvent,
  handlePushEvent,
  type ServiceWorkerScopeLike,
  type WindowClientLike,
} from "@/service-worker-handlers"

describe("daily reminder service worker", () => {
  it("always shows the expected generic notification for a push", async () => {
    const showNotification = vi.fn().mockResolvedValue(undefined)
    let task: Promise<unknown> | undefined
    handlePushEvent({
      data: { json: () => ({ title: "Balance S$999", body: "private", url: "https://evil.test" }) },
      waitUntil: (promise) => { task = promise },
    }, scope({ showNotification }))
    await task

    expect(showNotification).toHaveBeenCalledExactlyOnceWith("Ledgerly", {
      body: "Quick reminder: log anything you spent today.",
      icon: "/icons/pwa-192x192.png",
      tag: "daily-transaction-reminder",
      data: { url: "/transactions/new?type=expense" },
    })
  })

  it("still shows a visible reminder when the push payload is malformed", async () => {
    const showNotification = vi.fn().mockResolvedValue(undefined)
    let task: Promise<unknown> | undefined
    handlePushEvent({
      data: { json: () => { throw new Error("malformed") } },
      waitUntil: (promise) => { task = promise },
    }, scope({ showNotification }))
    await task
    expect(showNotification).toHaveBeenCalledWith(dailyReminderNotification.title, expect.any(Object))
  })

  it("focuses and navigates an existing Ledgerly client to Add Expense", async () => {
    const focus = vi.fn().mockResolvedValue(undefined)
    const navigate = vi.fn().mockResolvedValue({ url: "https://ledgerly.test/transactions/new?type=expense", focus })
    const close = vi.fn()
    const openWindow = vi.fn()
    let task: Promise<unknown> | undefined
    handleNotificationClickEvent({
      notification: { close, data: { url: "/transactions/new?type=expense" } },
      waitUntil: (promise) => { task = promise },
    }, scope({ clients: [{ url: "https://ledgerly.test/dashboard", focus, navigate }], openWindow }))
    await task

    expect(close).toHaveBeenCalledOnce()
    expect(navigate).toHaveBeenCalledWith("https://ledgerly.test/transactions/new?type=expense")
    expect(focus).toHaveBeenCalledOnce()
    expect(openWindow).not.toHaveBeenCalled()
  })

  it("opens Add Expense when no Ledgerly client is available", async () => {
    const openWindow = vi.fn().mockResolvedValue(null)
    let task: Promise<unknown> | undefined
    handleNotificationClickEvent({
      notification: { close: vi.fn(), data: { url: "https://evil.test" } },
      waitUntil: (promise) => { task = promise },
    }, scope({ clients: [], openWindow }))
    await task
    expect(openWindow).toHaveBeenCalledWith("https://ledgerly.test/transactions/new?type=expense")
  })
})

function scope({
  showNotification = vi.fn().mockResolvedValue(undefined),
  clients = [],
  openWindow = vi.fn().mockResolvedValue(null),
}: {
  showNotification?: unknown
  clients?: WindowClientLike[]
  openWindow?: unknown
}): ServiceWorkerScopeLike {
  return {
    location: { origin: "https://ledgerly.test" },
    registration: {
      showNotification: showNotification as ServiceWorkerScopeLike["registration"]["showNotification"],
    },
    clients: {
      matchAll: () => Promise.resolve(clients),
      openWindow: openWindow as ServiceWorkerScopeLike["clients"]["openWindow"],
    },
  }
}
