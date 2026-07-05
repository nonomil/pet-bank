create or replace function public.can_access_pk_match(target_match_id uuid)
returns boolean
language sql
stable
as $$
    select exists (
        select 1
        from public.pk_matches pm
        where pm.id = target_match_id
          and (
            public.can_access_child_profile(pm.challenger_child_id)
            or public.can_access_child_profile(pm.opponent_child_id)
          )
    );
$$;

create table if not exists public.pk_question_sets (
    id uuid primary key default gen_random_uuid(),
    game_type text not null check (game_type in ('mathpk', 'hanzi')),
    payload_json jsonb not null,
    difficulty text,
    created_by_account_id uuid not null references public.accounts(id) on delete cascade,
    created_at timestamptz not null default now()
);

create table if not exists public.pk_matches (
    id uuid primary key default gen_random_uuid(),
    game_type text not null check (game_type in ('mathpk', 'hanzi')),
    question_set_id uuid not null references public.pk_question_sets(id) on delete cascade,
    challenger_child_id uuid not null references public.child_profiles(id) on delete cascade,
    opponent_child_id uuid not null references public.child_profiles(id) on delete cascade,
    status text not null default 'pending' check (status in ('pending', 'active', 'completed', 'expired', 'cancelled')),
    difficulty text,
    expires_at timestamptz,
    created_by_account_id uuid not null references public.accounts(id) on delete cascade,
    created_at timestamptz not null default now(),
    constraint pk_matches_not_self check (challenger_child_id <> opponent_child_id)
);

create table if not exists public.pk_match_attempts (
    id uuid primary key default gen_random_uuid(),
    match_id uuid not null references public.pk_matches(id) on delete cascade,
    child_id uuid not null references public.child_profiles(id) on delete cascade,
    score integer not null default 0,
    correct_count integer,
    duration_ms integer,
    payload_json jsonb not null default '{}'::jsonb,
    completed_at timestamptz not null default now(),
    unique (match_id, child_id)
);

create index if not exists pk_matches_question_set_id_idx
    on public.pk_matches(question_set_id);

create index if not exists pk_matches_challenger_idx
    on public.pk_matches(challenger_child_id, created_at desc);

create index if not exists pk_matches_opponent_idx
    on public.pk_matches(opponent_child_id, created_at desc);

create index if not exists pk_match_attempts_match_id_idx
    on public.pk_match_attempts(match_id);

alter table public.pk_question_sets enable row level security;
alter table public.pk_matches enable row level security;
alter table public.pk_match_attempts enable row level security;

create policy "pk_question_sets_select_match_participants"
    on public.pk_question_sets
    for select
    using (
        exists (
            select 1
            from public.pk_matches pm
            where pm.question_set_id = id
              and (
                public.can_access_child_profile(pm.challenger_child_id)
                or public.can_access_child_profile(pm.opponent_child_id)
              )
        )
    );

create policy "pk_question_sets_insert_owner"
    on public.pk_question_sets
    for insert
    with check (created_by_account_id = auth.uid());

create policy "pk_matches_select_participants"
    on public.pk_matches
    for select
    using (
        public.can_access_child_profile(challenger_child_id)
        or public.can_access_child_profile(opponent_child_id)
    );

create policy "pk_matches_insert_friend_matches"
    on public.pk_matches
    for insert
    with check (
        created_by_account_id = auth.uid()
        and public.can_access_child_profile(challenger_child_id)
        and public.can_children_interact(challenger_child_id, opponent_child_id)
        and public.can_challenge_child(challenger_child_id, opponent_child_id)
    );

create policy "pk_match_attempts_select_participants"
    on public.pk_match_attempts
    for select
    using (public.can_access_pk_match(match_id));

create policy "pk_match_attempts_insert_participants"
    on public.pk_match_attempts
    for insert
    with check (
        public.can_access_pk_match(match_id)
        and public.can_access_child_profile(child_id)
    );
