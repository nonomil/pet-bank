create table if not exists public.registration_invites (
    id uuid primary key default gen_random_uuid(),
    invite_code citext not null unique,
    status text not null default 'pending' check (status in ('pending', 'claimed', 'expired', 'revoked')),
    label text,
    expires_at timestamptz,
    created_by_account_id uuid references public.accounts(id) on delete set null,
    claimed_by_account_id uuid references public.accounts(id) on delete set null,
    claimed_at timestamptz,
    metadata_json jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
);

create index if not exists registration_invites_status_idx
    on public.registration_invites(status);

create index if not exists registration_invites_expires_at_idx
    on public.registration_invites(expires_at);

alter table public.registration_invites enable row level security;

create policy "registration_invites_no_direct_select"
    on public.registration_invites
    for select
    using (false);

create policy "registration_invites_no_direct_insert"
    on public.registration_invites
    for insert
    with check (false);

create policy "registration_invites_no_direct_update"
    on public.registration_invites
    for update
    using (false)
    with check (false);
