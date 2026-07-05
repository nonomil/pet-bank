create or replace function public.generate_friend_code()
returns text
language sql
volatile
as $$
    select 'PET-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
$$;

alter table public.child_profiles
    alter column friend_code set default public.generate_friend_code();

update public.child_profiles
set friend_code = public.generate_friend_code()
where friend_code is null or trim(friend_code) = '';

alter table public.child_profiles
    alter column friend_code set not null;

create table if not exists public.child_friendships (
    child_id uuid not null references public.child_profiles(id) on delete cascade,
    friend_child_id uuid not null references public.child_profiles(id) on delete cascade,
    status text not null default 'active' check (status in ('active', 'blocked', 'archived')),
    source text not null default 'friend_code' check (source in ('friend_code', 'invite', 'manual')),
    initiated_by_account_id uuid references public.accounts(id) on delete set null,
    created_at timestamptz not null default now(),
    primary key (child_id, friend_child_id),
    constraint child_friendships_not_self check (child_id <> friend_child_id)
);

create index if not exists child_friendships_friend_child_id_idx
    on public.child_friendships(friend_child_id);

alter table public.child_friendships enable row level security;

create policy "child_friendships_select_participants"
    on public.child_friendships
    for select
    using (
        public.can_access_child_profile(child_id)
        or public.can_access_child_profile(friend_child_id)
    );

create policy "child_friendships_insert_participants"
    on public.child_friendships
    for insert
    with check (
        public.can_access_child_profile(child_id)
        or public.can_access_child_profile(friend_child_id)
    );
