create table if not exists public.user_roles (
    account_id uuid not null references public.accounts(id) on delete cascade,
    role text not null check (role in ('admin')),
    granted_by_account_id uuid references public.accounts(id) on delete set null,
    granted_at timestamptz not null default now(),
    primary key (account_id, role)
);

create table if not exists public.admin_audit_logs (
    id uuid primary key default gen_random_uuid(),
    actor_account_id uuid not null references public.accounts(id) on delete restrict,
    action_type text not null,
    target_type text not null,
    target_id text,
    payload_json jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
);

create or replace function public.is_admin(target_account_id uuid default auth.uid())
returns boolean
language sql
stable
as $$
    select exists (
        select 1
        from public.user_roles ur
        where ur.account_id = target_account_id
          and ur.role = 'admin'
    );
$$;

create index if not exists user_roles_role_idx
    on public.user_roles(role);

create index if not exists admin_audit_logs_actor_created_idx
    on public.admin_audit_logs(actor_account_id, created_at desc);

alter table public.user_roles enable row level security;
alter table public.admin_audit_logs enable row level security;
