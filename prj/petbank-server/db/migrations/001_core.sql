create table accounts (
    id text primary key,
    email text not null unique,
    password_hash text not null,
    display_name text not null,
    created_at text not null default current_timestamp,
    updated_at text not null default current_timestamp
);

create table households (
    id text primary key,
    owner_account_id text not null references accounts(id),
    name text not null,
    created_at text not null default current_timestamp
);

create table household_members (
    household_id text not null references households(id) on delete cascade,
    account_id text not null references accounts(id) on delete cascade,
    role text not null check (role in ('owner', 'parent')),
    created_at text not null default current_timestamp,
    primary key (household_id, account_id)
);

create table children (
    id text primary key,
    household_id text not null references households(id) on delete cascade,
    name text not null,
    local_profile_id text,
    created_at text not null default current_timestamp,
    updated_at text not null default current_timestamp,
    unique (household_id, local_profile_id)
);

create table state_snapshots (
    id text primary key,
    child_id text not null references children(id) on delete cascade,
    revision integer not null,
    payload_json text not null,
    created_at text not null default current_timestamp,
    unique (child_id, revision)
);

create index idx_children_household_id on children(household_id);
create index idx_state_snapshots_child_id_created_at on state_snapshots(child_id, created_at desc);
