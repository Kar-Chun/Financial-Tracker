import { getDateInputInTimeZone } from "@/lib/dates"

export function getCurrentMonthStart(timezone: string, date = new Date()) {
  return `${getDateInputInTimeZone(timezone, date).slice(0, 7)}-01`
}

export function shiftMonthStart(monthStart: string, offset: number) {
  const [year, month] = monthStart.split("-").map(Number)
  const date = new Date(Date.UTC(year, month - 1 + offset, 1))
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-01`
}

export function formatBudgetMonth(monthStart: string) {
  const [year, month] = monthStart.split("-").map(Number)
  return new Intl.DateTimeFormat("en-SG", { month: "long", year: "numeric", timeZone: "UTC" })
    .format(new Date(Date.UTC(year, month - 1, 1, 12)))
}

export function getBudgetCalendarPosition(monthStart: string, localToday: string) {
  const nextMonth = shiftMonthStart(monthStart, 1)
  const monthTime = Date.parse(`${monthStart}T00:00:00Z`)
  const nextMonthTime = Date.parse(`${nextMonth}T00:00:00Z`)
  const todayTime = Date.parse(`${localToday}T00:00:00Z`)
  const daysInMonth = Math.round((nextMonthTime - monthTime) / 86_400_000)

  if (todayTime < monthTime) return { period: "future" as const, daysInMonth, elapsedDays: 0, remainingDaysIncludingToday: daysInMonth }
  if (todayTime >= nextMonthTime) return { period: "past" as const, daysInMonth, elapsedDays: daysInMonth, remainingDaysIncludingToday: 0 }

  const elapsedDays = Math.round((todayTime - monthTime) / 86_400_000) + 1
  return { period: "current" as const, daysInMonth, elapsedDays, remainingDaysIncludingToday: daysInMonth - elapsedDays + 1 }
}
