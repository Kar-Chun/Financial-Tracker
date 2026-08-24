begin;

create table public.ai_rate_limit_config (
  singleton boolean primary key default true check (singleton),
  per_minute_limit integer not null check (per_minute_limit between 1 and 1000),
  per_hour_limit integer not null check (per_hour_limit between 1 and 10000),
  per_day_limit integer not null check (per_day_limit between 1 and 100000),
  global_day_limit integer not null check (global_day_limit between 1 and 1000000),
  lease_seconds integer not null check (lease_seconds between 15 and 300),
  updated_at timestamptz not null default now()
);

insert into public.ai_rate_limit_config (
  singleton, per_minute_limit, per_hour_limit, per_day_limit, global_day_limit, lease_seconds
) values (true, 6, 30, 100, 500, 60);

create table public.ai_request_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  requested_at timestamptz not null default clock_timestamp(),
  lease_expires_at timestamptz not null,
  completed_at timestamptz,
  status text not null default 'active'
    check (status in ('active', 'succeeded', 'provider_error', 'timeout')),
  model text,
  constraint ai_request_usage_model_length check (model is null or char_length(model) between 1 and 100),
  constraint ai_request_usage_lease_order check (lease_expires_at > requested_at),
  constraint ai_request_usage_completion_state check (
    (status = 'active' and completed_at is null)
    or (status <> 'active' and completed_at is not null)
  )
);

create index ai_request_usage_user_requested_idx
  on public.ai_request_usage (user_id, requested_at desc);
create index ai_request_usage_requested_idx
  on public.ai_request_usage (requested_at desc);
create index ai_request_usage_active_lease_idx
  on public.ai_request_usage (user_id, lease_expires_at)
  where status = 'active';

alter table public.ai_rate_limit_config enable row level security;
alter table public.ai_request_usage enable row level security;

create or replace function public.claim_ai_request_slot(p_model text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_now timestamptz := clock_timestamp();
  v_config public.ai_rate_limit_config%rowtype;
  v_lease_id uuid;
  v_count bigint;
  v_retry_after integer;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication is required.';
  end if;
  if p_model is not null and char_length(btrim(p_model)) not between 1 and 100 then
    raise exception using errcode = '22023', message = 'Model identifier is invalid.';
  end if;

  -- Serialise claims so concurrent requests cannot pass count checks together.
  perform pg_catalog.pg_advisory_xact_lock(848301006);

  select * into v_config from public.ai_rate_limit_config where singleton;
  if v_config.singleton is null then
    raise exception 'AI rate-limit configuration is missing.';
  end if;

  delete from public.ai_request_usage where requested_at < v_now - interval '7 days';

  select ceil(extract(epoch from min(lease_expires_at) - v_now))::integer
  into v_retry_after
  from public.ai_request_usage
  where user_id = v_user_id and status = 'active' and lease_expires_at > v_now;
  if v_retry_after is not null then
    return jsonb_build_object('allowed', false, 'reason', 'busy', 'retry_after_seconds', greatest(v_retry_after, 1));
  end if;

  select count(*) into v_count from public.ai_request_usage
  where user_id = v_user_id and requested_at > v_now - interval '1 minute';
  if v_count >= v_config.per_minute_limit then
    select ceil(extract(epoch from min(requested_at) + interval '1 minute' - v_now))::integer
    into v_retry_after from public.ai_request_usage
    where user_id = v_user_id and requested_at > v_now - interval '1 minute';
    return jsonb_build_object('allowed', false, 'reason', 'minute', 'retry_after_seconds', greatest(v_retry_after, 1));
  end if;

  select count(*) into v_count from public.ai_request_usage
  where user_id = v_user_id and requested_at > v_now - interval '1 hour';
  if v_count >= v_config.per_hour_limit then
    select ceil(extract(epoch from min(requested_at) + interval '1 hour' - v_now))::integer
    into v_retry_after from public.ai_request_usage
    where user_id = v_user_id and requested_at > v_now - interval '1 hour';
    return jsonb_build_object('allowed', false, 'reason', 'hour', 'retry_after_seconds', greatest(v_retry_after, 1));
  end if;

  select count(*) into v_count from public.ai_request_usage
  where user_id = v_user_id and requested_at > v_now - interval '24 hours';
  if v_count >= v_config.per_day_limit then
    select ceil(extract(epoch from min(requested_at) + interval '24 hours' - v_now))::integer
    into v_retry_after from public.ai_request_usage
    where user_id = v_user_id and requested_at > v_now - interval '24 hours';
    return jsonb_build_object('allowed', false, 'reason', 'day', 'retry_after_seconds', greatest(v_retry_after, 1));
  end if;

  select count(*) into v_count from public.ai_request_usage
  where requested_at > v_now - interval '24 hours';
  if v_count >= v_config.global_day_limit then
    select ceil(extract(epoch from min(requested_at) + interval '24 hours' - v_now))::integer
    into v_retry_after from public.ai_request_usage
    where requested_at > v_now - interval '24 hours';
    return jsonb_build_object('allowed', false, 'reason', 'global', 'retry_after_seconds', greatest(v_retry_after, 1));
  end if;

  insert into public.ai_request_usage (user_id, requested_at, lease_expires_at, model)
  values (v_user_id, v_now, v_now + pg_catalog.make_interval(secs => v_config.lease_seconds), nullif(btrim(p_model), ''))
  returning id into v_lease_id;

  return jsonb_build_object('allowed', true, 'lease_id', v_lease_id);
end;
$$;

create or replace function public.complete_ai_request_slot(p_lease_id uuid, p_status text)
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
  if p_lease_id is null or p_status not in ('succeeded', 'provider_error', 'timeout') then
    raise exception using errcode = '22023', message = 'AI request completion is invalid.';
  end if;

  update public.ai_request_usage
  set status = p_status, completed_at = clock_timestamp()
  where id = p_lease_id and user_id = v_user_id and status = 'active';
  return found;
end;
$$;

revoke all on table public.ai_rate_limit_config, public.ai_request_usage from public, anon, authenticated;
revoke all on function public.claim_ai_request_slot(text), public.complete_ai_request_slot(uuid, text) from public, anon;
grant execute on function public.claim_ai_request_slot(text), public.complete_ai_request_slot(uuid, text) to authenticated;

commit;
