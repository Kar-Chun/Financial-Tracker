import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const edge = readFileSync(
  resolve(process.cwd(), "supabase/functions/daily-transaction-reminder/index.ts"),
  "utf8",
)
const config = readFileSync(resolve(process.cwd(), "supabase/config.toml"), "utf8")
const deployment = readFileSync(resolve(process.cwd(), "supabase/DAILY_TRANSACTION_REMINDER.md"), "utf8")

describe("daily reminder Edge boundary", () => {
  it("authenticates the scheduled request before server database access", () => {
    const authentication = edge.indexOf("constantTimeEqual")
    const serviceClient = edge.indexOf("createClient(supabaseUrl, serviceRoleKey")
    const worker = edge.indexOf("await runDailyReminderWorker")
    expect(config).toContain("[functions.daily-transaction-reminder]")
    expect(config).toContain("verify_jwt = false")
    expect(authentication).toBeGreaterThan(0)
    expect(serviceClient).toBeGreaterThan(authentication)
    expect(worker).toBeGreaterThan(serviceClient)
  })

  it("uses a Deno-compatible Web Crypto sender and only a generic payload", () => {
    expect(edge).toContain('npm:@mmmike/web-push@1.0.1/send')
    expect(edge).toContain('title: "Ledgerly"')
    expect(edge).toContain('body: "Quick reminder: log anything you spent today."')
    expect(edge).toContain('url: "/transactions/new?type=expense"')
    expect(edge).not.toMatch(/balance|amount|transaction note|investment value/i)
  })

  it("keeps VAPID and scheduler secrets server-side and responses free of endpoints", () => {
    expect(edge).toContain('Deno.env.get("WEB_PUSH_VAPID_PRIVATE_KEY")')
    expect(edge).toContain('Deno.env.get("DAILY_REMINDER_CRON_SECRET")')
    expect(edge).not.toMatch(/console\.(?:log|error)\([^\n]*endpoint/)
    expect(edge).toContain('"Cache-Control": "no-store"')
  })

  it("documents one daily 13:00 UTC invocation without periodic polling", () => {
    expect(deployment).toContain("0 13 * * *")
    expect(deployment).toContain("9:00 PM Singapore")
    expect(deployment).not.toMatch(/five[- ]minute|periodic polling/i)
    expect(edge).toContain('client.rpc("claim_daily_transaction_reminders"')
    expect(edge).not.toContain("claim_due_daily_transaction_reminders")
  })
})
