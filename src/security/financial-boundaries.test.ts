import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

import { getErrorMessage } from "@/lib/errors"

const read = (name: string) => readFileSync(resolve(process.cwd(), "supabase/migrations", name), "utf8").replaceAll("\r\n", "\n")
const migration = read("202609260001_harden_financial_input_boundaries.sql")
function definition(sql: string, name: string) {
  const match = sql.match(new RegExp(`create or replace function public\\.${name}\\([\\s\\S]*?\\$\\$;`))
  if (!match) throw new Error(`Missing SQL definition: ${name}`)
  return match[0]
}

describe("Phase 1 migration boundaries (static checks; execute the rollback SQL for database behavior)", () => {
  it("adds the ordinary-account guard before writes while preserving the entire previous RPC", () => {
    const current = definition(migration, "upsert_financial_transaction")
    const guard = "    if v_source.account_type not in ('bank', 'cash') then\n      raise exception using errcode = '22023', message = 'Expense and Income require a Bank or Cash account.';\n    end if;\n\n"
    expect(current).toContain("if p_transaction_type in ('expense', 'income') then\n" + guard)
    expect(current.replace(guard, "")).toBe(definition(read("202609130001_add_account_reconciliation.sql"), "upsert_financial_transaction"))
    expect(current.indexOf(guard)).toBeLessThan(current.indexOf("insert into public.transactions"))
  })

  it("adds deferred integrity protection without modifying transfer, category or reconciliation checks", () => {
    const current = definition(migration, "validate_transaction_integrity")
    expect(current).toContain("if v_type in ('expense', 'income') and exists")
    const unchanged = current.replace(/  if v_type in \('expense', 'income'\) and exists \([\s\S]*?  end if;\n\n/, "")
    expect(unchanged).toBe(definition(read("202608220002_create_financial_functions.sql"), "validate_transaction_integrity"))
    expect(migration).not.toMatch(/create or replace function public\.(reconcile_account_balance|archive_account|delete_account_permanently|refresh_snapshot_for_user)/)
  })

  it("changes eligible spending only by excluding unsupported ordinary account types", () => {
    const current = definition(migration, "get_eligible_expense_facts")
    expect(current.replace("\n    and account.account_type in ('bank', 'cash')", ""))
      .toBe(definition(read("202609040002_centralize_eligible_spending.sql"), "get_eligible_expense_facts"))
  })

  it("checks finite values before numeric comparisons and rejects rather than rounds input", () => {
    const helper = definition(migration, "validate_investment_numeric")
    expect(helper).toContain("v_value::text in ('NaN', 'Infinity', '-Infinity')")
    expect(helper.indexOf("v_value::text in")).toBeLessThan(helper.indexOf("if v_value < 0"))
    expect(helper).toContain("v_value <> pg_catalog.trunc(v_value, p_scale)")
    expect(helper).toContain("pg_catalog.power(10::numeric, (30 - p_scale)::numeric)")
    expect(helper).toContain("return v_value;")
    expect(helper).not.toMatch(/v_value\s*:=\s*(?:round|trunc|pg_catalog\.)/)
    expect(helper).toContain("exception when invalid_text_representation or numeric_value_out_of_range")
  })

  it.each([
    ["preview_detailed_investment_conversion", "validate_opening_investment_numbers(p_holdings)", "v_detailed_value :="],
    ["enable_detailed_investment_tracking", "validate_opening_investment_numbers(p_holdings)", "update public.accounts"],
    ["record_investment_trade", "validate_investment_numeric(p_unit_price::text, 10)", "v_gross :="],
    ["update_investment_prices", "validate_investment_numeric(v_item->>'price', 10)", "insert into public.investment_prices"],
    ["upsert_manual_fx_rate", "validate_investment_numeric(p_rate::text, 12)", "insert into public.manual_fx_rates"],
  ])("validates %s before authoritative arithmetic/storage", (name, validation, operation) => {
    const current = definition(migration, name)
    expect(current.indexOf(validation)).toBeGreaterThan(0)
    expect(current.indexOf(validation)).toBeLessThan(current.indexOf(operation))
  })

  it("keeps all numeric formulas unchanged and adds validation only to investment RPCs", () => {
    const original = read("202608240003_add_detailed_investment_ledger.sql")
    const checks = new Map([
      ["preview_detailed_investment_conversion", "  perform public.validate_opening_investment_numbers(p_holdings);\n"],
      ["enable_detailed_investment_tracking", "  -- Validate the complete batch before changing the account or any ledger row.\n  perform public.validate_opening_investment_numbers(p_holdings);\n\n"],
      ["record_investment_trade", "  perform public.validate_investment_numeric(p_quantity::text, 10);\n  perform public.validate_investment_numeric(p_unit_price::text, 10);\n"],
      ["update_investment_prices", "  -- Validate every price before storing any price in the batch.\n  for v_item in select value from jsonb_array_elements(p_prices) loop\n    perform public.validate_investment_numeric(v_item->>'price', 10);\n  end loop;\n"],
      ["upsert_manual_fx_rate", "  perform public.validate_investment_numeric(p_rate::text, 12);\n"],
    ])
    for (const [name, added] of checks) {
      expect(definition(migration, name).replace(added, ""), name).toBe(definition(original, name))
    }
  })

  it("keeps new validators and eligible facts internal, with no grants or historical repair", () => {
    expect(migration).toContain("public.validate_opening_investment_numbers(jsonb) from public, anon, authenticated")
    expect(migration).toContain("revoke all on function public.get_eligible_expense_facts(date, date) from public, anon, authenticated")
    expect(migration).not.toMatch(/\bgrant\b|disable row level security|drop (?:table|policy|trigger)/i)
    const outsideFunctions = migration.replace(/create or replace function[\s\S]*?\$\$;/g, "")
    expect(outsideFunctions).not.toMatch(/^\s*(?:update|delete|insert|truncate)\b/im)
  })

  it.each([
    ["Expense and Income require a Bank or Cash account.", "Choose a Bank or Cash account for an expense or income."],
    ["Investment number must be finite.", "Enter a valid investment value within the supported precision and range."],
    ["Investment number is outside the supported precision or range.", "Enter a valid investment value within the supported precision and range."],
  ])("maps a safe domain error without exposing SQL input: %s", (message, expected) => {
    expect(getErrorMessage({ message }, "Could not save.")).toBe(expected)
    expect(getErrorMessage({ message: "invalid input syntax for type numeric: private value" }, "Could not save.")).toBe("Could not save.")
  })
})
