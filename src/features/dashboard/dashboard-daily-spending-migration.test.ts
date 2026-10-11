import { describe, expect, it } from "vitest"

import { latestFunctionDefinition } from "@/test/migrations"

const dashboard = latestFunctionDefinition("get_dashboard_data").toLowerCase()
const transactions = latestFunctionDefinition("get_transactions_page").toLowerCase()
const migration = dashboard + "\n" + transactions

describe("Dashboard daily spending (static SQL checks; execute rollback SQL for database behavior)", () => {
  it("uses the profile-local day and the authoritative seven-day fact range", () => {
    expect(migration).toContain("v_today := (current_timestamp at time zone v_profile.timezone)::date")
    expect(migration).toContain("from public.get_eligible_expense_facts(v_today - 6, v_today) fact")
    expect(migration).toContain("filter (where fact.transaction_date = v_today)")
    expect(migration).toContain("round(v_seven_day_spending_minor::numeric / 7)::bigint")
    expect(migration).toContain("'seven_day_average_minor', v_seven_day_average_minor")
  })

  it("filters the paginated drill-through through the same fact function", () => {
    expect(migration).toContain("p_eligible_spending boolean default false")
    expect(migration).toContain("select distinct fact.transaction_id")
    expect(migration).toContain("from public.get_eligible_expense_facts(")
    expect(migration).toContain("where eligible.transaction_id = transaction_record.id")
    expect(migration).toContain("limit v_limit + 1")
    expect(migration).toContain("eligible spending requires a bounded date range")
  })

})
