import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

import { getErrorMessage } from "@/lib/errors"
import { latestFunctionDefinition } from "@/test/migrations"

const read = (name: string) => readFileSync(resolve(process.cwd(), "supabase/migrations", name), "utf8").replaceAll("\r\n", "\n")
const migration = read("202609260001_harden_financial_input_boundaries.sql")
function definition(name: string) {
  return latestFunctionDefinition(name).replaceAll("\r\n", "\n")
}

describe("financial input boundaries (static checks; execute the rollback SQL for database behavior)", () => {
  it("guards ordinary Expense/Income account types before writes", () => {
    const current = definition("upsert_financial_transaction")
    const guard = "    if v_source.account_type not in ('bank', 'cash') then\n      raise exception using errcode = '22023', message = 'Expense and Income require a Bank or Cash account.';\n    end if;\n\n"
    expect(current).toContain("if p_transaction_type in ('expense', 'income') then\n" + guard)
    expect(current.indexOf(guard)).toBeLessThan(current.indexOf("insert into public.transactions"))
  })

  it("enforces ordinary account types in deferred ledger validation", () => {
    const current = definition("validate_transaction_integrity")
    expect(current).toContain("if v_type in ('expense', 'income') and exists")
    expect(current).toContain("account.account_type not in ('bank', 'cash')")
  })

  it("checks finite values before numeric comparisons and rejects rather than rounds input", () => {
    const helper = definition("validate_investment_numeric")
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
    const current = definition(name)
    expect(current.indexOf(validation)).toBeGreaterThan(0)
    expect(current.indexOf(validation)).toBeLessThan(current.indexOf(operation))
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
