begin;

create table public.notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  daily_reminder_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint push_subscriptions_endpoint_check check (
    char_length(endpoint) between 1 and 2048
    and endpoint ~ '^https://(([A-Za-z0-9-]+[.])*(push[.]apple[.]com|push[.]services[.]mozilla[.]com|notify[.]windows[.]com)|fcm[.]googleapis[.]com)(/|$)'
  ),
  constraint push_subscriptions_p256dh_check check (
    char_length(p256dh) between 40 and 200 and p256dh ~ '^[A-Za-z0-9_-]+$'
  ),
  constraint push_subscriptions_auth_check check (
    char_length(auth) between 10 and 100 and auth ~ '^[A-Za-z0-9_-]+$'
  ),
  constraint push_subscriptions_endpoint_unique unique (endpoint)
);

create index push_subscriptions_user_idx
  on public.push_subscriptions (user_id, updated_at desc);

create table public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  notification_type text not null,
  local_date date not null,
  status text not null default 'claimed'
    check (status in ('claimed', 'delivered', 'failed', 'disabled', 'no_subscription')),
  claimed_at timestamptz not null default clock_timestamp(),
  delivered_at timestamptz,
  completed_at timestamptz,
  failure_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notification_deliveries_type_check check (
    notification_type = 'daily_transaction_reminder'
  ),
  constraint notification_deliveries_failure_code_check check (
    failure_code is null or char_length(failure_code) between 1 and 100
  ),
  constraint notification_deliveries_user_type_date_unique
    unique (user_id, notification_type, local_date)
);

create trigger notification_preferences_set_updated_at
before update on public.notification_preferences
for each row execute function public.set_updated_at();

create trigger push_subscriptions_set_updated_at
before update on public.push_subscriptions
for each row execute function public.set_updated_at();

create trigger notification_deliveries_set_updated_at
before update on public.notification_deliveries
for each row execute function public.set_updated_at();

alter table public.notification_preferences enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.notification_deliveries enable row level security;

create policy notification_preferences_select_own
on public.notification_preferences
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy push_subscriptions_select_own
on public.push_subscriptions
for select
to authenticated
using ((select auth.uid()) = user_id);

create or replace function public.get_notification_settings()
returns jsonb
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  v_user_id uuid := auth.uid();
  v_result jsonb;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication is required.';
  end if;

  select jsonb_build_object(
    'user_id', v_user_id,
    'daily_reminder_enabled', preference.daily_reminder_enabled
  )
  into v_result
  from public.notification_preferences preference
  where preference.user_id = v_user_id;

  return coalesce(v_result, jsonb_build_object(
    'user_id', v_user_id,
    'daily_reminder_enabled', false
  ));
end;
$$;

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

  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth)
  values (v_user_id, p_endpoint, p_p256dh, p_auth)
  on conflict (endpoint) do update
  set user_id = excluded.user_id,
      p256dh = excluded.p256dh,
      auth = excluded.auth,
      updated_at = clock_timestamp();

  insert into public.notification_preferences (user_id, daily_reminder_enabled)
  values (v_user_id, true)
  on conflict (user_id) do update
  set daily_reminder_enabled = true,
      updated_at = clock_timestamp();

  return public.get_notification_settings();
end;
$$;

create or replace function public.set_daily_transaction_reminder(p_enabled boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication is required.';
  end if;
  if p_enabled is null then
    raise exception using errcode = '22023', message = 'Reminder preference is invalid.';
  end if;

  insert into public.notification_preferences (user_id, daily_reminder_enabled)
  values (v_user_id, p_enabled)
  on conflict (user_id) do update
  set daily_reminder_enabled = excluded.daily_reminder_enabled,
      updated_at = clock_timestamp();

  return public.get_notification_settings();
end;
$$;

create or replace function public.remove_current_push_subscription(p_endpoint text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication is required.';
  end if;
  if p_endpoint is null or char_length(p_endpoint) not between 1 and 2048 then
    raise exception using errcode = '22023', message = 'Push subscription is invalid.';
  end if;

  delete from public.push_subscriptions
  where user_id = v_user_id and endpoint = p_endpoint;
  return found;
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

  for v_candidate in
    select preference.user_id
    from public.notification_preferences preference
    where preference.daily_reminder_enabled
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

create or replace function public.complete_daily_transaction_reminder(
  p_delivery_id uuid,
  p_outcome text,
  p_failure_code text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
begin
  if p_delivery_id is null or p_outcome is null
    or p_outcome not in ('delivered', 'failed', 'disabled', 'no_subscription')
    or (p_failure_code is not null and char_length(p_failure_code) not between 1 and 100) then
    raise exception using errcode = '22023', message = 'Reminder completion is invalid.';
  end if;

  update public.notification_deliveries delivery
  set status = p_outcome,
      delivered_at = case when p_outcome = 'delivered' then v_now else null end,
      completed_at = v_now,
      failure_code = nullif(btrim(p_failure_code), ''),
      updated_at = v_now
  where delivery.id = p_delivery_id and delivery.status = 'claimed';
  return found;
end;
$$;

revoke all on table public.notification_preferences, public.push_subscriptions, public.notification_deliveries
  from public, anon, authenticated;
grant select on table public.notification_preferences, public.push_subscriptions to authenticated;

revoke all on function public.get_notification_settings() from public, anon;
revoke all on function public.enable_daily_transaction_reminder(text, text, text) from public, anon;
revoke all on function public.set_daily_transaction_reminder(boolean) from public, anon;
revoke all on function public.remove_current_push_subscription(text) from public, anon;
grant execute on function public.get_notification_settings() to authenticated;
grant execute on function public.enable_daily_transaction_reminder(text, text, text) to authenticated;
grant execute on function public.set_daily_transaction_reminder(boolean) to authenticated;
grant execute on function public.remove_current_push_subscription(text) to authenticated;

revoke all on function public.claim_daily_transaction_reminders(date, integer) from public, anon, authenticated;
revoke all on function public.complete_daily_transaction_reminder(uuid, text, text) from public, anon, authenticated;
grant execute on function public.claim_daily_transaction_reminders(date, integer) to service_role;
grant execute on function public.complete_daily_transaction_reminder(uuid, text, text) to service_role;

commit;
