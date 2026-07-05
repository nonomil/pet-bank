create table if not exists public.accounts (
    id uuid primary key references auth.users(id) on delete cascade,
    email citext,
    parent_name text,
    created_at timestamptz not null default now()
);

create table if not exists public.households (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    owner_account_id uuid not null references public.accounts(id) on delete restrict,
    created_at timestamptz not null default now()
);

create table if not exists household_members (
    household_id uuid not null references public.households(id) on delete cascade,
    account_id uuid not null references public.accounts(id) on delete cascade,
    role text not null check (role in ('owner', 'guardian')),
    status text not null default 'active' check (status in ('pending', 'active', 'archived')),
    created_at timestamptz not null default now(),
    primary key (household_id, account_id)
);

create table if not exists public.household_invites (
    id uuid primary key default gen_random_uuid(),
    household_id uuid not null references public.households(id) on delete cascade,
    invite_code text not null unique,
    invited_by_account_id uuid not null references public.accounts(id) on delete cascade,
    role text not null default 'guardian' check (role in ('guardian')),
    status text not null default 'pending' check (status in ('pending', 'accepted', 'expired', 'revoked')),
    expires_at timestamptz,
    created_at timestamptz not null default now(),
    claimed_by_account_id uuid references public.accounts(id) on delete set null,
    claimed_at timestamptz
);

create or replace function public.is_household_member(target_household_id uuid)
returns boolean
language sql
stable
as $$
    select exists (
        select 1
        from public.household_members hm
        where hm.household_id = target_household_id
          and hm.account_id = auth.uid()
          and hm.status = 'active'
    );
$$;

create index if not exists household_members_account_id_idx
    on public.household_members(account_id);

create index if not exists household_invites_household_id_idx
    on public.household_invites(household_id);

alter table public.accounts enable row level security;
alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.household_invites enable row level security;

create policy "accounts_select_self"
    on public.accounts
    for select
    using (id = auth.uid());

create policy "accounts_upsert_self"
    on public.accounts
    for insert
    with check (id = auth.uid());

create policy "accounts_update_self"
    on public.accounts
    for update
    using (id = auth.uid())
    with check (id = auth.uid());

create policy "households_insert_owner"
    on public.households
    for insert
    with check (owner_account_id = auth.uid());

create policy "households_update_owner"
    on public.households
    for update
    using (owner_account_id = auth.uid())
    with check (owner_account_id = auth.uid());

create policy "households_select_members"
    on public.households
    for select
    using (public.is_household_member(id));

create policy "household_members_select_same_household"
    on public.household_members
    for select
    using (
        account_id = auth.uid()
        or public.is_household_member(household_id)
    );

create policy "household_members_insert_self"
    on public.household_members
    for insert
    with check (account_id = auth.uid());

create policy "household_invites_select_members"
    on public.household_invites
    for select
    using (public.is_household_member(household_id));
