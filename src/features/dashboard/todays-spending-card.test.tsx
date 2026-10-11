// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react"
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom"
import { describe, expect, it } from "vitest"

import { TodaysSpendingCard } from "@/features/dashboard/todays-spending-card"
import { formatCurrency } from "@/lib/currency"

describe("today's spending card", () => {
  it("shows authoritative daily amounts and opens the exact eligible-spending day filter", () => {
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Routes>
          <Route path="/dashboard" element={<TodaysSpendingCard currencyCode="SGD" localDate="2026-09-09" todayMinor={1_840} averageMinor={2_130} />} />
          <Route path="/transactions" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByText(formatCurrency(1_840, "SGD"))).toBeInTheDocument()
    expect(screen.getByText(`7-day avg ${formatCurrency(2_130, "SGD")}/day`)).toBeInTheDocument()
    fireEvent.click(screen.getByRole("link", { name: /today's spending/i }))
    expect(screen.getByTestId("location")).toHaveTextContent("/transactions?date=2026-09-09&type=expense&eligible=true")
  })
})

function LocationProbe() {
  const location = useLocation()
  return <output data-testid="location">{location.pathname}{location.search}</output>
}
