-- Run after all migrations on a disposable/local Supabase database as postgres.
-- Every fixture/change is rolled back. This does not send a real Web Push.
begin;

-- Claim RPCs are project-wide. Use a disposable database with no pre-existing
-- enabled reminders so exact batch assertions cannot consume somebody's claims.
do $$ begin
  if exists(select 1 from public.notification_preferences where daily_reminder_enabled) then
    raise exception 'Use a disposable database without enabled reminder preferences.';
  end if;
end; $$;

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
  c uuid;
  device integer;
  first_batch uuid[];
  second_batch uuid[];
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
  perform pg_temp.check_true((select count(*) = 1 from public.push_subscriptions), 'first subscription accepted');
  perform public.enable_daily_transaction_reminder('https://fcm.googleapis.com/fcm/send/device-a', repeat('q', 87), repeat('b', 22));
  perform pg_temp.check_true((select count(*) = 1 and bool_and(p256dh = repeat('q', 87)) from public.push_subscriptions), 'same-owner update does not consume a slot');
  for device in 2..5 loop
    perform public.enable_daily_transaction_reminder('https://fcm.googleapis.com/fcm/send/device-a-' || device, repeat('p', 87), repeat('a', 22));
  end loop;
  perform pg_temp.check_true((select count(*) = 5 from public.push_subscriptions), 'five distinct devices accepted');
  begin
    perform public.enable_daily_transaction_reminder('https://fcm.googleapis.com/fcm/send/device-a-6', repeat('p', 87), repeat('a', 22));
    raise exception 'Expected device cap rejection';
  exception when sqlstate 'P2002' then
    perform pg_temp.check_true(sqlerrm = 'Notification device limit reached.', 'cap has a safe domain error');
  end;
  perform pg_temp.check_true((select count(*) = 5 from public.push_subscriptions), 'sixth device leaves no row');
  perform public.enable_daily_transaction_reminder('https://fcm.googleapis.com/fcm/send/device-a', repeat('q', 87), repeat('b', 22));
  perform pg_temp.check_true((select count(*) = 5 from public.push_subscriptions), 'same-owner update works at capacity');
  perform public.remove_current_push_subscription('https://fcm.googleapis.com/fcm/send/device-a-5');
  perform public.enable_daily_transaction_reminder('https://fcm.googleapis.com/fcm/send/device-a-6', repeat('p', 87), repeat('a', 22));
  perform pg_temp.check_true((select count(*) = 5 from public.push_subscriptions), 'explicit removal frees one slot');

  perform set_config('request.jwt.claim.sub', b::text, true);
  begin
    perform public.enable_daily_transaction_reminder('https://fcm.googleapis.com/fcm/send/device-a', repeat('z', 87), repeat('z', 22));
    raise exception 'Expected endpoint ownership conflict';
  exception when sqlstate 'P2001' then
    perform pg_temp.check_true(sqlerrm = 'This notification subscription cannot be registered.', 'conflict reveals no owner or endpoint');
  end;
  perform pg_temp.check_true(not exists(select 1 from public.push_subscriptions), 'conflicting endpoint was not reassigned');
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
  begin
    perform 1 from public.notification_deliveries;
    raise exception 'Expected browser delivery read denial';
  exception when insufficient_privilege then null;
  end;

  reset role;
  perform pg_temp.check_true((select user_id = a and p256dh = repeat('q', 87) and auth = repeat('b', 22)
    from public.push_subscriptions where endpoint = 'https://fcm.googleapis.com/fcm/send/device-a'), 'conflict preserves original owner and keys');
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

  -- An existing failed claim must also be skipped: there is no same-day retry.
  insert into public.notification_deliveries(user_id, notification_type, local_date, status)
    values(a, 'daily_transaction_reminder', date '2026-09-24', 'failed');
  for device in 1..60 loop
    c := gen_random_uuid();
    insert into auth.users(id, email, raw_user_meta_data) values(c, c::text || '@example.invalid', '{}'::jsonb);
    insert into public.notification_preferences(user_id, daily_reminder_enabled) values(c, true);
  end loop;
  set local role service_role;
  select array_agg(claimed_user_id) into first_batch from public.claim_daily_transaction_reminders(date '2026-09-24', 50);
  select array_agg(claimed_user_id) into second_batch from public.claim_daily_transaction_reminders(date '2026-09-24', 50);
  perform pg_temp.check_true(cardinality(first_batch) = 50, 'first batch bounded to 50');
  perform pg_temp.check_true(cardinality(second_batch) = 10, 'second batch progresses beyond first 50');
  perform pg_temp.check_true(not (first_batch && second_batch), 'batches never overlap');
  perform pg_temp.check_true(not (a = any(first_batch || second_batch)), 'existing failed claim excluded');
  perform pg_temp.check_true(not (b = any(first_batch || second_batch)), 'disabled user excluded');
  perform pg_temp.check_true((select count(*) = 0 from public.claim_daily_transaction_reminders(date '2026-09-24', 50)), 'drain ends with empty batch');
  perform pg_temp.check_true((select count(*) = count(distinct user_id) and count(*) = 61 from public.notification_deliveries where local_date = date '2026-09-24'), 'one durable claim per user/date');
  perform pg_temp.check_true((select count(*) = 50 from public.claim_daily_transaction_reminders(date '2026-09-25', 50)), 'next Singapore date first batch');
  perform pg_temp.check_true((select count(*) = 11 from public.claim_daily_transaction_reminders(date '2026-09-25', 50)), 'next Singapore date includes the previously failed user');
  reset role;
end;
$$;

rollback;
