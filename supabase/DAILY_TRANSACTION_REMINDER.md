# Daily transaction reminder deployment and verification

V1 sends one generic reminder every enabled day at **9:00 PM Singapore time** (`Asia/Singapore`, UTC+08:00). Singapore does not observe daylight saving time. One project-wide Cron job invokes the Edge Function at 13:00 UTC, and the internal `notification_deliveries` table permits only one claim per user, notification type, and Singapore calendar date. The reminder does not inspect transactions or include financial data.

`notification_preferences` stores only whether the reminder is enabled. `push_subscriptions` stores one row per browser subscription. The user's general profile timezone remains part of Ledgerly, but notification scheduling does not use it in this fixed-time V1.

The Edge Function uses the pinned `npm:@mmmike/web-push@1.0.1` sender because it implements Web Push/VAPID encryption with Web Crypto and `fetch`, without Node compatibility shims. Its 404/410 result removes expired subscriptions. The SQL allowlist limits stored endpoints to the current Apple, Mozilla, Google FCM, and Windows push-service domains so an authenticated client cannot turn the worker into an arbitrary outbound proxy.

## Required configuration

Generate one VAPID pair and keep it stable. One option with Deno is:

```bash
deno eval 'import { generateVapidKeys } from "npm:@mmmike/web-push@1.0.1/vapid"; console.log(await generateVapidKeys())'
```

