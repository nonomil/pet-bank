create table if not exists public.activity_feed (
    id uuid primary key default gen_random_uuid(),
    household_id uuid not null references public.households(id) on delete cascade,
    child_id uuid references public.child_profiles(id) on delete set null,
    event_type text not null check (event_type in (
        'friendship',
        'house_visit',
        'pk_match_issued',
        'pk_match_submitted',
        'pk_match_completed'
    )),
    summary text not null,
    payload_json jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
);

create index if not exists activity_feed_household_idx
    on public.activity_feed(household_id, created_at desc);

create index if not exists activity_feed_child_idx
    on public.activity_feed(child_id, created_at desc);

alter table public.activity_feed enable row level security;

create policy "activity_feed_select_household_members"
    on public.activity_feed
    for select
    using (public.is_household_member(household_id));

create or replace function public.append_activity_feed_entry(
    target_household_id uuid,
    target_child_id uuid,
    target_event_type text,
    target_summary text,
    target_payload_json jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    if target_household_id is null or coalesce(trim(target_summary), '') = '' then
        return;
    end if;

    insert into public.activity_feed (
        household_id,
        child_id,
        event_type,
        summary,
        payload_json
    ) values (
        target_household_id,
        target_child_id,
        target_event_type,
        target_summary,
        coalesce(target_payload_json, '{}'::jsonb)
    );
end;
$$;

create or replace function public.log_friendship_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    left_child public.child_profiles%rowtype;
    right_child public.child_profiles%rowtype;
    payload jsonb;
    summary_text text;
begin
    if tg_op <> 'INSERT' then
        return new;
    end if;

    if new.child_id::text > new.friend_child_id::text then
        return new;
    end if;

    select * into left_child
    from public.child_profiles
    where id = new.child_id;

    select * into right_child
    from public.child_profiles
    where id = new.friend_child_id;

    if left_child.id is null or right_child.id is null then
        return new;
    end if;

    summary_text := coalesce(left_child.display_name, '孩子')
        || ' 和 '
        || coalesce(right_child.display_name, '好友')
        || ' 成为好友';

    payload := jsonb_build_object(
        'childId', left_child.id,
        'friendChildId', right_child.id,
        'source', new.source
    );

    perform public.append_activity_feed_entry(
        left_child.household_id,
        left_child.id,
        'friendship',
        summary_text,
        payload
    );

    if right_child.household_id is distinct from left_child.household_id then
        perform public.append_activity_feed_entry(
            right_child.household_id,
            right_child.id,
            'friendship',
            summary_text,
            payload
        );
    end if;

    return new;
end;
$$;

create or replace function public.log_house_visit_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    from_child public.child_profiles%rowtype;
    to_child public.child_profiles%rowtype;
    payload jsonb;
    actor_summary text;
    target_summary text;
    action_label text;
begin
    select * into from_child
    from public.child_profiles
    where id = new.from_child_id;

    select * into to_child
    from public.child_profiles
    where id = new.to_child_id;

    if from_child.id is null or to_child.id is null then
        return new;
    end if;

    action_label := case new.action_type
        when 'wave' then '打了招呼'
        when 'gift' then '送了小花'
        when 'walk' then '一起去遛弯'
        else '来串门了'
    end;

    actor_summary := coalesce(from_child.display_name, '孩子')
        || ' 对 '
        || coalesce(to_child.display_name, '同伴')
        || action_label;

    target_summary := coalesce(from_child.display_name, '好友')
        || action_label;

    payload := jsonb_build_object(
        'visitId', new.id,
        'fromChildId', from_child.id,
        'toChildId', to_child.id,
        'actionType', new.action_type,
        'message', new.message
    );

    perform public.append_activity_feed_entry(
        from_child.household_id,
        from_child.id,
        'house_visit',
        actor_summary,
        payload
    );

    if to_child.household_id is distinct from from_child.household_id then
        perform public.append_activity_feed_entry(
            to_child.household_id,
            to_child.id,
            'house_visit',
            target_summary,
            payload
        );
    end if;

    return new;
end;
$$;

create or replace function public.log_pk_match_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    challenger public.child_profiles%rowtype;
    opponent public.child_profiles%rowtype;
    payload jsonb;
    summary_text text;
    game_label text;
    challenger_score integer;
    opponent_score integer;
begin
    select * into challenger
    from public.child_profiles
    where id = new.challenger_child_id;

    select * into opponent
    from public.child_profiles
    where id = new.opponent_child_id;

    if challenger.id is null or opponent.id is null then
        return new;
    end if;

    game_label := case new.game_type
        when 'hanzi' then '汉字'
        else '数学'
    end;

    payload := jsonb_build_object(
        'matchId', new.id,
        'gameType', new.game_type,
        'challengerChildId', challenger.id,
        'opponentChildId', opponent.id,
        'status', new.status
    );

    if tg_op = 'INSERT' then
        summary_text := coalesce(challenger.display_name, '孩子')
            || ' 向 '
            || coalesce(opponent.display_name, '同伴')
            || ' 发起了'
            || game_label
            || ' PK';

        perform public.append_activity_feed_entry(
            challenger.household_id,
            challenger.id,
            'pk_match_issued',
            summary_text,
            payload
        );

        if opponent.household_id is distinct from challenger.household_id then
            perform public.append_activity_feed_entry(
                opponent.household_id,
                opponent.id,
                'pk_match_issued',
                summary_text,
                payload
            );
        end if;
    elsif tg_op = 'UPDATE'
        and new.status = 'completed'
        and old.status is distinct from new.status then
        select score into challenger_score
        from public.pk_match_attempts
        where match_id = new.id
          and child_id = challenger.id
        limit 1;

        select score into opponent_score
        from public.pk_match_attempts
        where match_id = new.id
          and child_id = opponent.id
        limit 1;

        summary_text := game_label
            || ' PK 完赛：'
            || coalesce(challenger.display_name, '挑战方')
            || ' '
            || coalesce(challenger_score, 0)
            || ' 分 vs '
            || coalesce(opponent.display_name, '应战方')
            || ' '
            || coalesce(opponent_score, 0)
            || ' 分';

        payload := payload || jsonb_build_object(
            'challengerScore', challenger_score,
            'opponentScore', opponent_score
        );

        perform public.append_activity_feed_entry(
            challenger.household_id,
            challenger.id,
            'pk_match_completed',
            summary_text,
            payload
        );

        if opponent.household_id is distinct from challenger.household_id then
            perform public.append_activity_feed_entry(
                opponent.household_id,
                opponent.id,
                'pk_match_completed',
                summary_text,
                payload
            );
        end if;
    end if;

    return new;
end;
$$;

create or replace function public.log_pk_attempt_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    match_row public.pk_matches%rowtype;
    actor_child public.child_profiles%rowtype;
    peer_child public.child_profiles%rowtype;
    payload jsonb;
    summary_text text;
    game_label text;
begin
    select * into match_row
    from public.pk_matches
    where id = new.match_id;

    select * into actor_child
    from public.child_profiles
    where id = new.child_id;

    if match_row.id is null or actor_child.id is null then
        return new;
    end if;

    select * into peer_child
    from public.child_profiles
    where id = case
        when match_row.challenger_child_id = actor_child.id then match_row.opponent_child_id
        else match_row.challenger_child_id
    end;

    if peer_child.id is null then
        return new;
    end if;

    game_label := case match_row.game_type
        when 'hanzi' then '汉字'
        else '数学'
    end;

    summary_text := coalesce(actor_child.display_name, '孩子')
        || ' 提交了'
        || game_label
        || ' PK 成绩';

    payload := jsonb_build_object(
        'matchId', match_row.id,
        'gameType', match_row.game_type,
        'childId', actor_child.id,
        'peerChildId', peer_child.id,
        'score', new.score,
        'durationMs', new.duration_ms
    );

    perform public.append_activity_feed_entry(
        actor_child.household_id,
        actor_child.id,
        'pk_match_submitted',
        summary_text,
        payload
    );

    if peer_child.household_id is distinct from actor_child.household_id then
        perform public.append_activity_feed_entry(
            peer_child.household_id,
            peer_child.id,
            'pk_match_submitted',
            summary_text,
            payload
        );
    end if;

    return new;
end;
$$;

drop trigger if exists child_friendships_activity_feed_trigger on public.child_friendships;
create trigger child_friendships_activity_feed_trigger
    after insert on public.child_friendships
    for each row
    execute function public.log_friendship_activity();

drop trigger if exists house_visits_activity_feed_trigger on public.house_visits;
create trigger house_visits_activity_feed_trigger
    after insert on public.house_visits
    for each row
    execute function public.log_house_visit_activity();

drop trigger if exists pk_matches_activity_feed_trigger on public.pk_matches;
create trigger pk_matches_activity_feed_trigger
    after insert or update of status on public.pk_matches
    for each row
    execute function public.log_pk_match_activity();

drop trigger if exists pk_match_attempts_activity_feed_trigger on public.pk_match_attempts;
create trigger pk_match_attempts_activity_feed_trigger
    after insert on public.pk_match_attempts
    for each row
    execute function public.log_pk_attempt_activity();
