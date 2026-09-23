import { strToU8, zip } from "fflate"

import { getMinorUnitDigits } from "@/lib/currency"
import { exportRowSchemas, exportTables, type ExportCell, type ExportResponse, type ExportRow, type ExportTable } from "./export-schema"

const investmentFiles: Partial<Record<ExportTable, string>> = {
  investment_valuations: "valuations",
  investment_holdings: "holdings",
  investment_trades: "trades",
  investment_cash_events: "cash_events",
  investment_prices: "prices",
  manual_fx_rates: "fx_rates",
}

export function csvPath(table: ExportTable) {
  return investmentFiles[table]
    ? `csv/investments/${investmentFiles[table]}.csv`
    : `csv/${table}.csv`
}

// CSV is presentation only. Formula-looking text is escaped for spreadsheets;
// exact numeric fields may retain their minus sign. backup.json stays unchanged.
export function csvCell(value: ExportCell, numeric = false) {
  let text = value === null ? "" : String(value)
  if (!numeric && /^[\s\uFEFF]*[=+\-@\t\r\n]/u.test(text)) text = `'${text}`
  return `"${text.replaceAll('"', '""')}"`
}

export function decimalAmount(minor: string, currency: string) {
  const digits = getMinorUnitDigits(currency)
  const value = BigInt(minor)
  const absolute = value < 0n ? -value : value
  const scale = 10n ** BigInt(digits)
  const fraction = (absolute % scale).toString().padStart(digits, "0")
  return `${value < 0n ? "-" : ""}${absolute / scale}${digits ? `.${fraction}` : ""}`
}

function displayAmountColumn(column: string) {
  return column.replace(/_minor$/, "")
}

export function buildExportFiles(response: ExportResponse, lastExpenseAccountId: string | null) {
  const { data } = response
  const baseCurrency = data.profiles[0].base_currency
  const accounts = new Map(data.accounts.map((row) => [row.id, row]))
  const categories = new Map(data.categories.map((row) => [row.id, row]))
  const holdings = new Map(data.investment_holdings.map((row) => [row.id, row]))
  const goals = new Map(data.savings_goals.map((row) => [row.id, row]))
  const budgets = new Map(data.monthly_budgets.map((row) => [row.id, row]))
  const files: Record<string, string> = {}

  for (const table of exportTables) {
    const columns = Object.keys(exportRowSchemas[table].shape)
    const moneyColumns = columns.filter((column) => column.endsWith("_minor"))
    const extras = [
      ...(columns.includes("account_id") ? ["account_name"] : []),
      ...(columns.includes("category_id") ? ["category_name"] : []),
      ...(columns.includes("goal_id") ? ["goal_name"] : []),
      ...(moneyColumns.length || table === "investment_prices" ? ["currency"] : []),
      ...(table === "investment_valuations" || table === "net_worth_snapshots" ? ["base_currency"] : []),
      ...moneyColumns.map(displayAmountColumn),
    ]
    const header = [...columns, ...extras]
    const rows = (data[table] as ExportRow[]).map((row) => {
      const holding = typeof row.holding_id === "string" ? holdings.get(row.holding_id) : undefined
      const account = typeof row.account_id === "string" ? accounts.get(row.account_id)
        : holding ? accounts.get(holding.account_id) : undefined
      const goal = typeof row.goal_id === "string" ? goals.get(row.goal_id) : undefined
      const budget = typeof row.monthly_budget_id === "string" ? budgets.get(row.monthly_budget_id) : undefined
      const currency = typeof row.currency_code === "string" ? row.currency_code
        : account?.currency_code ?? goal?.currency_code ?? budget?.currency_code ?? baseCurrency
      const display: ExportRow = {
        ...row,
        account_name: account?.name ?? null,
        category_name: typeof row.category_id === "string" ? categories.get(row.category_id)?.name ?? null : null,
        goal_name: goal?.name ?? null,
        currency,
        base_currency: baseCurrency,
      }
      for (const column of moneyColumns) {
        const value = row[column]
        if (typeof value !== "string") throw new Error("Invalid export amount.")
        const amountCurrency = column.includes("base_") ? baseCurrency : currency
        display[displayAmountColumn(column)] = decimalAmount(value, amountCurrency)
      }
      return header.map((column) => csvCell(display[column],
        moneyColumns.includes(column) || moneyColumns.some((money) => displayAmountColumn(money) === column)
        || ["quantity", "unit_price", "price", "rate"].includes(column))).join(",")
    })
    files[csvPath(table)] = "\uFEFF" + [header.map((column) => csvCell(column)).join(","), ...rows].join("\r\n") + "\r\n"
  }

  files["backup.json"] = JSON.stringify({
    ...response,
    device_preferences: { last_expense_account_id: lastExpenseAccountId },
  }, null, 2)
  files["README.txt"] = [
    "Ledgerly full data export",
    `Created: ${response.exported_at}`,
    "Backup format: ledgerly-backup, version 1 (independent of database migrations).",
    "This export contains personal financial information. Store it securely. The ZIP is not encrypted.",
    "backup.json is the canonical machine-readable copy, preserving IDs, relationships and retained history.",
    "CSV files are UTF-8 human-readable views. Import IDs and exact decimal columns as text in spreadsheets.",
    "Formula-looking CSV text is prefixed with an apostrophe for safety; original text remains in backup.json.",
    "All minor-unit money and investment decimals are exact strings in backup.json.",
    "CSV money columns without the _minor suffix display the corresponding minor units in their currency; no FX is invented or converted.",
    "Base amounts use base_currency; native amounts use currency. FX rows use from_currency and to_currency.",
    "Simple valuations and Detailed investment ledgers are separate. Goal allocations are virtual earmarking.",
    "Net worth snapshots are DERIVED HISTORY, exported as stored without recalculation.",
    "Archived and soft-deleted records are included; permanently deleted records cannot be exported.",
    "Security/operational data and AI conversation are excluded. Device preference covers this device only.",
    "Import/Restore is not currently supported.",
  ].join("\r\n") + "\r\n"
  files["manifest.json"] = JSON.stringify({
    format: "ledgerly-export", version: 1, exported_at: response.exported_at,
    files: [...Object.keys(files), "manifest.json"].sort(),
    record_counts: response.record_counts,
    derived_history: ["net_worth_snapshots"],
    numeric_encoding: "BIGINT minor units and NUMERIC decimals are strings",
    device_preferences_scope: "current device only",
  }, null, 2)
  return files
}

export async function createExportZip(response: ExportResponse, lastExpenseAccountId: string | null) {
  const name = `ledgerly-export-${response.exported_at.slice(0, 10)}`
  const files = buildExportFiles(response, lastExpenseAccountId)
  const archive: Record<string, Uint8Array> = {}
  let bytes = 0
  for (const [path, content] of Object.entries(files)) {
    const encoded = strToU8(content)
    bytes += encoded.byteLength
    if (bytes > 64 * 1024 * 1024) throw new Error("Export exceeds the V1 package size limit.")
    archive[`${name}/${path}`] = encoded
  }
  const zipped = await new Promise<Uint8Array>((resolve, reject) => {
    zip(archive, { level: 6 }, (error, result) => error ? reject(error) : resolve(result))
  })
  return new File([new Uint8Array(zipped)], `${name}.zip`, { type: "application/zip" })
}
