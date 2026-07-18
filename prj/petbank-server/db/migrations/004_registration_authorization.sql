alter table accounts add column access_status text not null default 'active' check (access_status in ('active', 'suspended'));
alter table accounts add column authorization_required integer not null default 0 check (authorization_required in (0, 1));

create table registration_invites (
    id text primary key,
    code_hash text not null unique,
    code_hint text not null,
    label text not null default '',
    max_uses integer not null default 1 check (max_uses > 0),
    used_count integer not null default 0 check (used_count >= 0),
    expires_at integer,
    authorization_expires_at integer,
    revoked_at integer,
    created_at text not null default current_timestamp
);

create table account_access_grants (
    id text primary key,
    account_id text not null references accounts(id) on delete cascade,
    registration_invite_id text not null references registration_invites(id),
    expires_at integer,
    revoked_at integer,
    created_at text not null default current_timestamp
);

create index idx_registration_invites_active on registration_invites(code_hash, expires_at, revoked_at);
create index idx_account_access_grants_account on account_access_grants(account_id, revoked_at, expires_at);
