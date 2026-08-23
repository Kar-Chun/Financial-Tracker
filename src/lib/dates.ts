const shortDateFormatter = new Intl.DateTimeFormat("en-SG", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
})

const longDateFormatter = new Intl.DateTimeFormat("en-SG", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
})

export const unavailableDateLabel = "Date unavailable"

export function formatShortDate(isoDate: unknown) {
  const date = parseIsoCalendarDate(isoDate)
  return date ? shortDateFormatter.format(date) : unavailableDateLabel
}

export function formatLongDate(isoDate: unknown) {
  const date = parseIsoCalendarDate(isoDate)
  return date ? longDateFormatter.format(date) : unavailableDateLabel
}

export function isValidIsoCalendarDate(value: unknown): value is string {
  return parseIsoCalendarDate(value) !== null
}

export function getTodayDateInput(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

export function getDateInputInTimeZone(timezone: string, date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date)
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value
  return `${value("year")}-${value("month")}-${value("day")}`
}

export function getCurrentMonthInput(date = new Date()) {
  return getTodayDateInput(date).slice(0, 7)
}

export function getGreetingInTimeZone(timezone: string, date = new Date()) {
  const hour = Number(new Intl.DateTimeFormat("en-SG", {
    timeZone: timezone,
    hour: "2-digit",
    hourCycle: "h23",
  }).format(date))
  if (hour < 12) return "Good morning"
  if (hour < 18) return "Good afternoon"
  return "Good evening"
}

function parseIsoCalendarDate(value: unknown) {
  if (typeof value !== "string") return null
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day, 12))
  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) return null

  return date
}
