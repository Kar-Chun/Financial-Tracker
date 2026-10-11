import { readFileSync, readdirSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"
import { exportRowSchemas, exportTables } from "./export-schema"

const directory = resolve(process.cwd(), "supabase/migrations")
const migration = readFileSync(resolve(directory, "202609230001_add_full_data_export.sql"), "utf8")
const allMigrations = readdirSync(directory).filter((file) => file.endsWith(".sql"))
  .map((file) => readFileSync(resolve(directory, file), "utf8")).join("\n")

describe("export boundary schema coverage (static SQL/source checks)", () => {
  it("keeps export data out of logging, AI, remote storage and numeric coercion", () => {
    const source = ["export-service.ts", "export-package.ts", "export-file.ts", "data-export-settings.tsx"]
      .map((file) => readFileSync(resolve(process.cwd(), "src/features/data-export", file), "utf8")).join("\n")
    expect(source).not.toMatch(/console\.|\.storage\.|\.functions\.invoke|\bNumber\(|parseFloat\(|parseInt\(|localStorage\.setItem/)
    expect(source).not.toMatch(/SERVICE_ROLE|VAPID_PRIVATE|CRON_SECRET|access_token|refresh_token/)
    expect(migration).toContain("octet_length(v_result::text) > 33554432")
    expect(source).toContain("bytes > 64 * 1024 * 1024")
  })

  it("classifies every persisted public table and exports only the explicit allowlist", () => {
    const tables = [...allMigrations.matchAll(/create table public\.(\w+)/g)].map((match) => match[1])
    const excluded = ["ai_rate_limit_config", "ai_request_usage", "push_subscriptions", "notification_deliveries"]
    expect(tables.sort()).toEqual([...exportTables, ...excluded].sort())
    for (const table of excluded) expect(migration).not.toContain(`public.${table}`)
    expect(migration).not.toContain("auth.users")
  })

  it("requires an authenticated caller and introduces no financial write or live calculation", () => {
    expect(migration).toContain("export_user_data_v1()")
    expect(migration).toContain("v_user_id uuid := auth.uid()")
    expect(migration).toContain("if v_user_id is null then")
    expect(migration).toContain("security definer\nset search_path = ''")
    expect(migration).toContain("stable")
    expect(migration).toContain("revoke all on function public.export_user_data_v1() from public, anon")
    expect(migration).toContain("grant execute on function public.export_user_data_v1() to authenticated")
    expect(migration).not.toMatch(/\b(insert into|update public|delete from|refresh_|get_account_summaries|grant select)\b/i)
    expect(migration).not.toMatch(/\blimit\s+\d|where[^;]*archived_at is null|where[^;]*deleted_at is null/i)
  })

  it("explicitly projects all V1 fields and casts precision-sensitive values before JSON", () => {
    for (const table of exportTables) {
      const block = migration.split(`'${table}', (select`)[1]?.split(") export_row)")[0]
      expect(block, table).toBeDefined()
      for (const column of Object.keys(exportRowSchemas[table].shape)) {
        expect(block).toContain(`r.${column}`)
        if (column.endsWith("_minor") || ["quantity", "unit_price", "price", "rate"].includes(column)) {
          expect(block).toContain(`r.${column}::text as ${column}`)
        }
      }
      expect(block).toContain(table === "profiles" ? "r.id = v_user_id" : "user_id = v_user_id")
    }
    expect(migration).not.toContain("r.*")
    expect(migration).toContain("t.id = r.transaction_id")
    expect(migration).toContain("a.user_id = v_user_id")
    expect(migration).toContain("b.id = r.monthly_budget_id")
    expect(migration).toContain("g.id = r.goal_id")
  })
})
