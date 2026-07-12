alter table accounts add column username text;
update accounts set username = coalesce(identifier, lower(replace(email, '@local.petbank.invalid', '')))
where username is null;
create unique index if not exists idx_accounts_username on accounts(username);
