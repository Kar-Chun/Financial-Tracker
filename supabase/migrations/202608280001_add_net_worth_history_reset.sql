begin;

create or replace function public.reset_net_worth_history()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_local_date date;
  v_snapshot_id uuid;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication is required.';
  end if;

  select (clock_timestamp() at time zone profile.timezone)::date
  into v_local_date
  from public.profiles profile
  where profile.id = v_user_id;

  if not found then
    raise exception using errcode = '23514', message = 'A user profile is required.';
  end if;

  -- A reset must not erase usable history before today's complete represented
  -- value can be reproduced. This uses the same Detailed valuation helper as
  -- account summaries and daily snapshot generation.
  if exists (
    select 1
    from public.accounts account
    left join lateral public.get_detailed_investment_value(account.id, v_local_date) represented
      on true
    where account.user_id = v_user_id
      and account.archived_at is null
      and account.account_type = 'investment'
      and account.investment_tracking_mode = 'detailed'
      and coalesce(represented.base_value_available, false) = false
  ) then
    raise exception using
      errcode = '23514',
      message = 'Current net worth is incomplete. Update missing investment prices or FX rates before resetting history.';
  end if;

  delete from public.net_worth_snapshots snapshot
  where snapshot.user_id = v_user_id;

  -- Reuse the authoritative timezone-aware snapshot calculation. Its unique
  -- user/date constraint guarantees exactly one replacement point for today.
  v_snapshot_id := public.refresh_snapshot_for_user(v_user_id);

  return v_snapshot_id;
end;
$$;

revoke all on function public.reset_net_worth_history() from public, anon;
grant execute on function public.reset_net_worth_history() to authenticated;

commit;
