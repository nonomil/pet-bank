create or replace function public.can_view_child_social_profile(target_child_id uuid)
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
            or exists (
                select 1
                from public.child_friendships cf
                where cf.child_id = cp.id
                  and cf.status = 'active'
                  and public.can_access_child_profile(cf.friend_child_id)
            )
          )
    );
$$;

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
                and public.can_view_child_social_profile(cp.id)
            )
          )
    );
$$;

create or replace function public.get_child_social_profiles(target_ids uuid[])
returns table (
    id uuid,
    display_name text,
    emoji text,
    home_visibility text,
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
        cp.home_visibility,
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
