import { describe, expect, it } from "vitest"

import {
  formatCurrency,
  formatSignedCurrency,
  minorUnitsToInput,
  parseCurrencyToMinor,
} from "@/lib/currency"

describe("currency minor-unit utilities", () => {
  it("parses SGD and USD inputs without floating-point multiplication", () => {
    expect(parseCurrencyToMinor("1,234.56", "SGD")).toBe(123_456)
    expect(parseCurrencyToMinor("0.10", "USD")).toBe(10)
  })

  it("rejects unsupported decimal precision and negative user amounts", () => {
    expect(() => parseCurrencyToMinor("1.005", "SGD")).toThrow("2 decimal places")
    expect(() => parseCurrencyToMinor("-12.50", "SGD")).toThrow("cannot be negative")
  })

  it("formats safe integer minor units for display", () => {
    expect(formatCurrency(1_250, "SGD")).toBe("$12.50")
    expect(formatCurrency(51_580, "SGD")).toBe("$515.80")
    expect(formatCurrency(51_580, "USD")).toBe("US$515.80")
    expect(minorUnitsToInput(1_250, "USD")).toBe("12.50")
  })

  it("formats positive and negative signed values at the currency precision", () => {
    expect(formatSignedCurrency(48_420, "SGD")).toBe("+$484.20")
    expect(formatSignedCurrency(-48_420, "SGD")).toBe("-$484.20")
    expect(formatSignedCurrency(0, "SGD")).toBe("$0.00")
  })
})
