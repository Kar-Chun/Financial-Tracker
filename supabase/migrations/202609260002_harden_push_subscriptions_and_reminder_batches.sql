-- Security Remediation Phase 2: no financial schema or historical row changes.
begin;

create or replace function public.enable_daily_transaction_reminder(
  p_endpoint text,
  p_p256dh text,
  p_auth text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_existing public.push_subscriptions%rowtype;
  v_inserted_id uuid;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication is required.';
  end if;
  if p_endpoint is null or char_length(p_endpoint) not between 1 and 2048
    or p_endpoint !~ '^https://(([A-Za-z0-9-]+[.])*(push[.]apple[.]com|push[.]services[.]mozilla[.]com|notify[.]windows[.]com)|fcm[.]googleapis[.]com)(/|$)' then
    raise exception using errcode = '22023', message = 'Push subscription is invalid.';
  end if;
  if p_p256dh is null or char_length(p_p256dh) not between 40 and 200 or p_p256dh !~ '^[A-Za-z0-9_-]+$'
    or p_auth is null or char_length(p_auth) not between 10 and 100 or p_auth !~ '^[A-Za-z0-9_-]+$' then
    raise exception using errcode = '22023', message = 'Push subscription keys are invalid.';
  end if;

  -- All registrations by this user serialize before the count and insert.
  -- Existing rows are active subscriptions; expired devices are physically removed.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('ledgerly.push.registration:' || v_user_id::text, 0)
  );
  select subscription.* into v_existing
  from public.push_subscriptions subscription
  where subscription.endpoint = p_endpoint
  for update;

  if found then
    if v_existing.user_id <> v_user_id then
      raise exception using errcode = 'P2001', message = 'This notification subscription cannot be registered.';
    end if;
    -- Re-registering your own device consumes no additional slot, even for a
    -- legacy account already above the cap. Never reassign endpoint ownership.
    update public.push_subscriptions
    set p256dh = p_p256dh, auth = p_auth, updated_at = clock_timestamp()
    where id = v_existing.id and user_id = v_user_id;
  else
    if (select count(*) from public.push_subscriptions where user_id = v_user_id) >= 5 then
      raise exception using errcode = 'P2002', message = 'Notification device limit reached.';
    end if;
    insert into public.push_subscriptions (user_id, endpoint, p256dh, auth)
    values (v_user_id, p_endpoint, p_p256dh, p_auth)
    on conflict (endpoint) do nothing
    returning id into v_inserted_id;
    -- Two different users can concurrently offer a previously unknown endpoint.
    -- The unique constraint chooses the owner; the loser gets no row details.
    if v_inserted_id is null then
      raise exception using errcode = 'P2001', message = 'This notification subscription cannot be registered.';
    end if;
  end if;

  insert into public.notification_preferences (user_id, daily_reminder_enabled)
  values (v_user_id, true)
  on conflict (user_id) do update
  set daily_reminder_enabled = true,
      updated_at = clock_timestamp();

  return public.get_notification_settings();
end;
$$;

create or replace function public.claim_daily_transaction_reminders(
  p_local_date date default ((clock_timestamp() at time zone 'Asia/Singapore')::date),
  p_limit integer default 50
)
returns table (delivery_id uuid, claimed_user_id uuid, reminder_local_date date)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_candidate record;
  v_delivery_id uuid;
begin
  if p_local_date is null or p_limit is null or p_limit not between 1 and 200 then
    raise exception using errcode = '22023', message = 'Reminder claim parameters are invalid.';
  end if;

  -- Serialize short claim transactions for this date so parallel invocations
  -- do not mistake a conflicting first batch for the end of the eligible set.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('ledgerly.reminder.claim:' || p_local_date::text, 0)
  );

  for v_candidate in
    select preference.user_id
    from public.notification_preferences preference
    where preference.daily_reminder_enabled
      and not exists (
        select 1 from public.notification_deliveries delivery
        where delivery.user_id = preference.user_id
          and delivery.notification_type = 'daily_transaction_reminder'
          and delivery.local_date = p_local_date
      )
    order by preference.user_id
    limit p_limit
  loop
    v_delivery_id := null;
    insert into public.notification_deliveries (
      user_id, notification_type, local_date, status
    ) values (
      v_candidate.user_id, 'daily_transaction_reminder', p_local_date, 'claimed'
    )
    on conflict (user_id, notification_type, local_date) do nothing
    returning id into v_delivery_id;

    if v_delivery_id is not null then
      delivery_id := v_delivery_id;
      claimed_user_id := v_candidate.user_id;
      reminder_local_date := p_local_date;
      return next;
    end if;
  end loop;
end;
$$;

-- CREATE OR REPLACE preserves existing ownership and execute grants.
-- Browser registration remains authenticated-only; claiming remains service-only.
commit;
