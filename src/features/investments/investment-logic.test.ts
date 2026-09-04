import { describe, expect, it } from "vitest"

import {
  applyWeightedAverageTrade,
  calculateDetailedNativeValue,
  calculateSimpleInvestmentValue,
  calculateTradeCashMinor,
  convertNativeMinorToBaseMinor,
  multiplyDecimalToMinorUnits,
  normalizeInvestmentDecimal,
  parseExactDecimal,
  selectLatestManualPrice,
} from "@/features/investments/investment-logic"

describe("investment accounting reference logic", () => {
  it("preserves the Simple valuation plus later-transfer rule", () => {
    expect(calculateSimpleInvestmentValue(595_000n, 100_000n)).toBe(695_000n)
  })

  it("values Detailed broker cash and holdings exactly once", () => {
    expect(calculateDetailedNativeValue(30_000n, 0n, 0n, 0n, [420_000n, 150_000n])).toBe(600_000n)
    expect(calculateDetailedNativeValue(30_000n, 100_000n, 0n, 0n, [420_000n, 150_000n])).toBe(700_000n)
  })

  it("does not add pre-boundary transfers represented by opening cash", () => {
    const openingCashAlreadyIncludesOldTransfer = 130_000n
    expect(calculateDetailedNativeValue(openingCashAlreadyIncludesOldTransfer, 0n, 0n, 0n, [420_000n])).toBe(550_000n)
  })

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

  it("uses weighted-average basis and includes fees", () => {
    const empty = { quantityUnits: 0n, quantityScale: 1n, costBasisMinor: 0n, brokerCashEffectMinor: 0n, realizedGainMinor: 0n }
    const first = applyWeightedAverageTrade(empty, { type: "buy", quantity: "1", grossMinor: 10_000n, feeMinor: 0n })!
    const second = applyWeightedAverageTrade(first, { type: "buy", quantity: "1", grossMinor: 12_000n, feeMinor: 0n })!
    expect(second.costBasisMinor).toBe(22_000n)
    const sold = applyWeightedAverageTrade(second, { type: "sell", quantity: "0.5", grossMinor: 6_500n, feeMinor: 100n })!
    expect(sold.quantityUnits).toBe(15n)
    expect(sold.quantityScale).toBe(10n)
    expect(sold.costBasisMinor).toBe(16_500n)
    expect(sold.realizedGainMinor).toBe(900n)
  })

  it("rejects oversells and insufficiently valid cash totals", () => {
    const position = { quantityUnits: 1n, quantityScale: 1n, costBasisMinor: 10_000n, brokerCashEffectMinor: 0n, realizedGainMinor: 0n }
    expect(applyWeightedAverageTrade(position, { type: "sell", quantity: "2", grossMinor: 20_000n, feeMinor: 0n })).toBeNull()
    expect(calculateTradeCashMinor("sell", "1", "1", 101n, 100)).toBeNull()
  })

  it("converts only with an explicit exact manual FX rate", () => {
    expect(convertNativeMinorToBaseMinor(100_000n, "1.28", 100, 100)).toBe(128_000n)
    expect(convertNativeMinorToBaseMinor(100_000n, null, 100, 100)).toBeNull()
    expect(convertNativeMinorToBaseMinor(100_000n, "0", 100, 100)).toBeNull()
  })

  it("uses the latest eligible manual price without destroying history", () => {
    const prices = [{ pricedAt: "2026-08-01", price: "550" }, { pricedAt: "2026-08-24", price: "620.50" }]
    expect(selectLatestManualPrice(prices, "2026-08-23")?.price).toBe("550")
    expect(selectLatestManualPrice(prices, "2026-08-24")?.price).toBe("620.50")
    expect(selectLatestManualPrice(prices, "2026-07-31")).toBeNull()
    expect(prices).toHaveLength(2)
  })

  it("shows a buy as internal value conversion apart from its fee", () => {
    const cashBefore = 100_000n
    const oldHoldingValue = 100_000n
    const buyCash = calculateTradeCashMinor("buy", "0.5", "560", 200n, 100)!
    const purchasedMarketValue = 28_000n
    expect(cashBefore + oldHoldingValue + buyCash + purchasedMarketValue).toBe(199_800n)
  })
})
