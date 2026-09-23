import { strFromU8, unzipSync } from "fflate"
import { describe, expect, it } from "vitest"
import { makeExportFixture } from "@/test/fixtures/export-v1"
import { buildExportFiles, createExportZip, csvCell, csvPath, decimalAmount } from "./export-package"
import { exportResponseSchema, exportTables } from "./export-schema"

describe("version 1 export fidelity", () => {
  it("preserves every stored field, relationship and exact value in valid JSON", () => {
    const response = exportResponseSchema.parse(makeExportFixture())
    const backup = JSON.parse(buildExportFiles(response, null)["backup.json"])
    expect(backup.data).toEqual(response.data)
    expect(backup.format).toBe("ledgerly-backup")
    expect(backup.version).toBe(1)
    expect(backup.data.accounts[1].archived_at).not.toBeNull()
    expect(backup.data.categories[1].parent_id).toBe(backup.data.categories[0].id)
    expect(backup.data.transactions[2].deleted_at).not.toBeNull()
    expect(backup.data.transactions[1]).toMatchObject({ transaction_type: "adjustment", is_reconciliation: true })
    expect(backup.data.transaction_entries.filter((row: { transaction_id: string }) =>
      row.transaction_id === backup.data.transactions[0].id).map((row: { amount_minor: string }) => row.amount_minor))
      .toEqual(["-550", "550"])
    expect(backup.data.category_budgets[0].monthly_budget_id).toBe(backup.data.monthly_budgets[0].id)
    expect(backup.data.goal_allocations.map((row: { amount_minor: string }) => row.amount_minor)).toEqual(["350", "-100"])
    expect(backup.data.investment_valuations[0].account_id).not.toBe(backup.data.investment_trades[0].account_id)
    expect(backup.data.net_worth_snapshots).toEqual(response.data.net_worth_snapshots)
  })

  it("retains minor units beyond the JS safe integer range and decimal precision", () => {
    const response = makeExportFixture()
    const files = buildExportFiles(response, null)
    expect(files["backup.json"]).toContain('"opening_balance_minor": "9007199254740993"')
    expect(files["backup.json"]).toContain('"quantity": "12345678901234567890.1234567890"')
    expect(files["backup.json"]).toContain('"unit_price": "231.1234567890"')
    expect(files["backup.json"]).toContain('"rate": "1.354712345678"')
    expect(files["csv/transaction_entries.csv"]).toContain('"-90071992547409.93"')
    expect(decimalAmount("9007199254740993", "SGD")).toBe("90071992547409.93")
    expect(decimalAmount("-1", "SGD")).toBe("-0.01")
    expect(decimalAmount("123", "JPY")).toBe("123")
  })

  it("rejects JS numbers for every money and investment decimal field", () => {
    const fixture = makeExportFixture()
    for (const [table, rows] of Object.entries(fixture.data)) {
      for (const key of Object.keys(rows[0])) {
        if (!key.endsWith("_minor") && !["quantity", "unit_price", "price", "rate"].includes(key)) continue
        const altered = structuredClone(fixture)
        const data = altered.data as unknown as Record<string, Record<string, unknown>[]>
        data[table][0][key] = 1.23
        expect(exportResponseSchema.safeParse(altered).success, `${table}.${key}`).toBe(false)
      }
    }
  })

  it("rejects incomplete counts, missing collections and unexpected credential fields", () => {
    const fixture = makeExportFixture()
    expect(exportResponseSchema.safeParse({ ...fixture, record_counts: { ...fixture.record_counts, accounts: 99 } }).success).toBe(false)
    const { transaction_entries: _omitted, ...partialData } = fixture.data
    expect(exportResponseSchema.safeParse({ ...fixture, data: partialData }).success).toBe(false)
    for (const field of ["push_subscriptions", "notification_deliveries", "access_token", "refresh_token", "password"]) {
      expect(exportResponseSchema.safeParse({ ...fixture, [field]: "secret" }).success).toBe(false)
    }
    expect(exportResponseSchema.safeParse({ ...fixture, data: { ...fixture.data,
      profiles: [{ ...fixture.data.profiles[0], access_token: "secret" }],
    } }).success).toBe(false)
  })

  it("lists all files and correct record counts, including empty collection CSV headers", () => {
    const fixture = makeExportFixture()
    fixture.data.notification_preferences = []
    fixture.record_counts.notification_preferences = 0
    const files = buildExportFiles(fixture, fixture.data.accounts[0].id)
    const manifest = JSON.parse(files["manifest.json"])
    expect(manifest).toMatchObject({ format: "ledgerly-export", version: 1, derived_history: ["net_worth_snapshots"] })
    expect(manifest.files).toEqual(Object.keys(files).sort())
    for (const table of exportTables) {
      expect(manifest.record_counts[table]).toBe(fixture.data[table].length)
      expect(files[csvPath(table)]).toBeDefined()
    }
    expect(files["csv/notification_preferences.csv"].trim().split("\r\n")).toHaveLength(1)
    expect(JSON.parse(files["backup.json"]).device_preferences.last_expense_account_id).toBe(fixture.data.accounts[0].id)
    expect(files["README.txt"]).toContain("Import/Restore is not currently supported")
  })

  it.each([
    ["Rice, tea", '"Rice, tea"'],
    ['Say "hello"', '"Say ""hello"""'],
    ["Line one\nLine two", '"Line one\nLine two"'],
    ['=HYPERLINK("bad")', '"\'=HYPERLINK(""bad"")"'],
    ["  +SUM(1)", '"\'  +SUM(1)"'],
  ])("escapes CSV value %s", (input, expected) => expect(csvCell(input)).toBe(expected))

  it("generates a standard ZIP with the documented folder and complete files", async () => {
    const fixture = makeExportFixture()
    const file = await createExportZip(fixture, null)
    expect(file.name).toBe("ledgerly-export-2026-09-23.zip")
    const archive = unzipSync(new Uint8Array(await file.arrayBuffer()))
    const files = buildExportFiles(fixture, null)
    expect(Object.keys(archive).sort()).toEqual(Object.keys(files).map((path) => `ledgerly-export-2026-09-23/${path}`).sort())
    expect(JSON.parse(strFromU8(archive["ledgerly-export-2026-09-23/backup.json"])).data).toEqual(fixture.data)
  })
})
