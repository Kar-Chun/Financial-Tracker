-- Run after all migrations on a disposable/local Supabase database as postgres.
-- Every fixture/change is rolled back. This does not send a real Web Push.
begin;

create function pg_temp.check_true(ok boolean, explanation text) returns void
language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'Verification failed: %', explanation; end if;
end;
$$;

do $$
declare
  a uuid := gen_random_uuid();
  b uuid := gen_random_uuid();
  delivery uuid;
  next_delivery uuid;
  claim_count integer;
begin
  insert into auth.users(id, email, raw_user_meta_data) values
    (a, a::text || '@example.invalid', '{}'::jsonb),
    (b, b::text || '@example.invalid', '{}'::jsonb);

  set local role authenticated;
  perform set_config('request.jwt.claim.sub', a::text, true);
  perform public.enable_daily_transaction_reminder(
    'https://fcm.googleapis.com/fcm/send/device-a',
    repeat('p', 87), repeat('a', 22)
  );
  perform pg_temp.check_true(
    (public.get_notification_settings()->>'daily_reminder_enabled')::boolean,
    'enabled preference is returned'
  );
  perform pg_temp.check_true(
    not (public.get_notification_settings() ? 'daily_reminder_time'),
    'fixed V1 does not expose a configurable reminder time'
  );

  perform set_config('request.jwt.claim.sub', b::text, true);
  perform public.enable_daily_transaction_reminder(
    'https://web.push.apple.com/device-b',
    repeat('p', 87), repeat('a', 22)
  );
  perform public.set_daily_transaction_reminder(false);
  perform pg_temp.check_true(
    not exists (select 1 from public.notification_preferences where user_id = a),
    'preference RLS hides another user'
  );
  perform pg_temp.check_true(
    not exists (select 1 from public.push_subscriptions where user_id = a),
    'subscription RLS hides another user endpoint'
  );
  begin
    update public.notification_preferences
    set daily_reminder_enabled = false
    where user_id = a;
    raise exception 'Expected direct cross-user write rejection';
  exception when insufficient_privilege then null;
  end;
  perform pg_temp.check_true(
    not public.remove_current_push_subscription('https://fcm.googleapis.com/fcm/send/device-a'),
    'subscription removal is scoped to the caller'
  );
  begin
    perform public.claim_daily_transaction_reminders(date '2026-09-22', 50);
    raise exception 'Expected browser claim rejection';
  exception when insufficient_privilege then null;
  end;

  reset role;
  set local role service_role;
  select claimed.delivery_id into delivery
  from public.claim_daily_transaction_reminders(date '2026-09-22', 50) claimed;
  perform pg_temp.check_true(delivery is not null, 'enabled user receives a daily claim');
  perform pg_temp.check_true(
    (select user_id = a from public.notification_deliveries where id = delivery),
    'disabled user is excluded'
  );

  select count(*) into claim_count
  from public.claim_daily_transaction_reminders(date '2026-09-22', 50);
  perform pg_temp.check_true(claim_count = 0, 'same Singapore day cannot be claimed twice');
  perform public.complete_daily_transaction_reminder(delivery, 'delivered', null);

  select claimed.delivery_id into next_delivery
  from public.claim_daily_transaction_reminders(date '2026-09-23', 50) claimed;
  perform pg_temp.check_true(next_delivery is not null, 'next Singapore day can be claimed');
  perform pg_temp.check_true(
    (select count(*) = 2
     from public.notification_deliveries
     where user_id = a and notification_type = 'daily_transaction_reminder'),
    'one durable row is retained for each Singapore day'
  );
  reset role;
end;
$$;

rollback;
