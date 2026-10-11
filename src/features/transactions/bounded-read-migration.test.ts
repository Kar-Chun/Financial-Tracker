import { describe, expect, it } from "vitest"

import { latestFunctionDefinition, migrationSources } from "@/test/migrations"

const migration = ["get_dashboard_data", "get_transactions_page"]
  .map((name) => latestFunctionDefinition(name)).join("\n").toLowerCase()
const migrationHistory = migrationSources.join("\n").toLowerCase()

describe("bounded Dashboard and transaction reads (static SQL checks)", () => {
  it("authenticates both RPCs and exposes them only to authenticated users", () => {
    for (const name of ["get_dashboard_data", "get_transactions_page"]) {
      const body = latestFunctionDefinition(name).toLowerCase()
      expect(body).toContain("v_user_id uuid := auth.uid()")
      expect(body).toContain("authentication is required")
    }
    expect(migrationHistory).toContain("revoke all on function public.get_transactions_page")
    expect(migrationHistory).toContain("grant execute on function public.get_transactions_page")
    expect(migrationHistory).toContain("revoke all on function public.get_dashboard_data() from public, anon")
    expect(migrationHistory).toContain("grant execute on function public.get_dashboard_data() to authenticated")
  })

  it("uses stable keyset pagination with a bounded look-ahead", () => {
    expect(migration).toContain("limit v_limit + 1")
    expect(migration).toContain("limit v_limit\n  ), serialized")
    expect(migration).toContain("(transaction_record.transaction_date, transaction_record.created_at, transaction_record.id)")
    expect(migration).toContain("< (p_cursor_transaction_date, p_cursor_created_at, p_cursor_id)")
    expect(migration).toContain("order by transaction_record.transaction_date desc, transaction_record.created_at desc, transaction_record.id desc")
  })

  it("applies all current Transaction filters before pagination", () => {
    expect(migration).toContain("transaction_record.deleted_at is null")
    expect(migration).toContain("transaction_record.transaction_date >= p_start_date")
    expect(migration).toContain("transaction_record.transaction_date <= p_end_date")
    expect(migration).toContain("transaction_record.transaction_type = p_transaction_type")
    expect(migration).toContain("transaction_record.category_id = p_category_id")
    expect(migration).toContain("filtered_entry.account_id = p_account_id")
  })

  it("retains readable historical account and category labels without weakening ownership", () => {
    expect(migration).toContain("left join public.categories category")
    expect(migration).toContain("category.user_id = v_user_id")
    expect(migration).toContain("join public.accounts account")
    expect(migration).toContain("account.user_id = v_user_id")
    expect(migration).not.toContain("category.archived_at is null")
    expect(migration).not.toContain("account.archived_at is null\n          where entry.transaction_id")
  })

  it("reuses authoritative spending and account-summary functions for the Dashboard", () => {
    expect(migration).toContain("perform public.refresh_snapshot_for_user(v_user_id)")
    expect(migration).toContain("v_analytics := public.get_spending_analytics(")
    expect(migration).toContain("from public.get_account_summaries() summary")
    expect(migration).toContain("transaction_record.transaction_type = 'income'")
    expect(migration).toContain("transaction_record.deleted_at is null")
    expect(migration).toContain("account.currency_code = v_profile.base_currency")
    expect(migration).toContain("transaction_record.transaction_date between v_month_start and v_month_end")
  })

  it("bounds recent rows and Net Worth history independently of lifetime data", () => {
    expect(migration).toContain("p_limit => 6")
    expect(migration).toContain("snapshot.snapshot_date between (v_today - 89) and v_today")
    expect(migration).toContain("limit 90")
  })
})
