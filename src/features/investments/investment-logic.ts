const DECIMAL_PATTERN = /^(?:0|[1-9]\d*)(?:\.(\d+))?$/

export function parseExactDecimal(
  value: string,
  maximumDecimals = 10,
  maximumIntegerDigits = 30 - maximumDecimals,
) {
  const normalized = value.trim()
  const match = DECIMAL_PATTERN.exec(normalized)
  const integerPart = normalized.split(".", 1)[0]
  if (
    !match
    || integerPart.length > maximumIntegerDigits
    || (match[1]?.length ?? 0) > maximumDecimals
  ) return null
  const decimals = match[1]?.length ?? 0
  const scale = 10n ** BigInt(decimals)
  const units = BigInt(normalized.replace(".", ""))
  return { units, scale, normalized }
}

export function normalizeInvestmentDecimal(
  value: string,
  options: { maximumDecimals?: number; allowZero?: boolean } = {},
) {
  const maximumDecimals = options.maximumDecimals ?? 10
  const parsed = parseExactDecimal(value, maximumDecimals)
  if (!parsed || (!options.allowZero && parsed.units === 0n)) return null
  return parsed.normalized
}

export function multiplyDecimalToMinorUnits(quantity: string, unitPrice: string, minorScale: number) {
  const quantityValue = parseExactDecimal(quantity)
  const priceValue = parseExactDecimal(unitPrice)
  if (!quantityValue || !priceValue || quantityValue.units <= 0n || priceValue.units < 0n) return null
  const numerator = quantityValue.units * priceValue.units * BigInt(minorScale)
  const denominator = quantityValue.scale * priceValue.scale
  return divideRounded(numerator, denominator)
}

export function calculateTradeCashMinor(
  type: "buy" | "sell",
  quantity: string,
  unitPrice: string,
  feeMinor: bigint,
  minorScale: number,
) {
  const gross = multiplyDecimalToMinorUnits(quantity, unitPrice, minorScale)
  if (gross === null || feeMinor < 0n) return null
  if (type === "sell" && feeMinor > gross) return null
  return type === "buy" ? -(gross + feeMinor) : gross - feeMinor
}

function divideRounded(numerator: bigint, denominator: bigint) {
  if (denominator <= 0n) throw new Error("A positive denominator is required.")
  return (numerator + denominator / 2n) / denominator
}
