begin;

alter table public.profiles enable row level security;
alter table public.accounts enable row level security;
alter table public.categories enable row level security;
alter table public.transactions enable row level security;
alter table public.transaction_entries enable row level security;
alter table public.investment_valuations enable row level security;
alter table public.net_worth_snapshots enable row level security;

create policy profiles_select_own
on public.profiles
for select
to authenticated
using ((select auth.uid()) = id);

create policy profiles_update_own
on public.profiles
for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

create policy accounts_select_own
on public.accounts
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy categories_select_own
on public.categories
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy transactions_select_active_own
on public.transactions
for select
to authenticated
using (
  (select auth.uid()) = user_id
  and deleted_at is null
);

create policy transaction_entries_select_active_own
on public.transaction_entries
for select
to authenticated
using (
  exists (
    select 1
    from public.transactions transaction_record
    join public.accounts account_record on account_record.id = transaction_entries.account_id
    where transaction_record.id = transaction_entries.transaction_id
      and transaction_record.user_id = (select auth.uid())
      and transaction_record.deleted_at is null
      and account_record.user_id = (select auth.uid())
  )
);

create policy investment_valuations_select_own
on public.investment_valuations
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy net_worth_snapshots_select_own
on public.net_worth_snapshots
for select
to authenticated
using ((select auth.uid()) = user_id);

revoke all on table public.profiles from anon, authenticated;
revoke all on table public.accounts from anon, authenticated;
revoke all on table public.categories from anon, authenticated;
revoke all on table public.transactions from anon, authenticated;
revoke all on table public.transaction_entries from anon, authenticated;
revoke all on table public.investment_valuations from anon, authenticated;
revoke all on table public.net_worth_snapshots from anon, authenticated;

grant select on table public.profiles to authenticated;
grant update (display_name, timezone) on table public.profiles to authenticated;
grant select on table public.accounts to authenticated;
grant select on table public.categories to authenticated;
grant select on table public.transactions to authenticated;
grant select on table public.transaction_entries to authenticated;
grant select on table public.investment_valuations to authenticated;
grant select on table public.net_worth_snapshots to authenticated;

revoke execute on function public.set_updated_at() from public, anon, authenticated;
revoke execute on function public.validate_profile_timezone() from public, anon, authenticated;
revoke execute on function public.validate_category_parent() from public, anon, authenticated;
revoke execute on function public.validate_transaction_entry_ownership() from public, anon, authenticated;
revoke execute on function public.validate_investment_valuation_account() from public, anon, authenticated;
revoke execute on function public.validate_transaction_integrity() from public, anon, authenticated;
revoke execute on function public.seed_default_categories(uuid) from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.refresh_snapshot_for_user(uuid) from public, anon, authenticated;

revoke execute on function public.refresh_net_worth_snapshot() from public, anon;
revoke execute on function public.get_account_summaries() from public, anon;
revoke execute on function public.upsert_account(text, text, text, bigint, text, uuid) from public, anon;
revoke execute on function public.archive_account(uuid) from public, anon;
revoke execute on function public.upsert_financial_transaction(text, bigint, uuid, date, uuid, uuid, text, uuid) from public, anon;
revoke execute on function public.soft_delete_transaction(uuid) from public, anon;
revoke execute on function public.upsert_investment_valuation(uuid, bigint, bigint, date) from public, anon;

grant execute on function public.refresh_net_worth_snapshot() to authenticated;
grant execute on function public.get_account_summaries() to authenticated;
grant execute on function public.upsert_account(text, text, text, bigint, text, uuid) to authenticated;
grant execute on function public.archive_account(uuid) to authenticated;
grant execute on function public.upsert_financial_transaction(text, bigint, uuid, date, uuid, uuid, text, uuid) to authenticated;
grant execute on function public.soft_delete_transaction(uuid) to authenticated;
grant execute on function public.upsert_investment_valuation(uuid, bigint, bigint, date) to authenticated;

commit;
