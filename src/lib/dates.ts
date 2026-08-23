const shortDateFormatter = new Intl.DateTimeFormat("en-SG", {
  day: "numeric",
  month: "short",
})

export function formatShortDate(isoDate: string) {
  return shortDateFormatter.format(new Date(`${isoDate}T12:00:00`))
}

export function formatLongDate(isoDate: string) {
  return new Intl.DateTimeFormat("en-SG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${isoDate}T12:00:00`))
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
