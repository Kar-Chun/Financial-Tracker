// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { NotificationSettings } from "@/features/notifications/notification-settings"

const mocks = vi.hoisted(() => ({
  enable: vi.fn(),
  save: vi.fn(),
  remove: vi.fn(),
  currentSubscription: vi.fn(),
  toastError: vi.fn(),
  status: "not_allowed" as "allowed" | "not_allowed" | "blocked" | "unsupported",
  preference: { user_id: "owner", daily_reminder_enabled: false },
}))

vi.mock("sonner", () => ({ toast: { error: mocks.toastError, success: vi.fn() } }))

vi.mock("@/features/notifications/notification-hooks", () => ({
  useNotificationPreference: () => ({ data: mocks.preference, isLoading: false, isError: false }),
  useEnableDailyReminder: () => ({ mutate: mocks.enable, isPending: false }),
  useSaveDailyReminderPreference: () => ({ mutate: mocks.save, isPending: false }),
  useRemoveCurrentPushSubscription: () => ({ mutate: mocks.remove, isPending: false }),
}))
vi.mock("@/features/notifications/notification-service", () => ({
  getNotificationPermissionStatus: () => mocks.status,
  getCurrentPushSubscription: mocks.currentSubscription,
}))

beforeEach(() => {
  vi.clearAllMocks()
  mocks.status = "not_allowed"
  mocks.preference = { user_id: "owner", daily_reminder_enabled: false }
  mocks.currentSubscription.mockResolvedValue(null)
})

describe("Notification settings", () => {
  it("shows the device-limit domain message without database details", () => {
    mocks.enable.mockImplementationOnce((_input, callbacks) => callbacks.onError({ message: "Notification device limit reached.", details: "private database detail" }))
    render(<NotificationSettings />)
    fireEvent.click(screen.getByRole("button", { name: "Enable notifications" }))
    expect(mocks.toastError).toHaveBeenCalledWith("You've reached the device limit for notifications. Remove an existing device before adding another.")
  })
  it("shows safe unsupported guidance without starting setup", () => {
    mocks.status = "unsupported"
    render(<NotificationSettings />)
    expect(screen.getByText("Unsupported")).toBeInTheDocument()
    expect(screen.getByText(/installed as a supported Home Screen app/)).toBeInTheDocument()
    expect(mocks.enable).not.toHaveBeenCalled()
  })

  it("starts notification setup only after the explicit Enable action", () => {
    render(<NotificationSettings />)
    expect(mocks.enable).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: "Enable notifications" }))
    expect(mocks.enable).toHaveBeenCalledWith(undefined, expect.any(Object))
  })

  it("reflects an enabled preference and blocked device permission", () => {
    mocks.status = "blocked"
    mocks.preference = { ...mocks.preference, daily_reminder_enabled: true }
    render(<NotificationSettings />)
    expect(screen.getByRole("switch", { name: "Daily transaction reminder" })).toHaveAttribute("aria-checked", "true")
    expect(screen.getByText("Blocked")).toBeInTheDocument()
    expect(screen.getByText("Every day at 9:00 PM")).toBeInTheDocument()
    expect(screen.queryByLabelText("Reminder time")).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Save time" })).not.toBeInTheDocument()
  })

  it("disabling updates the server preference", () => {
    mocks.status = "allowed"
    mocks.preference = { ...mocks.preference, daily_reminder_enabled: true }
    render(<NotificationSettings />)
    fireEvent.click(screen.getByRole("switch", { name: "Daily transaction reminder" }))
    expect(mocks.save).toHaveBeenCalledWith(false, expect.any(Object))
  })

  it("keeps the explicit current-device removal action", async () => {
    mocks.status = "allowed"
    mocks.preference = { ...mocks.preference, daily_reminder_enabled: true }
    mocks.currentSubscription.mockResolvedValue({ endpoint: "https://example.invalid/device" })
    render(<NotificationSettings />)
    fireEvent.click(await screen.findByRole("button", { name: "Remove this device" }))
    expect(mocks.remove).toHaveBeenCalledWith(undefined, expect.any(Object))
  })
})