Generate an independent scheduler secret, for example:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
```

Configure the public VAPID key in the frontend build environment:

```env
VITE_WEB_PUSH_VAPID_PUBLIC_KEY=YOUR_VAPID_PUBLIC_KEY
```

Configure the Edge Function after confirming the project reference:

```powershell
npx.cmd supabase secrets set WEB_PUSH_VAPID_PUBLIC_KEY=YOUR_VAPID_PUBLIC_KEY WEB_PUSH_VAPID_PRIVATE_KEY=YOUR_VAPID_PRIVATE_KEY WEB_PUSH_VAPID_SUBJECT=https://YOUR_PUBLIC_LEDGERLY_ORIGIN DAILY_REMINDER_CRON_SECRET=YOUR_RANDOM_SCHEDULER_SECRET --project-ref YOUR_CONFIRMED_PROJECT_REF
npx.cmd supabase functions deploy daily-transaction-reminder --no-verify-jwt --project-ref YOUR_CONFIRMED_PROJECT_REF
```

`WEB_PUSH_VAPID_SUBJECT` may instead be a monitored `mailto:` URI. The private key and scheduler secret belong only in Edge Function secrets. Store the same scheduler secret in Vault for the scheduled request. Do not put either one in Vercel or a `VITE_` variable.

## Exact Cron configuration

Supabase Cron uses `pg_cron`; hosted Supabase databases default to UTC, and `pg_cron` defaults its scheduling timezone to GMT. Confirm the project settings before creating the job:

```sql
select name, setting
from pg_settings
where name in ('TimeZone', 'cron.timezone');
```

The expected values are `UTC` for `TimeZone` and `GMT` for `cron.timezone`. At that setting, `13:00 UTC + 08:00` is `21:00` in Singapore. Enable the Supabase Cron (`pg_cron`) and `pg_net` integrations for the confirmed project. Then create the two Vault entries, replacing placeholders with the deployed function URL and the same random scheduler secret used above:

```sql
select vault.create_secret(
  'https://YOUR_PROJECT_REF.supabase.co/functions/v1/daily-transaction-reminder',
  'ledgerly_daily_reminder_function_url'
);
select vault.create_secret(
  'YOUR_RANDOM_SCHEDULER_SECRET',
  'ledgerly_daily_reminder_cron_secret'
);
```

Create exactly one daily job for the project:

```sql
select cron.schedule(
  'ledgerly-daily-transaction-reminder',
  '0 13 * * *',
  $$
  select net.http_post(
    url := (
      select decrypted_secret
      from vault.decrypted_secrets
      where name = 'ledgerly_daily_reminder_function_url'
    ),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'ledgerly_daily_reminder_cron_secret'
      )
    ),
    body := '{}'::jsonb
  ) as request_id;
  $$
);
```

Confirm there is exactly one enabled job with this name in **Dashboard > Integrations > Cron**. To stop the worker during rollback or incident response:

```sql
select cron.unschedule('ledgerly-daily-transaction-reminder');
```

The function has gateway JWT verification disabled because Cron uses an independent high-entropy bearer secret. The function rejects requests that do not match that secret. It then uses Supabase's server-only `SUPABASE_SERVICE_ROLE_KEY` environment value to call RPCs that are not executable by browser roles.

## Test without waiting until 9:00 PM

Prefer one manual invocation of the deployed Edge Function. Keep the scheduler secret in the process environment so it is not copied into source:

```powershell
$headers = @{ Authorization = "Bearer $env:DAILY_REMINDER_CRON_SECRET"; "Content-Type" = "application/json" }
Invoke-RestMethod -Method Post -Uri "https://YOUR_PROJECT_REF.supabase.co/functions/v1/daily-transaction-reminder" -Headers $headers -Body "{}"
```

This manual invocation claims the current Singapore calendar date. A second manual invocation and that night's scheduled invocation must return no claim for the same user, preventing a duplicate notification. Test again on the next Singapore calendar day. If the Cron trigger itself must be exercised earlier, temporarily change it in the Supabase Dashboard, test once on a fresh Singapore date, and restore `0 13 * * *` immediately. Do not add a user-facing or hidden configurable time.

## Database verification

If a disposable local Supabase/Postgres environment is available after migration, run:

```powershell
psql "$env:LEDGERLY_TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/DAILY_TRANSACTION_REMINDER_VERIFICATION.sql
```

The rollback-only script checks cross-user reads/writes, authenticated/server-only boundaries, disabled-user exclusion, same-Singapore-day deduplication, and a new claim on the next Singapore day. It does not contact a push service. Hosted verification still needs the deployed Edge Function, configured Vault/Cron entries, Edge logs, and a real subscribed device.

## Real iPhone checklist

1. Deploy the migration, function, Cron job, and frontend configuration in the order below.
2. Remove and re-add Ledgerly through **Add to Home Screen** if the installed app has not picked up the new service worker; otherwise fully close and reopen it once.
3. Open the installed Home Screen app, then go to **Settings > Notifications**.
4. Tap **Enable notifications** and accept the iOS notification permission prompt.
5. Confirm Settings shows **Every day at 9:00 PM** and **Notifications allowed**.
6. Optionally disable the reminder, invoke the function manually, and confirm it reports no claim and sends nothing; then re-enable it.
7. Close or background Ledgerly and manually invoke the Edge Function once using the command above.
8. Confirm the generic notification appears outside the app.
9. Tap it and confirm the installed Ledgerly app opens at **Add Expense** (`/transactions/new?type=expense`).
10. Invoke the function again and confirm no second reminder arrives for the same Singapore date.
11. Use **Remove this device** on a disposable subscription and verify enabling again reuses or creates one current subscription without duplicate database rows.
12. Leave the production schedule at `0 13 * * *`; there is no reminder time to restore.

## Deployment order

1. Confirm the intended Supabase project, its link, and migration history.
2. Apply `202609220001_add_daily_transaction_reminders.sql` without assuming `db push` is safe.
3. Generate one VAPID key pair and an independent scheduler secret.
4. Add `VITE_WEB_PUSH_VAPID_PUBLIC_KEY` to local/Vercel frontend environments.
5. Set the Edge secrets listed above on the confirmed Supabase project.
6. Deploy `daily-transaction-reminder` with gateway JWT verification disabled as configured.
7. Enable Cron/`pg_net`, create the Vault entries, confirm UTC/GMT scheduler settings, and create the single `0 13 * * *` Cron job.
8. Regenerate Supabase types with `npm.cmd run db:types -- --project-ref YOUR_CONFIRMED_PROJECT_REF` after confirming the link; keep the application adapter until the generated contract includes this migration.
9. Run `npm.cmd test`, `npm.cmd run lint`, `npm.cmd run build`, and `git diff --check`.
10. Deploy the frontend through the existing Vercel workflow.
11. Complete the real installed-iPhone checklist and inspect the Cron and Edge Function logs.
