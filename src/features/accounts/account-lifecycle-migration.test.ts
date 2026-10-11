import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

import { latestFunctionDefinition } from "@/test/migrations"

const migration = readFileSync(resolve("supabase/migrations/202608270001_add_safe_account_lifecycle.sql"), "utf8")
const lifecycleFunctions = ["archive_account", "restore_account", "delete_account_permanently"]
const archive = latestFunctionDefinition("archive_account")
const deletion = latestFunctionDefinition("delete_account_permanently")

describe("safe account lifecycle migration (static SQL checks)", () => {
  it("keeps archive on the existing authoritative represented-value formulas", () => {
    expect(archive).toContain("from public.get_account_summaries() summary")
    expect(archive).toContain("from public.get_detailed_investment_value(v_account.id, v_local_date) represented")
    expect(archive).toContain("v_account.opening_balance_minor")
    expect(archive).toContain("transaction_record.deleted_at is null")
    expect(archive).toContain("Account represented value must be zero before archiving.")
  })

  it("derives archive, restore, and deletion ownership from auth.uid", () => {
    for (const name of lifecycleFunctions) {
      const body = latestFunctionDefinition(name)
      expect(body).toContain("v_user_id uuid := auth.uid()")
      expect(body).toContain("account.user_id = v_user_id")
      expect(body).not.toContain("p_user_id")
    }
  })

  it("blocks active financial history before permanent deletion", () => {
    const activeCheck = deletion.indexOf("transaction_record.deleted_at is null")
    const accountDelete = deletion.indexOf("delete from public.accounts account")
    expect(activeCheck).toBeGreaterThan(-1)
    expect(accountDelete).toBeGreaterThan(activeCheck)
    expect(deletion).toContain("Account is used by %s active transaction%s.")
    expect(deletion).not.toContain("delete from public.transactions transaction_record\n    where transaction_record.deleted_at is null")
  })

  it("purges only complete already-soft-deleted transaction structures", () => {
    expect(deletion).toContain("transaction_record.deleted_at is not null")
    expect(deletion).toContain("delete from public.transactions transaction_record")
    expect(deletion).not.toContain("delete from public.transaction_entries")
  })

  it("removes only target-account Simple and Detailed investment data", () => {
    for (const table of [
      "investment_prices",
      "investment_trades",
      "investment_cash_events",
      "investment_holdings",
      "investment_valuations",
    ]) {
      expect(deletion).toContain(`delete from public.${table}`)
    }
    expect(deletion).toContain("trade.account_id = v_account.id")
    expect(deletion).toContain("cash_event.account_id = v_account.id")
    expect(deletion).toContain("holding.account_id = v_account.id")
    expect(deletion).not.toContain("delete from public.manual_fx_rates")
    expect(deletion).not.toContain("delete from public.categories")
    expect(deletion).not.toContain("delete from public.monthly_budgets")
    expect(deletion).not.toContain("delete from public.savings_goals")
  })

  it("preserves append-only ledgers except inside the exact scoped delete RPC", () => {
    const immutability = latestFunctionDefinition("prevent_investment_ledger_mutation")
    expect(immutability).toContain("current_setting('finance_tracker.account_delete_user_id', true) = old.user_id::text")
    expect(immutability).toContain("current_setting('finance_tracker.account_delete_account_id', true) = old.account_id::text")
    expect(immutability).toContain("raise exception 'Investment ledger entries are immutable")
  })

  it("refreshes today's snapshot but does not rewrite historical snapshots", () => {
    for (const name of lifecycleFunctions) {
      const body = latestFunctionDefinition(name)
      expect(body).toContain("perform public.refresh_snapshot_for_user(v_user_id)")
      expect(body).not.toContain("delete from public.net_worth_snapshots")
      expect(body).not.toContain("update public.net_worth_snapshots")
    }
  })

  it("keeps direct table deletes unavailable and grants only the lifecycle RPCs", () => {
    expect(migration).toContain("grant execute on function public.restore_account(uuid) to authenticated")
    expect(migration).toContain("grant execute on function public.delete_account_permanently(uuid) to authenticated")
    expect(migration).not.toMatch(/grant\s+delete\s+on\s+table/iu)
    expect(migration).not.toMatch(/grant\s+all\s+on\s+table/iu)
  })

  it("keeps archived accounts out of active summaries and selectors", () => {
    expect(latestFunctionDefinition("get_account_summaries")).toContain("where account.user_id = auth.uid() and account.archived_at is null")
  })
})
