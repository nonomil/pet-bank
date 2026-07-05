alter table public.child_profiles
    add column if not exists home_visibility text not null default 'friends'
        check (home_visibility in ('private', 'friends')),
    add column if not exists pet_summary_json jsonb not null default '{}'::jsonb,
    add column if not exists home_summary_json jsonb not null default '{}'::jsonb,
    add column if not exists last_synced_at timestamptz;

create index if not exists child_profiles_home_visibility_idx
    on public.child_profiles(home_visibility);

create or replace function public.can_view_child_house(target_child_id uuid)
returns boolean
language sql
stable
as $$
    select exists (
        select 1
        from public.child_profiles cp
        where cp.id = target_child_id
          and (
            public.can_access_child_profile(cp.id)
            or (
                cp.home_visibility = 'friends'
                and exists (
                    select 1
                    from public.child_friendships cf
                    where cf.child_id = cp.id
                      and cf.status = 'active'
                      and public.can_access_child_profile(cf.friend_child_id)
                )
            )
          )
    );
$$;

create policy "child_profiles_select_friend_house"
    on public.child_profiles
    for select
    using (public.can_view_child_house(id));
