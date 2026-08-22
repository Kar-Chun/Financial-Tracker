// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest"
import { render, screen } from "@testing-library/react"
import { WalletCards } from "lucide-react"
import { describe, expect, it } from "vitest"

import { MetricCard } from "@/features/dashboard/metric-card"

describe("MetricCard", () => {
  it("renders a real minor-unit amount with its currency", () => {
    render(
      <MetricCard
        label="Bank + Cash"
        amountMinor={298_800}
        currencyCode="SGD"
        helper="Base-currency accounts only"
        icon={WalletCards}
      />,
    )

    expect(screen.getByText("Bank + Cash")).toBeInTheDocument()
    expect(screen.getByText(/2,988/)).toBeInTheDocument()
  })
})
