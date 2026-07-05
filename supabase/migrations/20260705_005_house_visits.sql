create or replace function public.are_children_friends(a uuid, b uuid)
returns boolean
language sql
stable
as $$
    select exists (
        select 1
        from public.child_friendships cf
        where cf.child_id = a
          and cf.friend_child_id = b
          and cf.status = 'active'
    );
$$;

create or replace function public.can_children_interact(a uuid, b uuid)
returns boolean
language sql
stable
as $$
    select
        public.are_children_friends(a, b)
        or exists (
            select 1
            from public.child_profiles source_child
            join public.child_profiles target_child
              on target_child.household_id = source_child.household_id
            where source_child.id = a
              and target_child.id = b
              and source_child.id <> target_child.id
        );
$$;

create table if not exists public.house_visits (
    id uuid primary key default gen_random_uuid(),
    from_child_id uuid not null references public.child_profiles(id) on delete cascade,
    to_child_id uuid not null references public.child_profiles(id) on delete cascade,
    action_type text not null check (action_type in ('visit', 'wave', 'gift', 'walk')),
    message text,
    metadata_json jsonb not null default '{}'::jsonb,
    created_by_account_id uuid references public.accounts(id) on delete set null,
    created_at timestamptz not null default now(),
    constraint house_visits_not_self check (from_child_id <> to_child_id)
);

create index if not exists house_visits_from_child_idx
    on public.house_visits(from_child_id, created_at desc);

create index if not exists house_visits_to_child_idx
    on public.house_visits(to_child_id, created_at desc);

alter table public.house_visits enable row level security;

create policy "house_visits_select_participants"
    on public.house_visits
    for select
    using (
        public.can_access_child_profile(from_child_id)
        or public.can_access_child_profile(to_child_id)
    );

create policy "house_visits_insert_friend_actions"
    on public.house_visits
    for insert
    with check (
        public.can_access_child_profile(from_child_id)
        and public.can_children_interact(from_child_id, to_child_id)
        and public.can_child_receive_visit(from_child_id, to_child_id)
    );
