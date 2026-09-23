import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/202609220001_add_daily_transaction_reminders.sql"),
  "utf8",
)

describe("daily reminder migration", () => {
  it("keeps preferences and subscription access user-scoped with RLS", () => {
    expect(migration).toContain("alter table public.notification_preferences enable row level security")
    expect(migration).toContain("alter table public.push_subscriptions enable row level security")
    expect(migration).toContain("using ((select auth.uid()) = user_id)")
    expect(migration).toContain("where user_id = v_user_id and endpoint = p_endpoint")
    expect(migration).not.toMatch(/grant\s+(?:insert|update|delete)\s+on table public\.(?:notification_preferences|push_subscriptions)/i)
  })

  it("uses the fixed Singapore calendar date and excludes disabled users", () => {
    expect(migration).toContain("clock_timestamp() at time zone 'Asia/Singapore'")
    expect(migration).toContain("where preference.daily_reminder_enabled")
    expect(migration).not.toContain("profile.timezone")
    expect(migration).not.toContain("daily_reminder_time")
  })

  it("atomically allows one claim per user and Singapore day, then allows the next day", () => {
    expect(migration).toContain("unique (user_id, notification_type, local_date)")
    expect(migration).toContain("on conflict (user_id, notification_type, local_date) do nothing")
    expect(migration).toContain("reminder_local_date := p_local_date")
    expect(migration).toContain("grant execute on function public.claim_daily_transaction_reminders(date, integer) to service_role")
    expect(migration).not.toMatch(/attempt_count|claim_expires_at|next_attempt_at|retryable_failure/)
  })

  it("does not store finance data or notification secrets", () => {
    expect(migration).not.toMatch(/account_balance|transaction_amount|service_role_key|vapid_private|cron_secret/i)
    expect(migration).toContain("notification_type = 'daily_transaction_reminder'")
  })
})
