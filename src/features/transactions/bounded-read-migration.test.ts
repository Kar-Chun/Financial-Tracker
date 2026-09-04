import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/202609040001_add_bounded_dashboard_and_transaction_reads.sql"),
  "utf8",
).toLowerCase()

describe("bounded Dashboard and transaction read migration", () => {
  it("authenticates both RPCs and exposes them only to authenticated users", () => {
    expect(migration).toContain("v_user_id uuid := auth.uid()")
    expect(migration.match(/authentication is required/g)).toHaveLength(2)
    expect(migration).toContain("security definer\nset search_path = ''")
    expect(migration).toContain("revoke all on function public.get_transactions_page")
    expect(migration).toContain("grant execute on function public.get_transactions_page")
    expect(migration).toContain("revoke all on function public.get_dashboard_data() from public, anon")
    expect(migration).toContain("grant execute on function public.get_dashboard_data() to authenticated")
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
