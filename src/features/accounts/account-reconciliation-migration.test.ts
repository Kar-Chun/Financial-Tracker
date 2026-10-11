import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

import { latestFunctionDefinition } from "@/test/migrations"

const read = (name: string) => readFileSync(`supabase/migrations/${name}.sql`, "utf8")
const sql = read("202609130001_add_account_reconciliation")
const reconcile = latestFunctionDefinition("reconcile_account_balance")

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
    expect(sql).toContain("from public, anon, authenticated")
  })
  it("serializes reconciliation, ordinary create/edit/delete, and permanent deletion before touching account state", () => {
    for (const name of ["reconcile_account_balance", "upsert_financial_transaction", "soft_delete_transaction", "delete_account_permanently"]) {
      const body = latestFunctionDefinition(name)
      expect(body).toContain("'ledgerly.transaction:' || v_user_id::text")
      const lock = body.indexOf("pg_catalog.pg_advisory_xact_lock")
      expect(lock).toBeGreaterThan(-1)
      const firstAccountRead = body.indexOf("from public.accounts")
      if (firstAccountRead > -1) expect(lock).toBeLessThan(firstAccountRead)
    }
  })
  it("rejects ordinary editing/deletion of reconciliation history", () => {
    expect(latestFunctionDefinition("upsert_financial_transaction")).toContain("where id = v_transaction_id and is_reconciliation")
    expect(latestFunctionDefinition("soft_delete_transaction")).toContain("where id = p_transaction_id and user_id = v_user_id and is_reconciliation")
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
})
