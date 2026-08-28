// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { NetWorthHistoryReset } from "@/features/settings/net-worth-history-reset"

const serviceMock = vi.hoisted(() => ({ reset: vi.fn() }))

vi.mock("@/features/settings/net-worth-history-service", () => ({
  resetNetWorthHistory: serviceMock.reset,
}))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

beforeEach(() => {
  serviceMock.reset.mockReset()
  serviceMock.reset.mockResolvedValue("snapshot-id")
})

describe("NetWorthHistoryReset", () => {
  it("requires exact RESET confirmation and invalidates only Dashboard data after success", async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
    queryClient.setQueryData(["dashboard"], { snapshots: ["old"] })
    queryClient.setQueryData(["accounts"], ["preserved"])
    render(
      <QueryClientProvider client={queryClient}>
        <NetWorthHistoryReset />
      </QueryClientProvider>,
    )

    fireEvent.click(screen.getByRole("button", { name: "Reset history" }))
    const confirmation = screen.getByLabelText("Type RESET to confirm Net Worth history reset")
    const action = screen.getByRole("button", { name: "Reset history" })
    expect(action).toBeDisabled()

    fireEvent.change(confirmation, { target: { value: "reset" } })
    expect(action).toBeDisabled()
    fireEvent.change(confirmation, { target: { value: "RESET" } })
    expect(action).toBeEnabled()
    fireEvent.click(action)

    await waitFor(() => expect(serviceMock.reset).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(queryClient.getQueryState(["dashboard"])?.isInvalidated).toBe(true))
    expect(queryClient.getQueryData(["accounts"])).toEqual(["preserved"])
  })

  it("disables repeated destructive submission while the reset is pending", async () => {
    let resolveReset: ((value: string) => void) | undefined
    serviceMock.reset.mockReturnValue(new Promise((resolve) => { resolveReset = resolve }))
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
    render(<QueryClientProvider client={queryClient}><NetWorthHistoryReset /></QueryClientProvider>)

    fireEvent.click(screen.getByRole("button", { name: "Reset history" }))
    fireEvent.change(screen.getByLabelText("Type RESET to confirm Net Worth history reset"), { target: { value: "RESET" } })
    const action = screen.getByRole("button", { name: "Reset history" })
    fireEvent.click(action)

    await waitFor(() => expect(action).toBeDisabled())
    fireEvent.click(action)
    expect(serviceMock.reset).toHaveBeenCalledTimes(1)
    resolveReset?.("snapshot-id")
  })
})
