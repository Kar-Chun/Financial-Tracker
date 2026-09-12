// @vitest-environment jsdom

import { fireEvent, render, screen, within } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { formatCurrency } from "@/lib/currency"
import { GoalsPage } from "@/features/goals/goals-page"
import { GoalDetailPage } from "@/features/goals/goal-detail-page"
import type { SavingsGoalSummary } from "@/features/goals/goal-types"

const mocks = vi.hoisted(() => ({ summary: vi.fn(), detail: vi.fn(), record: vi.fn(), archive: vi.fn() }))
vi.mock("@/features/auth/profile-service", () => ({ useProfile: () => ({ data: { timezone: "Asia/Singapore" } }) }))
vi.mock("@/features/goals/goals-hooks", () => ({
  useSavingsGoals: mocks.summary, useSavingsGoalDetail: mocks.detail,
  useRecordGoalAllocation: () => ({ mutate: mocks.record, isPending: false }),
  useSetSavingsGoalArchived: () => ({ mutate: mocks.archive, isPending: false }),
  useSaveSavingsGoal: () => ({ mutate: vi.fn(), isPending: false }),
}))

const goal: SavingsGoalSummary = {
  id: "trip", name: "Japan Trip", target_amount_minor: 300000, currency_code: "SGD",
  target_date: null, note: "Summer holiday", archived_at: null, allocated_minor: 80000,
  remaining_minor: 220000, reached: false, target_date_passed: false,
  months_remaining: null, required_monthly_minor: null, created_at: "2026-09-01", updated_at: "2026-09-01",
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.summary.mockReturnValue({ data: {
    currency_code: "SGD", available_cash_minor: 500000, total_allocated_minor: 80000,
    unallocated_cash_minor: 420000, foreign_liquid_account_count: 0,
    goals: [goal, { ...goal, id: "old", name: "Past goal", archived_at: "2026-09-02" }],
  } })
  mocks.detail.mockReturnValue({ data: { ...goal, allocations: [
    { id: "entry", amount_minor: 80000, note: "August savings", allocation_date: "2026-08-23", created_at: "2026-08-23" },
  ] } })
})

function renderDetail() {
  render(<MemoryRouter initialEntries={["/goals/trip"]}><Routes><Route path="/goals/:goalId" element={<GoalDetailPage />} /></Routes></MemoryRouter>)
}

describe("Savings Goals refreshed presentation", () => {
  it("keeps current cash, active/detail links, and archived history discoverable", () => {
    render(<MemoryRouter><GoalsPage /></MemoryRouter>)
    expect(screen.getByText(formatCurrency(500000))).toBeInTheDocument()
    expect(screen.getByText(formatCurrency(420000))).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /Japan Trip/ })).toHaveAttribute("href", "/goals/trip")
    expect(screen.getByRole("link", { name: /Past goal/ })).toHaveAttribute("href", "/goals/old")
    expect(screen.getByRole("link", { name: /Create goal/ })).toHaveAttribute("href", "/goals/new")
  })

  it.each(["allocate", "reduce"] as const)("keeps %s inputs and history separate from real money movements", (operation) => {
    renderDetail()
    expect(screen.getByText("August savings")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: operation === "allocate" ? "Allocate" : "Reduce allocation" }))
    const dialog = within(screen.getByRole("dialog"))
    fireEvent.change(dialog.getByLabelText("Amount (SGD)"), { target: { value: "100.00" } })
    fireEvent.change(dialog.getByLabelText(/Note \(optional\)/), { target: { value: "Plan update" } })
    expect(dialog.getByLabelText("Amount (SGD)")).toHaveAttribute("inputmode", "decimal")
    expect(dialog.getByLabelText("Date")).toHaveAttribute("type", "date")
    fireEvent.click(dialog.getByRole("button", { name: operation === "allocate" ? "Allocate" : "Reduce allocation" }))
    expect(mocks.record).toHaveBeenCalledWith(expect.objectContaining({ goalId: "trip", operation, amountMinor: 10000, note: "Plan update" }), expect.any(Object))
  })

  it("requires the existing confirmation before archiving positive allocations", () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false)
    renderDetail()
    fireEvent.click(screen.getByRole("button", { name: "Archive" }))
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining("No real money moves"))
    expect(mocks.archive).not.toHaveBeenCalled()
    confirm.mockReturnValue(true)
    fireEvent.click(screen.getByRole("button", { name: "Archive" }))
    expect(mocks.archive).toHaveBeenCalledWith({ goalId: "trip", archived: true }, expect.any(Object))
    confirm.mockRestore()
  })

  it("keeps archived history readable and permits restore, not new allocations", () => {
    mocks.detail.mockReturnValue({ data: { ...goal, archived_at: "2026-09-02", allocations: [] } })
    renderDetail()
    expect(screen.getByText("Archived goal")).toBeInTheDocument()
    expect(screen.getByText("No allocation history yet.")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Allocate" })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Restore" }))
    expect(mocks.archive).toHaveBeenCalledWith({ goalId: "trip", archived: false }, expect.any(Object))
  })
})
