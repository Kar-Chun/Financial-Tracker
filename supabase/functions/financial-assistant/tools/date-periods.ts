export type PeriodPreset = "this_month" | "last_month" | "last_3_months" | "last_6_months" | "this_year" | "specific_month" | "custom"

export type ResolvedPeriod = {
  startDate: string
  endDate: string
  previousStartDate: string
  previousEndDate: string
  trendGranularity: "day" | "month"
}

export function resolvePeriod(args: Record<string, unknown>, today: string): ResolvedPeriod {
  const preset = stringValue(args.period ?? "this_month") as PeriodPreset
  const current = parseDate(today)
  const monthStart = startOfMonth(current)
  if (preset === "custom") {
    const start = requiredDate(args.start_date, "start_date")
    const end = requiredDate(args.end_date, "end_date")
    if (end < start || differenceInDays(start, end) > 3660) throw new Error("Custom date range is invalid.")
    const length = differenceInDays(start, end) + 1
    const previousEnd = addDays(start, -1)
    return period(start, end, addDays(previousEnd, -(length - 1)), previousEnd, length > 62 ? "month" : "day")
  }
  if (preset === "specific_month") {
    const selected = requiredDate(args.month_start, "month_start")
    if (selected.getUTCDate() !== 1) throw new Error("month_start must be the first day of a month.")
    const previous = addMonths(selected, -1)
    return period(selected, addDays(addMonths(selected, 1), -1), previous, addDays(selected, -1), "day")
  }
  if (preset === "this_month") {
    const previous = addMonths(monthStart, -1)
    const previousEnd = new Date(Date.UTC(previous.getUTCFullYear(), previous.getUTCMonth(), Math.min(current.getUTCDate(), daysInMonth(previous))))
    return period(monthStart, current, previous, previousEnd, "day")
  }
  if (preset === "last_month") {
    const selected = addMonths(monthStart, -1)
    const previous = addMonths(monthStart, -2)
    return period(selected, addDays(monthStart, -1), previous, addDays(selected, -1), "day")
  }
  if (preset === "this_year") {
    const start = new Date(Date.UTC(current.getUTCFullYear(), 0, 1))
    const previous = new Date(Date.UTC(current.getUTCFullYear() - 1, 0, 1))
    const previousEnd = new Date(Date.UTC(current.getUTCFullYear() - 1, current.getUTCMonth(), Math.min(current.getUTCDate(), daysInMonth(new Date(Date.UTC(current.getUTCFullYear() - 1, current.getUTCMonth(), 1))))))
    return period(start, current, previous, previousEnd, "month")
  }
  const count = preset === "last_3_months" ? 3 : preset === "last_6_months" ? 6 : 0
  if (!count) throw new Error("Unsupported period.")
  const start = addMonths(monthStart, -(count - 1))
  const days = differenceInDays(start, current) + 1
  const previousEnd = addDays(start, -1)
  return period(start, current, addDays(previousEnd, -(days - 1)), previousEnd, "month")
}

function period(start: Date, end: Date, previousStart: Date, previousEnd: Date, trendGranularity: "day" | "month"): ResolvedPeriod {
  return { startDate: formatDate(start), endDate: formatDate(end), previousStartDate: formatDate(previousStart), previousEndDate: formatDate(previousEnd), trendGranularity }
}
function requiredDate(value: unknown, name: string) { if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`${name} is invalid.`); return parseDate(value) }
function stringValue(value: unknown) { if (typeof value !== "string") throw new Error("Expected text value."); return value }
function parseDate(value: string) { const date = new Date(`${value}T00:00:00Z`); if (Number.isNaN(date.getTime())) throw new Error("Date is invalid."); return date }
function formatDate(value: Date) { return value.toISOString().slice(0, 10) }
function startOfMonth(value: Date) { return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), 1)) }
function addMonths(value: Date, months: number) { return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + months, 1)) }
function addDays(value: Date, days: number) { const result = new Date(value); result.setUTCDate(result.getUTCDate() + days); return result }
function differenceInDays(start: Date, end: Date) { return Math.round((end.getTime() - start.getTime()) / 86_400_000) }
function daysInMonth(value: Date) { return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + 1, 0)).getUTCDate() }

