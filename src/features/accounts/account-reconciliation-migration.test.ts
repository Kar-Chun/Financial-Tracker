import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const read = (name: string) => readFileSync(`supabase/migrations/${name}.sql`, "utf8")
const sql = read("202609130001_add_account_reconciliation")
const ordinary = read("202608220002_create_financial_functions")
const spending = read("202609040002_centralize_eligible_spending")
const dashboard = read("202609090001_add_dashboard_today_spending")
const notes = read("202609100001_add_transaction_note_suggestions")
const start = sql.indexOf("create function public.reconcile_account_balance")
const reconcile = sql.slice(start, sql.indexOf("-- Existing ordinary mutation bodies", start))

describe("reconciliation database contract (static; executable SQL verification is separate)", () => {
  it("uses the existing represented balance and snapshot helpers, without a second balance formula", () => {
    expect(reconcile).toContain("from public.get_account_summaries()")
    expect(reconcile).not.toContain("sum(")
    expect(reconcile).toContain("v_difference := p_actual_balance_minor - v_current")
    expect(reconcile).toContain("perform public.refresh_snapshot_for_user(v_user_id)")
    expect(reconcile).toContain("(current_timestamp at time zone v_timezone)::date")
    expect(reconcile).toContain("v_today <> (clock_timestamp() at time zone v_timezone)::date")
    expect(reconcile.indexOf("if v_difference = 0")).toBeLessThan(reconcile.indexOf("insert into public.transactions"))
  })
  it("derives ownership and enforces Bank/Cash, active, currency, range and stale-preview validation", () => {
    for (const guard of ["auth.uid()", "user_id = v_user_id for update", "v_account.archived_at is not null",
      "v_account.account_type not in ('bank', 'cash')", "p_expected_currency_code is distinct from v_account.currency_code",
      "v_current <> p_expected_current_balance_minor", "9007199254740991", "errcode = '40001'"]) {
      expect(reconcile).toContain(guard)
    }
    expect(sql).not.toContain("p_user_id")
    expect(sql).not.toMatch(/execute\s+format|grant\s+(insert|update|delete|all).*on table/i)
    expect(sql.match(/security definer\n? ?set search_path = ''/g)).toHaveLength(4)
    expect(sql).toContain("from public, anon, authenticated")
  })
  it("serializes reconciliation, ordinary create/edit/delete, and permanent deletion before touching account state", () => {
    expect(sql.match(/pg_catalog.pg_advisory_xact_lock/g)).toHaveLength(4)
    for (const name of ["reconcile_account_balance", "upsert_financial_transaction", "soft_delete_transaction", "delete_account_permanently"]) {
      const body = sql.slice(sql.indexOf(`function public.${name}(`)).split("$$;")[0]
      expect(body).toContain("'ledgerly.transaction:' || v_user_id::text")
      const lock = body.indexOf("pg_catalog.pg_advisory_xact_lock")
      const firstAccountRead = body.indexOf("from public.accounts")
      if (firstAccountRead > -1) expect(lock).toBeLessThan(firstAccountRead)
    }
  })
  it("preserves ordinary mutation arithmetic and rejects reconciliation editing/deletion", () => {
    const entryWrites = (source: string) => source.slice(source.indexOf("  if p_transaction_type = 'expense' then"), source.indexOf("create or replace function public.soft_delete_transaction"))
    expect(entryWrites(sql)).toBe(entryWrites(ordinary))
    expect(sql).toContain("where id = v_transaction_id and is_reconciliation")
    expect(sql).toContain("where id = p_transaction_id and user_id = v_user_id and is_reconciliation")
    expect(sql).toContain("create trigger protect_reconciliation_history before update or delete")
    expect(sql).toContain("Reconciliation requires one Bank or Cash entry.")
  })
  it("purges only marked single-account reconciliations and preserves ordinary history blocking", () => {
    expect(sql).toContain("and not transaction_record.is_reconciliation")
    expect(sql).toContain("Account is used by %s active transaction%s.")
    expect(sql).toContain("t.user_id = v_user_id and t.is_reconciliation")
    expect(sql).toContain("other_entry.account_id <> v_account.id")
    expect(sql).toContain("transaction_record.deleted_at is not null")
    expect(sql).not.toContain("delete from public.net_worth_snapshots")
    expect(sql).not.toContain("delete from public.manual_fx_rates")
  })
  it("keeps all spending consumers on expense facts and income/notes restricted by type", () => {
    expect(spending).toContain("transaction_record.transaction_type = 'expense'")
    expect(dashboard).toContain("from public.get_eligible_expense_facts(v_today - 6, v_today)")
    expect(dashboard).toContain("transaction_record.transaction_type = 'income'")
    expect(notes).toContain("p_transaction_type not in ('expense', 'income')")
    expect(notes).toContain("transaction_record.transaction_type = p_transaction_type")
    expect(sql).not.toMatch(/(create|replace).*function public\.(get_spending_analytics|get_monthly_budget_summary|get_dashboard_data|get_eligible_expense_facts|get_transaction_note_suggestions|get_detailed_investment_value)/)
  })
})
