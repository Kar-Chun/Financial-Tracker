import { describe, expect, it } from "vitest"

import { formatLongDate, formatShortDate, getDateInputInTimeZone, isValidIsoCalendarDate, unavailableDateLabel } from "@/lib/dates"

describe("date formatting", () => {
  it("resolves the date at a profile-timezone boundary", () => {
    const instant = new Date("2026-09-08T16:30:00Z")
    expect(getDateInputInTimeZone("Asia/Singapore", instant)).toBe("2026-09-09")
    expect(getDateInputInTimeZone("America/New_York", instant)).toBe("2026-09-08")
  })

  it("formats valid DATE values deterministically", () => {
    expect(formatShortDate("2026-08-23")).toBe("23 Aug")
    expect(formatLongDate("2026-08-23")).toBe("23 Aug 2026")
    expect(isValidIsoCalendarDate("2026-08-23")).toBe(true)
  })

  it.each([undefined, null, "", "not-a-date", "2026-02-30", 0])("does not throw for an invalid value: %s", (value) => {
    expect(() => formatShortDate(value)).not.toThrow()
    expect(formatShortDate(value)).toBe(unavailableDateLabel)
    expect(formatLongDate(value)).toBe(unavailableDateLabel)
    expect(isValidIsoCalendarDate(value)).toBe(false)
  })
})
