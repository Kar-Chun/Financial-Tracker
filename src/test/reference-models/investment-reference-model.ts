import { parseExactDecimal } from "@/features/investments/investment-logic"

export type LedgerTrade = {
  type: "opening_position" | "buy" | "sell"
  quantity: string
  grossMinor: bigint
  feeMinor: bigint
}

export type LedgerPosition = {
  quantityUnits: bigint
  quantityScale: bigint
  costBasisMinor: bigint
  brokerCashEffectMinor: bigint
  realizedGainMinor: bigint
}

export function applyWeightedAverageTrade(position: LedgerPosition, trade: LedgerTrade): LedgerPosition | null {
  const parsed = parseExactDecimal(trade.quantity)
  if (!parsed || parsed.units <= 0n || trade.grossMinor < 0n || trade.feeMinor < 0n) return null
  const commonScale = lcm(position.quantityScale, parsed.scale)
  const currentUnits = position.quantityUnits * (commonScale / position.quantityScale)
  const tradeUnits = parsed.units * (commonScale / parsed.scale)

  if (trade.type === "sell") {
    if (tradeUnits > currentUnits || currentUnits === 0n || trade.feeMinor > trade.grossMinor) return null
    const removedBasis = divideRounded(position.costBasisMinor * tradeUnits, currentUnits)
    const proceeds = trade.grossMinor - trade.feeMinor
    return {
      quantityUnits: currentUnits - tradeUnits,
      quantityScale: commonScale,
      costBasisMinor: position.costBasisMinor - removedBasis,
      brokerCashEffectMinor: position.brokerCashEffectMinor + proceeds,
      realizedGainMinor: position.realizedGainMinor + proceeds - removedBasis,
    }
  }

  const acquiredBasis = trade.grossMinor + (trade.type === "buy" ? trade.feeMinor : 0n)
  return {
    quantityUnits: currentUnits + tradeUnits,
    quantityScale: commonScale,
    costBasisMinor: position.costBasisMinor + acquiredBasis,
    brokerCashEffectMinor: position.brokerCashEffectMinor + (trade.type === "buy" ? -acquiredBasis : 0n),
    realizedGainMinor: position.realizedGainMinor,
  }
}

export function calculateDetailedNativeValue(
  openingCashMinor: bigint,
  postBoundaryTransfersMinor: bigint,
  tradeCashMinor: bigint,
  cashEventsMinor: bigint,
  holdingValuesMinor: readonly bigint[],
) {
  return openingCashMinor + postBoundaryTransfersMinor + tradeCashMinor + cashEventsMinor
    + holdingValuesMinor.reduce((total, value) => total + value, 0n)
}

export function calculateSimpleInvestmentValue(latestValuationMinor: bigint, postValuationTransfersMinor: bigint) {
  return latestValuationMinor + postValuationTransfersMinor
}

export function convertNativeMinorToBaseMinor(
  nativeMinor: bigint,
  rate: string | null,
  nativeMinorScale: number,
  baseMinorScale: number,
) {
  if (rate === null) return null
  const parsed = parseExactDecimal(rate, 12)
  if (!parsed || parsed.units <= 0n) return null
  return divideRounded(
    nativeMinor * parsed.units * BigInt(baseMinorScale),
    parsed.scale * BigInt(nativeMinorScale),
  )
}

export function selectLatestManualPrice<T extends { pricedAt: string }>(prices: readonly T[], asOfDate: string) {
  return prices
    .filter((item) => item.pricedAt <= asOfDate)
    .toSorted((left, right) => right.pricedAt.localeCompare(left.pricedAt))[0] ?? null
}

function divideRounded(numerator: bigint, denominator: bigint) {
  if (denominator <= 0n) throw new Error("A positive denominator is required.")
  return (numerator + denominator / 2n) / denominator
}

function gcd(left: bigint, right: bigint): bigint {
  return right === 0n ? left : gcd(right, left % right)
}

function lcm(left: bigint, right: bigint) {
  return (left / gcd(left, right)) * right
}
