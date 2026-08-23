import { describe, expect, it } from "vitest"

import { formatLongDate, formatShortDate, isValidIsoCalendarDate, unavailableDateLabel } from "@/lib/dates"

describe("date formatting", () => {
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
