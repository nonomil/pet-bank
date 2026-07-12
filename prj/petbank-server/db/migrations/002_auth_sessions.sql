alter table accounts add column identifier text;
update accounts set identifier = email where identifier is null;
create unique index if not exists idx_accounts_identifier on accounts(identifier);

create table auth_refresh_tokens (
    id text primary key,
    account_id text not null references accounts(id) on delete cascade,
    token_hash text not null unique,
    expires_at integer not null,
    created_at text not null default current_timestamp,
    revoked_at integer,
    replaced_by_id text references auth_refresh_tokens(id)
);

create index idx_auth_refresh_tokens_account_id on auth_refresh_tokens(account_id);
create index idx_auth_refresh_tokens_active on auth_refresh_tokens(token_hash, revoked_at, expires_at);

create table household_invites (
    id text primary key,
    household_id text not null references households(id) on delete cascade,
    created_by_account_id text not null references accounts(id),
    code text not null unique,
    role text not null default 'parent' check (role = 'parent'),
    expires_at integer not null,
    redeemed_by_account_id text references accounts(id),
    redeemed_at integer,
    created_at text not null default current_timestamp
);

create index idx_household_invites_household_id on household_invites(household_id);
create index idx_household_invites_active on household_invites(code, expires_at, redeemed_at);
