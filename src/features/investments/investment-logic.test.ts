import { describe, expect, it } from "vitest"

import {
  calculateTradeCashMinor,
  multiplyDecimalToMinorUnits,
  normalizeInvestmentDecimal,
  parseExactDecimal,
} from "@/features/investments/investment-logic"

describe("investment decimal validation and cash preview", () => {
  it("uses exact fractional quantity and price arithmetic", () => {
    expect(multiplyDecimalToMinorUnits("0.527361", "620.50", 100)).toBe(32_723n)
    expect(calculateTradeCashMinor("buy", "0.5", "560", 200n, 100)).toBe(-28_200n)
    expect(calculateTradeCashMinor("sell", "0.25", "650", 200n, 100)).toBe(16_050n)
  })

  it("normalizes plain investment decimals without passing through floating point", () => {
    expect(normalizeInvestmentDecimal(" 0.000001 ")).toBe("0.000001")
    expect(normalizeInvestmentDecimal("1.23456789")).toBe("1.23456789")
    expect(normalizeInvestmentDecimal("123.456789")).toBe("123.456789")
    expect(normalizeInvestmentDecimal("1.284736", { maximumDecimals: 12 })).toBe("1.284736")
    expect(normalizeInvestmentDecimal("0", { allowZero: true })).toBe("0")
  })

  it.each(["", "NaN", "Infinity", "1e-6", "-1", "+1", ".5", "01.2"])(
    "rejects non-plain decimal input %j",
    (value) => expect(normalizeInvestmentDecimal(value)).toBeNull(),
  )

  it("enforces the investment NUMERIC precision without rounding", () => {
    expect(parseExactDecimal("12345678901234567890.1234567890")).not.toBeNull()
    expect(parseExactDecimal("123456789012345678901.1234567890")).toBeNull()
    expect(parseExactDecimal("1.12345678901")).toBeNull()
    expect(parseExactDecimal("123456789012345678.123456789012", 12)).not.toBeNull()
    expect(parseExactDecimal("1234567890123456789.123456789012", 12)).toBeNull()
  })

  it("rejects fees exceeding sale proceeds", () => {
    expect(calculateTradeCashMinor("sell", "1", "1", 101n, 100)).toBeNull()
  })
})
