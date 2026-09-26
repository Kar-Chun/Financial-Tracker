// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { InvestmentAccountPage } from "@/features/investments/investment-account-page"

const hooks = vi.hoisted(() => ({ query: vi.fn(), refetch: vi.fn() }))
vi.mock("@/features/investments/investments-hooks", () => ({ useDetailedInvestment: hooks.query }))
vi.mock("@/features/auth/profile-service", () => ({ useProfile: () => ({ data: { base_currency: "SGD", timezone: "Asia/Singapore" }, refetch: vi.fn() }) }))
vi.mock("@/features/accounts/account-lifecycle-actions", () => ({ AccountLifecycleActions: () => null }))

beforeEach(() => { hooks.query.mockReset(); hooks.refetch.mockReset() })

function openPage() {
  return render(<MemoryRouter initialEntries={["/investments/account"]}><Routes>
    <Route path="/investments/:accountId" element={<InvestmentAccountPage />} />
    <Route path="/investments" element={<p>Portfolio redirected</p>} />
  </Routes></MemoryRouter>)
}

describe("investment account read failures", () => {
  it("stays on the requested account and allows retry on first-load failure", () => {
    hooks.query.mockReturnValue({ isError: true, error: new TypeError("Failed to fetch"), refetch: hooks.refetch })
    openPage()
    expect(screen.getByText("Investment account could not be loaded.")).toBeInTheDocument()
    expect(screen.queryByText("Portfolio redirected")).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Try again" }))
    expect(hooks.refetch).toHaveBeenCalledOnce()
  })

  it("retains loaded holdings and labels them after a transient refresh failure", () => {
    hooks.query.mockReturnValue({ isError: true, error: new TypeError("Load failed"), refetch: hooks.refetch, data: {
      account: { id: "account", name: "Broker", currency_code: "SGD", archived_at: null },
      value: { native_value_minor: 0, broker_cash_minor: 0, holdings_value_minor: 0, unrealized_gain_minor: 0, realized_gain_minor: 0, base_value_available: true },
      holdings: [], trades: [], cash_events: [],
    } })
    openPage()
    expect(screen.getByRole("heading", { name: "Broker" })).toBeInTheDocument()
    expect(screen.getByRole("status")).toHaveTextContent("Showing the latest loaded data")
    expect(screen.queryByText("Portfolio redirected")).not.toBeInTheDocument()
  })
})
