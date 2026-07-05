alter table public.child_profiles
    add column if not exists visit_access text not null default 'friends'
        check (visit_access in ('private', 'friends')),
    add column if not exists pk_access text not null default 'friends'
        check (pk_access in ('private', 'friends'));

create index if not exists child_profiles_visit_access_idx
    on public.child_profiles(visit_access);

create index if not exists child_profiles_pk_access_idx
    on public.child_profiles(pk_access);

create or replace function public.can_child_receive_visit(visitor_child_id uuid, target_child_id uuid)
returns boolean
language sql
stable
as $$
    select exists (
        select 1
        from public.child_profiles visitor_child
        join public.child_profiles target_child
          on target_child.id = target_child_id
        where visitor_child.id = visitor_child_id
          and visitor_child.id <> target_child.id
          and (
            visitor_child.household_id = target_child.household_id
            or (
                target_child.visit_access = 'friends'
                and public.are_children_friends(visitor_child_id, target_child_id)
            )
          )
    );
$$;

create or replace function public.can_challenge_child(challenger_child_id uuid, target_child_id uuid)
returns boolean
language sql
stable
as $$
    select exists (
        select 1
        from public.child_profiles challenger_child
        join public.child_profiles target_child
          on target_child.id = target_child_id
        where challenger_child.id = challenger_child_id
          and challenger_child.id <> target_child.id
          and (
            challenger_child.household_id = target_child.household_id
            or (
                target_child.pk_access = 'friends'
                and public.are_children_friends(challenger_child_id, target_child_id)
            )
          )
    );
$$;

drop function if exists public.get_child_social_profiles(uuid[]);
create function public.get_child_social_profiles(target_ids uuid[])
returns table (
    id uuid,
    display_name text,
    emoji text,
    friend_code text,
    home_visibility text,
    visit_access text,
    pk_access text,
    pet_summary_json jsonb,
    home_summary_json jsonb,
    last_synced_at timestamptz
)
language sql
stable
as $$
    select
        cp.id,
        cp.display_name,
        cp.emoji,
        cp.friend_code,
        cp.home_visibility,
        cp.visit_access,
        cp.pk_access,
        case
            when public.can_view_child_house(cp.id) then cp.pet_summary_json
            else '{}'::jsonb
        end as pet_summary_json,
        case
            when public.can_view_child_house(cp.id) then cp.home_summary_json
            else '{}'::jsonb
        end as home_summary_json,
        cp.last_synced_at
    from public.child_profiles cp
    where cp.id = any(coalesce(target_ids, array[]::uuid[]))
      and public.can_view_child_social_profile(cp.id)
    order by array_position(target_ids, cp.id);
$$;
