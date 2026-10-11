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
  it("bounds database reads and pins the first Singapore date throughout draining", () => {
    expect(edge).toContain("p_limit: REMINDER_BATCH_SIZE")
    expect(edge).toContain(".limit(MAX_PUSH_SUBSCRIPTIONS)")
    expect(edge).toContain("reminderDate ??= claims[0]?.reminder_local_date")
    expect(edge).toContain("p_local_date: reminderDate")
    expect(edge.indexOf("let reminderDate")).toBeLessThan(edge.indexOf("await runDailyReminderWorker"))
  })

  it("reports guard stops without logging recipients or sender errors", () => {
    const logs = edge.match(/console\.(?:error|log)\(JSON\.stringify\([\s\S]*?\)\)/g) ?? []
    expect(logs.length).toBeGreaterThan(0)
    for (const log of logs) {
      expect(log).not.toMatch(/endpoint|p256dh|\bauth\b|userId|claimed_user_id|subscription|\berror\s*[,}]/)
    }
    expect(edge).toContain("return json(result, 503)")
  })
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

  it("keeps the deployment Cron schedule at 13:00 UTC", () => {
    expect(deployment).toContain("0 13 * * *")
  })
})
