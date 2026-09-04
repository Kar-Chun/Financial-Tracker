// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { NetWorthTrendCard } from "@/features/dashboard/net-worth-trend-card"
import { formatSnapshotTooltipLabel, netWorthChartKeys } from "@/features/dashboard/net-worth-trend"
import { unavailableDateLabel } from "@/lib/dates"
import type { NetWorthSnapshot } from "@/types/finance"

describe("NetWorthTrendCard", () => {
  it("shows real snapshot totals and supports only available dashboard periods", () => {
    render(<NetWorthTrendCard snapshots={[
      snapshot("latest", "2026-08-23", 110_000),
      snapshot("earlier", "2026-08-01", 100_000),
    ]} currencyCode="SGD" />)

    expect(screen.getByText("$1,100.00")).toBeInTheDocument()
    expect(screen.getByText("+$100.00")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "1M" })).toHaveAttribute("aria-pressed", "true")
    fireEvent.click(screen.getByRole("button", { name: "3M" }))
    expect(screen.getByRole("button", { name: "3M" })).toHaveAttribute("aria-pressed", "true")
    expect(screen.queryByRole("button", { name: "1Y" })).not.toBeInTheDocument()
  })

  it("formats the snapshot date supplied by the tooltip axis", () => {
    expect(netWorthChartKeys).toEqual({ snapshotDate: "snapshotDate", totalValueMinor: "totalValueMinor" })
    expect(formatSnapshotTooltipLabel("2026-08-23")).toBe("23 Aug")
    expect(formatSnapshotTooltipLabel(0)).toBe(unavailableDateLabel)
    expect(formatSnapshotTooltipLabel(undefined)).toBe(unavailableDateLabel)
  })

  it("keeps rendering real totals when a snapshot date is malformed", () => {
    expect(() => render(<NetWorthTrendCard snapshots={[
      snapshot("latest", "invalid-date", 110_000),
    ]} currencyCode="SGD" />)).not.toThrow()

    expect(screen.getByText("$1,100.00")).toBeInTheDocument()
    expect(screen.getByText("More daily snapshots will build your trend.")).toBeInTheDocument()
  })

  it("does not invent a zero change when only one snapshot exists", () => {
    render(<NetWorthTrendCard snapshots={[
      snapshot("today", "2026-08-28", 75_942),
    ]} currencyCode="SGD" />)

    expect(screen.getByText("$759.42")).toBeInTheDocument()
    expect(screen.getByText("Not enough history yet")).toBeInTheDocument()
    expect(screen.queryByText("$0.00")).not.toBeInTheDocument()
    expect(screen.queryByText(/0\.0%/)).not.toBeInTheDocument()
  })
})

function snapshot(id: string, snapshotDate: string, total: number): NetWorthSnapshot {
  return {
    id,
    user_id: "user",
    snapshot_date: snapshotDate,
    bank_value_base_minor: total,
    cash_value_base_minor: 0,
    investment_value_base_minor: 0,
    total_value_base_minor: total,
    created_at: `${snapshotDate}T00:00:00Z`,
    updated_at: `${snapshotDate}T00:00:00Z`,
  }
}
