const configuredMinorUnits: Record<string, number> = {
  SGD: 2,
  USD: 2,
}

export const supportedCurrencies = [
  { code: "SGD", label: "Singapore Dollar" },
  { code: "USD", label: "US Dollar" },
] as const

export function getMinorUnitDigits(currencyCode: string) {
  const code = currencyCode.toUpperCase()
  const configured = configuredMinorUnits[code]
  if (configured !== undefined) return configured

  return new Intl.NumberFormat("en", {
    style: "currency",
    currency: code,
  }).resolvedOptions().maximumFractionDigits ?? 2
}

export function parseCurrencyToMinor(
  input: string,
  currencyCode: string,
  options: { allowNegative?: boolean } = {},
) {
  const normalized = input.trim().replaceAll(",", "")
  const match = /^([+-]?)(\d+)(?:\.(\d*))?$/.exec(normalized)

  if (!match) {
    throw new Error("Enter a valid amount using digits and a decimal point.")
  }

  const [, sign, wholePart, fractionPart = ""] = match
  if (sign === "-" && !options.allowNegative) {
    throw new Error("Amount cannot be negative.")
  }

  const minorDigits = getMinorUnitDigits(currencyCode)
  if (fractionPart.length > minorDigits) {
    throw new Error(`${currencyCode.toUpperCase()} supports ${minorDigits} decimal places.`)
  }

  const scale = 10n ** BigInt(minorDigits)
  const wholeMinor = BigInt(wholePart) * scale
  const paddedFraction = fractionPart.padEnd(minorDigits, "0") || "0"
  const fractionMinor = BigInt(paddedFraction)
  const signedMinor = (sign === "-" ? -1n : 1n) * (wholeMinor + fractionMinor)

  if (signedMinor > BigInt(Number.MAX_SAFE_INTEGER) || signedMinor < BigInt(Number.MIN_SAFE_INTEGER)) {
    throw new Error("Amount is too large to process safely.")
  }

  return Number(signedMinor)
}

export function formatCurrency(amountInMinorUnits: number, currencyCode = "SGD") {
  assertSafeMinorUnits(amountInMinorUnits)
  const minorDigits = getMinorUnitDigits(currencyCode)
  const scale = 10 ** minorDigits

  return new Intl.NumberFormat("en-SG", {
    style: "currency",
    currency: currencyCode.toUpperCase(),
    minimumFractionDigits: minorDigits,
    maximumFractionDigits: minorDigits,
  }).format(amountInMinorUnits / scale)
}

export function formatSignedCurrency(amountInMinorUnits: number, currencyCode = "SGD") {
  const formatted = formatCurrency(amountInMinorUnits, currencyCode)
  return amountInMinorUnits > 0 ? `+${formatted}` : formatted
}

export function minorUnitsToInput(amountInMinorUnits: number, currencyCode: string) {
  assertSafeMinorUnits(amountInMinorUnits)
  const digits = getMinorUnitDigits(currencyCode)
  const scale = 10n ** BigInt(digits)
  const absolute = BigInt(Math.abs(amountInMinorUnits))
  const whole = absolute / scale
  const fraction = (absolute % scale).toString().padStart(digits, "0")
  const sign = amountInMinorUnits < 0 ? "-" : ""

  return digits === 0 ? `${sign}${whole}` : `${sign}${whole}.${fraction}`
}

function assertSafeMinorUnits(amount: number) {
  if (!Number.isSafeInteger(amount)) {
    throw new Error("Currency amounts must be safe integers in minor units.")
  }
}
