export type AnalyticsPeriodPreset =
  | "this_month"
  | "last_month"
  | "last_3_months"
  | "last_6_months"
  | "this_year"

export type AnalyticsPeriod = {
  startDate: string
  endDate: string
  previousStartDate: string
  previousEndDate: string
  trendGranularity: "day" | "month"
}

export const analyticsPeriodOptions: Array<{ value: AnalyticsPeriodPreset; label: string }> = [
  { value: "this_month", label: "This Month" },
  { value: "last_month", label: "Last Month" },
  { value: "last_3_months", label: "Last 3 Months" },
  { value: "last_6_months", label: "Last 6 Months" },
  { value: "this_year", label: "This Year" },
]

export function getDateInTimeZone(timezone: string, now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now)
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value
  return `${part("year")}-${part("month")}-${part("day")}`
}

export function getAnalyticsPeriod(preset: AnalyticsPeriodPreset, today: string): AnalyticsPeriod {
  const current = parseDate(today)
  const currentMonthStart = startOfMonth(current)

  if (preset === "this_month") {
    const previousMonthStart = addMonths(currentMonthStart, -1)
    const elapsedDay = current.getUTCDate()
    const previousEnd = new Date(Date.UTC(
      previousMonthStart.getUTCFullYear(),
      previousMonthStart.getUTCMonth(),
      Math.min(elapsedDay, daysInMonth(previousMonthStart)),
    ))
    return period(currentMonthStart, current, previousMonthStart, previousEnd, "day")
  }

  if (preset === "last_month") {
    const lastMonthStart = addMonths(currentMonthStart, -1)
    const previousMonthStart = addMonths(currentMonthStart, -2)
    return period(
      lastMonthStart,
      addDays(currentMonthStart, -1),
      previousMonthStart,
      addDays(lastMonthStart, -1),
      "day",
    )
  }

  if (preset === "this_year") {
    const yearStart = new Date(Date.UTC(current.getUTCFullYear(), 0, 1))
    const previousYearStart = new Date(Date.UTC(current.getUTCFullYear() - 1, 0, 1))
    const previousEnd = new Date(Date.UTC(
      current.getUTCFullYear() - 1,
      current.getUTCMonth(),
      Math.min(current.getUTCDate(), daysInMonth(new Date(Date.UTC(current.getUTCFullYear() - 1, current.getUTCMonth(), 1)))),
    ))
    return period(yearStart, current, previousYearStart, previousEnd, "month")
  }

  const monthCount = preset === "last_3_months" ? 3 : 6
  const start = addMonths(currentMonthStart, -(monthCount - 1))
  const inclusiveDayCount = differenceInDays(start, current) + 1
  const previousEnd = addDays(start, -1)
  const previousStart = addDays(previousEnd, -(inclusiveDayCount - 1))
  return period(start, current, previousStart, previousEnd, "month")
}

function period(
  start: Date,
  end: Date,
  previousStart: Date,
  previousEnd: Date,
  trendGranularity: "day" | "month",
): AnalyticsPeriod {
  return {
    startDate: formatDate(start),
    endDate: formatDate(end),
    previousStartDate: formatDate(previousStart),
    previousEndDate: formatDate(previousEnd),
    trendGranularity,
  }
}

function parseDate(value: string) {
  return new Date(`${value}T00:00:00Z`)
}

function formatDate(value: Date) {
  return value.toISOString().slice(0, 10)
}

function startOfMonth(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), 1))
}

function addMonths(value: Date, months: number) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + months, 1))
}

function addDays(value: Date, days: number) {
  const next = new Date(value)
  next.setUTCDate(next.getUTCDate() + days)
  return next
}

function differenceInDays(start: Date, end: Date) {
  return Math.round((end.getTime() - start.getTime()) / 86_400_000)
}

function daysInMonth(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + 1, 0)).getUTCDate()
}
