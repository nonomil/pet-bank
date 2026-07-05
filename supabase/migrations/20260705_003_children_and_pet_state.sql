create table if not exists child_profiles (
    id uuid primary key default gen_random_uuid(),
    household_id uuid not null references public.households(id) on delete cascade,
    local_profile_id text,
    display_name text not null,
    emoji text,
    friend_code text unique,
    status text not null default 'active' check (status in ('active', 'archived')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (household_id, local_profile_id)
);

create table if not exists pet_state_snapshots (
    id uuid primary key default gen_random_uuid(),
    child_id uuid not null references public.child_profiles(id) on delete cascade,
    pet_species_id text,
    pet_name text,
    payload_json jsonb not null default '{}'::jsonb,
    source text not null default 'local_import' check (source in ('local_import', 'manual_sync', 'cloud_runtime')),
    created_by_account_id uuid references public.accounts(id) on delete set null,
    created_at timestamptz not null default now()
);

create or replace function public.can_access_child_profile(target_child_id uuid)
returns boolean
language sql
stable
as $$
    select exists (
        select 1
        from public.child_profiles cp
        join public.household_members hm
          on hm.household_id = cp.household_id
        where cp.id = target_child_id
          and hm.account_id = auth.uid()
          and hm.status = 'active'
    );
$$;

create index if not exists child_profiles_household_id_idx
    on public.child_profiles(household_id);

create index if not exists pet_state_snapshots_child_id_idx
    on public.pet_state_snapshots(child_id, created_at desc);

alter table public.child_profiles enable row level security;
alter table public.pet_state_snapshots enable row level security;

create policy "child_profiles_select_household_members"
    on public.child_profiles
    for select
    using (public.is_household_member(household_id));

create policy "child_profiles_insert_household_members"
    on public.child_profiles
    for insert
    with check (public.is_household_member(household_id));

create policy "child_profiles_update_household_members"
    on public.child_profiles
    for update
    using (public.is_household_member(household_id));

create policy "pet_state_snapshots_select_household_members"
    on public.pet_state_snapshots
    for select
    using (public.can_access_child_profile(child_id));

create policy "pet_state_snapshots_insert_household_members"
    on public.pet_state_snapshots
    for insert
    with check (public.can_access_child_profile(child_id));
