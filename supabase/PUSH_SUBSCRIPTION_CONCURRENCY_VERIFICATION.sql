-- TWO CONNECTIONS, disposable Supabase database, as postgres, after all migrations.
-- Do NOT execute this entire file in one connection. Run the labelled blocks.
-- Both connections ROLLBACK; no fixture is committed and no Web Push is sent.
-- This probes the real RPC's lock, not just a copy of the locking expression.

-- SESSION A: execute this block, then leave the transaction open.
begin;
insert into auth.users(id, email, raw_user_meta_data)
values ('00000000-0000-4000-8000-000000005205', 'push-lock-fixture@example.invalid', '{}'::jsonb);
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000005205', true);
do $$ begin
  for device in 1..5 loop
    perform public.enable_daily_transaction_reminder(
      'https://fcm.googleapis.com/fcm/send/concurrency-fixture-' || device,
      repeat('p', 87), repeat('a', 22));
  end loop;
  if (select count(*) from public.push_subscriptions) <> 5 then raise exception 'Expected five devices'; end if;
end; $$;
-- PAUSE HERE. Session A holds the per-user registration lock until ROLLBACK.

-- SESSION B: run this entire block while Session A remains open.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000005205', true);
set local lock_timeout = '1s';
do $$ begin
  begin
    perform public.enable_daily_transaction_reminder(
      'https://fcm.googleapis.com/fcm/send/concurrency-fixture-sixth', repeat('p', 87), repeat('a', 22));
    raise exception 'Concurrent registration incorrectly passed the held user lock';
  exception when lock_not_available then
    -- Expected: it cannot reach count/insert while A owns the user lock.
    null;
  end;
  if exists(select 1 from public.push_subscriptions) then raise exception 'Concurrent attempt left a row'; end if;
end; $$;
rollback;

-- SESSION A: now run this final block; the sixth call must fail with the cap,
-- confirming the same RPC checks count after the serialization boundary.
do $$ begin
  begin
    perform public.enable_daily_transaction_reminder(
      'https://fcm.googleapis.com/fcm/send/concurrency-fixture-sixth', repeat('p', 87), repeat('a', 22));
    raise exception 'Sixth device incorrectly accepted';
  exception when sqlstate 'P2002' then null;
  end;
  if (select count(*) from public.push_subscriptions) <> 5 then raise exception 'Cap changed'; end if;
end; $$;
rollback;

-- If either block aborts unexpectedly, issue ROLLBACK in BOTH connections.
-- The single-session DAILY_TRANSACTION_REMINDER_VERIFICATION.sql separately
-- covers count/update/removal, safe ownership conflicts and batching.
