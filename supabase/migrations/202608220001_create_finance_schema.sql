begin;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  base_currency text not null default 'SGD',
  timezone text not null default 'Asia/Singapore',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_display_name_check
    check (display_name is null or (char_length(btrim(display_name)) between 1 and 100)),
  constraint profiles_base_currency_check
    check (base_currency ~ '^[A-Z]{3}$'),
  constraint profiles_timezone_check
    check (char_length(btrim(timezone)) between 1 and 100)
);

create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  account_type text not null,
  institution text,
  currency_code text not null default 'SGD',
  opening_balance_minor bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  constraint accounts_name_check
    check (char_length(btrim(name)) between 1 and 100),
  constraint accounts_type_check
    check (account_type in ('bank', 'cash', 'investment')),
  constraint accounts_institution_check
    check (institution is null or char_length(btrim(institution)) between 1 and 100),
  constraint accounts_currency_check
    check (currency_code ~ '^[A-Z]{3}$'),
  constraint accounts_id_user_unique unique (id, user_id)
);

create index accounts_active_user_idx
  on public.accounts (user_id, account_type)
  where archived_at is null;

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  parent_id uuid,
  category_type text not null,
  created_at timestamptz not null default now(),
  archived_at timestamptz,
  constraint categories_name_check
    check (char_length(btrim(name)) between 1 and 100),
  constraint categories_type_check
    check (category_type in ('expense', 'income')),
  constraint categories_not_self_parent_check
    check (parent_id is null or parent_id <> id),
  constraint categories_id_user_unique unique (id, user_id),
  constraint categories_parent_same_user_fk
    foreign key (parent_id, user_id)
    references public.categories (id, user_id)
);

create unique index categories_active_root_name_idx
  on public.categories (user_id, category_type, lower(name))
  where parent_id is null and archived_at is null;

create unique index categories_active_child_name_idx
  on public.categories (user_id, parent_id, lower(name))
  where parent_id is not null and archived_at is null;

create index categories_active_user_type_idx
  on public.categories (user_id, category_type, parent_id)
  where archived_at is null;

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  transaction_type text not null,
  category_id uuid,
  description text,
  transaction_date date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint transactions_type_check
    check (transaction_type in ('expense', 'income', 'transfer', 'refund', 'adjustment')),
  constraint transactions_description_check
    check (description is null or char_length(description) <= 500),
  constraint transactions_id_user_unique unique (id, user_id),
  constraint transactions_category_same_user_fk
    foreign key (category_id, user_id)
    references public.categories (id, user_id)
);

create index transactions_active_user_date_idx
  on public.transactions (user_id, transaction_date desc, created_at desc)
  where deleted_at is null;

create index transactions_active_category_idx
  on public.transactions (category_id)
  where deleted_at is null and category_id is not null;

create table public.transaction_entries (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.transactions(id) on delete cascade,
  account_id uuid not null references public.accounts(id),
  amount_minor bigint not null,
  created_at timestamptz not null default now(),
  constraint transaction_entries_amount_nonzero_check
    check (amount_minor <> 0),
  constraint transaction_entries_account_once_unique
    unique (transaction_id, account_id)
);

create index transaction_entries_account_idx
  on public.transaction_entries (account_id, transaction_id);

create table public.investment_valuations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null,
  native_value_minor bigint not null,
  base_value_minor bigint not null,
  valued_at date not null,
  created_at timestamptz not null default now(),
  constraint investment_valuations_native_nonnegative_check
    check (native_value_minor >= 0),
  constraint investment_valuations_base_nonnegative_check
    check (base_value_minor >= 0),
  constraint investment_valuations_account_same_user_fk
    foreign key (account_id, user_id)
    references public.accounts (id, user_id),
  constraint investment_valuations_account_date_unique
    unique (account_id, valued_at)
);

create index investment_valuations_latest_idx
  on public.investment_valuations (account_id, valued_at desc, created_at desc);

create table public.net_worth_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  snapshot_date date not null,
  bank_value_base_minor bigint not null,
  cash_value_base_minor bigint not null,
  investment_value_base_minor bigint not null,
  total_value_base_minor bigint not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint net_worth_snapshots_total_check
    check (
      total_value_base_minor =
        bank_value_base_minor + cash_value_base_minor + investment_value_base_minor
    ),
  constraint net_worth_snapshots_user_date_unique
    unique (user_id, snapshot_date)
);

create index net_worth_snapshots_user_date_idx
  on public.net_worth_snapshots (user_id, snapshot_date desc);

commit;
