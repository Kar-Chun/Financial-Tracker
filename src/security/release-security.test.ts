import { readFileSync, readdirSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const migrationDirectory = resolve(process.cwd(), "supabase/migrations")
const migrationNames = readdirSync(migrationDirectory).filter((name) => name.endsWith(".sql")).sort()
const migrations = migrationNames.map((name) => readFileSync(resolve(migrationDirectory, name), "utf8")).join("\n")

describe("release database security posture", () => {
  it("keeps migrations ordered and appends bounded reads after the lifecycle/history controls", () => {
    expect(migrationNames).toEqual([...migrationNames].sort())
    expect(migrationNames.slice(-12)).toEqual([
      "202608240006_add_ai_abuse_protection.sql",
      "202608270001_add_safe_account_lifecycle.sql",
      "202608280001_add_net_worth_history_reset.sql",
      "202609040001_add_bounded_dashboard_and_transaction_reads.sql",
      "202609040002_centralize_eligible_spending.sql",
      "202609090001_add_dashboard_today_spending.sql",
      "202609100001_add_transaction_note_suggestions.sql",
      "202609130001_add_account_reconciliation.sql",
      "202609220001_add_daily_transaction_reminders.sql",
      "202609230001_add_full_data_export.sql",
      "202609260001_harden_financial_input_boundaries.sql",
      "202609260002_harden_push_subscriptions_and_reminder_batches.sql",
    ])
  })

  it("enables RLS on every user, financial, investment, and AI operational table", () => {
    const tables = [
      "profiles", "accounts", "categories", "transactions", "transaction_entries",
      "investment_valuations", "net_worth_snapshots", "monthly_budgets", "category_budgets",
      "savings_goals", "goal_allocations", "manual_fx_rates", "investment_holdings",
      "investment_trades", "investment_prices", "investment_cash_events",
      "ai_rate_limit_config", "ai_request_usage",
      "notification_preferences", "push_subscriptions", "notification_deliveries",
    ]
    for (const table of tables) {
      expect(migrations, `${table} must enable RLS`).toContain(`alter table public.${table} enable row level security`)
    }
  })

  it("gives every SECURITY DEFINER function an empty search path and contains no dynamic SQL", () => {
    const definitions = migrations.match(/security definer/g) ?? []
    const safeDefinitions = migrations.match(/security definer\s+set search_path = ''/g) ?? []
    expect(safeDefinitions).toHaveLength(definitions.length)
    expect(migrations).not.toMatch(/\bexecute\s+(?:format\s*\(|\()/i)
  })

  it("makes AI usage metadata inaccessible as browser tables and claims atomically", () => {
    const migration = readFileSync(resolve(migrationDirectory, "202608240006_add_ai_abuse_protection.sql"), "utf8")
    expect(migration).toContain("pg_catalog.pg_advisory_xact_lock")
    expect(migration).toContain("where user_id = v_user_id and status = 'active'")
    expect(migration).toContain("revoke all on table public.ai_rate_limit_config, public.ai_request_usage from public, anon, authenticated")
    expect(migration).toContain("values (true, 6, 30, 100, 500, 60)")
    expect(migration).not.toMatch(/prompt|answer|tool_payload|financial_payload/i)
  })

  it("keeps sensitive ledgers select-only for authenticated browser clients", () => {
    expect(migrations).toContain("revoke all on table public.savings_goals from anon, authenticated")
    expect(migrations).toContain("revoke all on table public.goal_allocations from anon, authenticated")
    expect(migrations).toContain("revoke all on table public.manual_fx_rates, public.investment_holdings, public.investment_trades, public.investment_prices, public.investment_cash_events from anon, authenticated")
    expect(migrations).not.toMatch(/grant\s+(?:insert|delete)\s+on\s+table\s+public\.(?:transaction_entries|goal_allocations|investment_trades|investment_cash_events|investment_prices|manual_fx_rates)\s+to\s+authenticated/i)
  })

  it("authenticates and claims a server lease before invoking Gemini", () => {
    const edge = readFileSync(resolve(process.cwd(), "supabase/functions/financial-assistant/index.ts"), "utf8")
    const authentication = edge.indexOf("client.auth.getUser")
    const validation = edge.indexOf("const body = await readValidatedAssistantRequest")
    const claim = edge.indexOf("await claimAiRequest")
    const providerCall = edge.indexOf("const result = await runFinancialAssistant")
    expect(authentication).toBeGreaterThan(0)
    expect(validation).toBeGreaterThan(authentication)
    expect(claim).toBeGreaterThan(validation)
    expect(providerCall).toBeGreaterThan(claim)
    expect(edge).not.toContain("SERVICE_ROLE")
  })

  it("keeps notification worker secrets out of browser source", () => {
    const browserFiles = readBrowserSource(resolve(process.cwd(), "src"))
    expect(browserFiles).not.toMatch(/WEB_PUSH_VAPID_PRIVATE_KEY|DAILY_REMINDER_CRON_SECRET|SUPABASE_SERVICE_ROLE_KEY/)
    expect(browserFiles).toContain("VITE_WEB_PUSH_VAPID_PUBLIC_KEY")
  })
})

function readBrowserSource(directory: string): string {
  return readdirSync(directory, { withFileTypes: true }).map((entry) => {
    const path = resolve(directory, entry.name)
    if (entry.isDirectory()) return readBrowserSource(path)
    return /\.(?:ts|tsx)$/.test(entry.name) && !entry.name.includes(".test.")
      ? readFileSync(path, "utf8")
      : ""
  }).join("\n")
}
