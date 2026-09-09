import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

import { getDateInputInTimeZone } from "@/lib/dates"

const migration = readFileSync(
  resolve("supabase/migrations/202609090001_add_dashboard_today_spending.sql"),
  "utf8",
).toLowerCase()

describe("Dashboard daily spending migration", () => {
  it("uses the profile-local day and the authoritative seven-day fact range", () => {
    expect(migration).toContain("v_today := (current_timestamp at time zone v_profile.timezone)::date")
    expect(migration).toContain("from public.get_eligible_expense_facts(v_today - 6, v_today) fact")
    expect(migration).toContain("filter (where fact.transaction_date = v_today)")
    expect(migration).toContain("round(v_seven_day_spending_minor::numeric / 7)::bigint")
    expect(migration).toContain("'seven_day_average_minor', v_seven_day_average_minor")
  })

  it("keeps the Dashboard bounded and snapshot self-healing", () => {
    expect(migration).toContain("perform public.refresh_snapshot_for_user(v_user_id)")
    expect(migration).toContain("p_limit => 6")
    expect(migration).toContain("snapshot.snapshot_date between (v_today - 89) and v_today")
    expect(migration).toContain("limit 90")
    expect(migration).not.toContain("p_user_id")
  })

  it("filters the paginated drill-through through the same fact function", () => {
    expect(migration).toContain("p_eligible_spending boolean default false")
    expect(migration).toContain("select distinct fact.transaction_id")
    expect(migration).toContain("from public.get_eligible_expense_facts(")
    expect(migration).toContain("where eligible.transaction_id = transaction_record.id")
    expect(migration).toContain("limit v_limit + 1")
    expect(migration).toContain("eligible spending requires a bounded date range")
  })

  it("keeps both read RPCs authenticated and search-path hardened", () => {
    expect(migration.match(/v_user_id uuid := auth\.uid\(\)/g)).toHaveLength(2)
    expect(migration.match(/security definer\nset search_path = ''/g)).toHaveLength(2)
    expect(migration).toContain("grant execute on function public.get_dashboard_data() to authenticated")
    expect(migration).toContain("grant execute on function public.get_transactions_page")
    expect(migration).not.toMatch(/\bexecute\s+(?:format\s*\(|\()/u)
  })

  it("resolves the current date at a profile-timezone boundary", () => {
    const instant = new Date("2026-09-08T16:30:00Z")
    expect(getDateInputInTimeZone("Asia/Singapore", instant)).toBe("2026-09-09")
    expect(getDateInputInTimeZone("America/New_York", instant)).toBe("2026-09-08")
  })
})

type SpendingFixture = {
  amountMinor: number
  currency: "SGD" | "USD"
  date: string
  deleted: boolean
  id: string
  type: "expense" | "income" | "transfer" | "refund" | "adjustment"
}

const facts: SpendingFixture[] = [
  { id: "today", date: "2026-09-09", type: "expense", deleted: false, currency: "SGD", amountMinor: 1_840 },
  { id: "day-3", date: "2026-09-07", type: "expense", deleted: false, currency: "SGD", amountMinor: 2_500 },
  { id: "day-5", date: "2026-09-05", type: "expense", deleted: false, currency: "SGD", amountMinor: 1_500 },
  { id: "day-6", date: "2026-09-04", type: "expense", deleted: false, currency: "SGD", amountMinor: 4_000 },
  { id: "day-7", date: "2026-09-03", type: "expense", deleted: false, currency: "SGD", amountMinor: 5_070 },
  { id: "transfer", date: "2026-09-09", type: "transfer", deleted: false, currency: "SGD", amountMinor: 9_000 },
  { id: "income", date: "2026-09-09", type: "income", deleted: false, currency: "SGD", amountMinor: 10_000 },
  { id: "deleted", date: "2026-09-09", type: "expense", deleted: true, currency: "SGD", amountMinor: 2_000 },
  { id: "foreign", date: "2026-09-09", type: "expense", deleted: false, currency: "USD", amountMinor: 3_000 },
  { id: "refund", date: "2026-09-09", type: "refund", deleted: false, currency: "SGD", amountMinor: 400 },
  { id: "adjustment", date: "2026-09-09", type: "adjustment", deleted: false, currency: "SGD", amountMinor: 500 },
]

function eligible(startDate: string, endDate: string) {
  return facts.filter((fact) => fact.type === "expense"
    && !fact.deleted
    && fact.currency === "SGD"
    && fact.date >= startDate
    && fact.date <= endDate)
}

describe("daily spending regression fixture", () => {
  it("counts only today's eligible spending and matches drill-through rows", () => {
    const today = eligible("2026-09-09", "2026-09-09")
    expect(today.map(({ id }) => id)).toEqual(["today"])
    expect(today.reduce((total, fact) => total + fact.amountMinor, 0)).toBe(1_840)
  })

  it("divides the complete seven-day total by seven, including zero days", () => {
    const sevenDayTotal = eligible("2026-09-03", "2026-09-09")
      .reduce((total, fact) => total + fact.amountMinor, 0)
    expect(sevenDayTotal).toBe(14_910)
    expect(Math.round(sevenDayTotal / 7)).toBe(2_130)
  })

  it("returns zero totals when the bounded period has no eligible spending", () => {
    expect(eligible("2026-10-01", "2026-10-07")).toEqual([])
    expect(eligible("2026-10-07", "2026-10-07").reduce((total, fact) => total + fact.amountMinor, 0)).toBe(0)
  })
})
