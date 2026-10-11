# Daily transaction reminder

One generic reminder is attempted per enabled Singapore date at **9 PM**. The single project Cron job runs at 13:00 UTC; profile timezone does not change it. Notification clicks open Add Expense. No transactions or financial values enter the push payload.

## Device and delivery rules

Registration allows **five subscription rows per user**. Caller-owned updates use no new slot; removal/404/410 cleanup frees one. A per-user transaction lock prevents concurrent cap bypass. Foreign-owned endpoints are rejected without reassignment or owner disclosure.

After an explicit enable encounters an existing foreign-owned local subscription, the client unsubscribes locally and tries one fresh, different endpoint. It never deletes the other account's server row. Logout and reminder toggling do not unsubscribe devices.

The worker reads/sends at most five devices per user and processes five users concurrently (25 sends maximum). Claims exclude every existing user/type/Singapore-date claim before the 50-user batch limit; the invocation pins that date. It drains until empty or a 20-batch/1,000-user safety stop (HTTP 503 with counts/reason). Failed claims cannot retry that day; hosted execution deadlines still apply. Endpoint allowlisting prevents arbitrary outbound targets; endpoints/keys never enter logs.

## Configure and deploy

Confirm the Supabase project and pending migrations first; follow [setup](../docs/development.md). Apply pending subscription/claim migrations before deploying the worker. For existing deployments, preserve the current keys, secrets and Cron job.

For a new deployment, generate a stable VAPID pair and independent scheduler secret:

```bash
deno eval 'import { generateVapidKeys } from "npm:@mmmike/web-push@1.0.1/vapid"; console.log(await generateVapidKeys())'
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
```

Set `VITE_WEB_PUSH_VAPID_PUBLIC_KEY` in the frontend environment. Configure server-only secrets and deploy:

```powershell
npx.cmd supabase@2.117.0 secrets set WEB_PUSH_VAPID_PUBLIC_KEY=YOUR_PUBLIC_KEY WEB_PUSH_VAPID_PRIVATE_KEY=YOUR_PRIVATE_KEY WEB_PUSH_VAPID_SUBJECT=https://YOUR_LEDGERLY_ORIGIN DAILY_REMINDER_CRON_SECRET=YOUR_RANDOM_SECRET --project-ref YOUR_CONFIRMED_PROJECT_REF
npx.cmd supabase@2.117.0 functions deploy daily-transaction-reminder --no-verify-jwt --project-ref YOUR_CONFIRMED_PROJECT_REF
```

The subject can instead be a monitored `mailto:` URI. Private VAPID/scheduler values belong only in Edge secrets/Vault, never Vercel or `VITE_`. Gateway JWT verification is disabled for this worker because it authenticates the scheduler's independent high-entropy bearer secret before service-only RPC calls. Do not use that deployment flag for the Assistant.

Enable `pg_cron` and `pg_net` in the confirmed project. Check scheduler timezone before creating the job:

```sql
select name, setting from pg_settings
where name in ('TimeZone', 'cron.timezone');
```

Expected UTC/GMT settings make 13:00 equal 21:00 Singapore. Create Vault entries using the deployed URL and matching scheduler secret:

```sql
select vault.create_secret(
  'https://YOUR_PROJECT_REF.supabase.co/functions/v1/daily-transaction-reminder',
  'ledgerly_daily_reminder_function_url'
);
select vault.create_secret('YOUR_RANDOM_SECRET', 'ledgerly_daily_reminder_cron_secret');
```

Create **exactly one** project-wide job:

```sql
select cron.schedule(
  'ledgerly-daily-transaction-reminder',
  '0 13 * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets
            where name = 'ledgerly_daily_reminder_function_url'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        select decrypted_secret from vault.decrypted_secrets
        where name = 'ledgerly_daily_reminder_cron_secret'
      )
    ),
    body := '{}'::jsonb
  );
  $$
);
```

Confirm the single enabled job in Dashboard → Integrations → Cron. Stop it during rollback/incidents with `select cron.unschedule('ledgerly-daily-transaction-reminder');`. Deploy/update the frontend after the database/function; regenerate types when needed through the confirmed-project workflow.

## Verify safely

Before upgrading, check legacy over-cap accounts without exposing identities:

```sql
select count(*) as users_above_device_limit
from (select user_id from public.push_subscriptions group by user_id having count(*) > 5) over_limit;
```

Migration does not delete legacy devices. They cannot add another endpoint until below five; sends select at most the five most recently updated rows. Owners should remove unwanted devices explicitly.

Run [rollback SQL](DAILY_TRANSACTION_REMINDER_VERIFICATION.sql) in disposable/staging Supabase with no enabled real-user preferences. It checks device counts/ownership, disabled users, daily uniqueness and non-overlapping batches. Read the [two-connection lock probe](PUSH_SUBSCRIPTION_CONCURRENCY_VERIFICATION.sql) before running its separate blocks; also test competing committed requests in staging. See [database execution cautions](../docs/development.md#verification).

With test accounts/devices, manually invoke once using a process-environment secret:

```powershell
$reminderHeaders = @{ Authorization = "Bearer $env:DAILY_REMINDER_CRON_SECRET"; "Content-Type" = "application/json" }
Invoke-RestMethod -Method Post -Uri "https://YOUR_PROJECT_REF.supabase.co/functions/v1/daily-transaction-reminder" -Headers $reminderHeaders -Body "{}"
```

This consumes today's claim; repeating it or running that night's Cron must not send again. A new Singapore date permits another claim. Avoid changing the production schedule merely to test.

On an updated installed iPhone PWA, enable permission in Settings, confirm the fixed time, receive the generic notification while backgrounded, and tap through to Add Expense. Check disable/remove/re-enable, five-device cap, shared-browser User A→B recovery and real expired-device cleanup. In staging, verify >50-user draining, duplicate/invalid scheduler requests, and logs containing only operational metadata. Database mocks/builds cannot establish hosted Cron or device delivery.
