import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

import { latestFunctionDefinition } from "@/test/migrations"

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/202609220001_add_daily_transaction_reminders.sql"),
  "utf8",
)
const registration = latestFunctionDefinition("enable_daily_transaction_reminder")
const claim = latestFunctionDefinition("claim_daily_transaction_reminders")

describe("daily reminder migration (static SQL checks; execute rollback SQL for database behavior)", () => {
  it("serializes each user's registrations before counting or inserting", () => {
    expect(registration).toContain("'ledgerly.push.registration:' || v_user_id::text")
    const lock = registration.indexOf("pg_advisory_xact_lock")
    const count = registration.indexOf("select count(*) from public.push_subscriptions where user_id = v_user_id")
    const insert = registration.indexOf("insert into public.push_subscriptions")
    expect(lock).toBeGreaterThan(0)
    expect(count).toBeGreaterThan(lock)
    expect(insert).toBeGreaterThan(count)
    expect(registration).toContain(">= 5 then")
    expect(registration).toContain("errcode = 'P2002', message = 'Notification device limit reached.'")
  })

  it("allows existing owners to update without consuming slots and never changes ownership", () => {
    expect(registration).toContain("if v_existing.user_id <> v_user_id then")
    expect(registration).toContain("where id = v_existing.id and user_id = v_user_id")
    expect(registration.indexOf("update public.push_subscriptions")).toBeLessThan(registration.indexOf("select count(*)"))
    expect(registration).not.toMatch(/set\s+user_id|user_id\s*=\s*excluded\.user_id/i)
    expect(registration).toContain("on conflict (endpoint) do nothing")
    expect(registration).toContain("if v_inserted_id is null then")
    const conflicts = registration.match(/errcode = 'P2001', message = '[^']*'/g) ?? []
    expect(new Set(conflicts)).toEqual(new Set(["errcode = 'P2001', message = 'This notification subscription cannot be registered.'"]))
  })

  it("filters daily claims before the limit and serializes concurrent claim batches", () => {
    expect(claim).toContain("'ledgerly.reminder.claim:' || p_local_date::text")
    expect(claim).toContain("delivery.local_date = p_local_date")
    expect(claim.indexOf("and not exists")).toBeLessThan(claim.indexOf("limit p_limit"))
    expect(claim).toContain("order by preference.user_id")
    expect(claim).toContain("on conflict (user_id, notification_type, local_date) do nothing")
    expect(claim).toContain("clock_timestamp() at time zone 'Asia/Singapore'")
    expect(claim).not.toMatch(/delivery\.status\s*=/)
  })

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

  it("defines durable daily uniqueness and service-role-only claim access", () => {
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
