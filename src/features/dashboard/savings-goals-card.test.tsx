// @vitest-environment jsdom

import { render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { describe, expect, it } from "vitest"

import { SavingsGoalsCard } from "@/features/dashboard/savings-goals-card"
import type { SavingsGoalSummary, SavingsGoalsSummary } from "@/features/goals/goal-types"

const goal = (id: string, name: string): SavingsGoalSummary => ({
  id, name, target_amount_minor: 100_000, currency_code: "SGD", target_date: null, note: null,
  archived_at: null, allocated_minor: 25_000, remaining_minor: 75_000, reached: false,
  target_date_passed: false, months_remaining: null, required_monthly_minor: null,
  created_at: "2026-08-01T00:00:00Z", updated_at: "2026-08-01T00:00:00Z",
})

const summary = (goals: SavingsGoalSummary[]): SavingsGoalsSummary => ({
  currency_code: "SGD", available_cash_minor: 500_000, total_allocated_minor: 75_000,
  unallocated_cash_minor: 425_000, foreign_liquid_account_count: 0, goals,
})

describe("dashboard savings goals", () => {
  it("shows at most two active goals", () => {
    render(<MemoryRouter><SavingsGoalsCard summary={summary([goal("a", "Japan"), goal("b", "Laptop"), goal("c", "Emergency")])} /></MemoryRouter>)
    expect(screen.getByText("Japan")).toBeInTheDocument()
    expect(screen.getByText("Laptop")).toBeInTheDocument()
    expect(screen.queryByText("Emergency")).not.toBeInTheDocument()
  })

  it("offers a restrained creation state when no goals exist", () => {
    render(<MemoryRouter><SavingsGoalsCard summary={summary([])} /></MemoryRouter>)
    expect(screen.getByText(/No goals yet/)).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /create a savings target/i })).toHaveAttribute("href", "/goals/new")
  })
})
