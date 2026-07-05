import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

function json(data: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(data), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
    },
    ...init,
  });
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, { status: 405 });
  }

  const body = await request.json().catch(() => ({}));
  const gameType = String(body.gameType || '').trim();
  const payloadJson = body.payloadJson || null;
  const difficulty = String(body.difficulty || '').trim() || null;
  const localProfileId = String(body.localProfileId || '').trim();
  const childId = String(body.childId || '').trim();
  const opponentChildId = String(body.opponentChildId || '').trim();

  if (!['mathpk', 'hanzi'].includes(gameType)) {
    return json({ error: 'Unsupported gameType' }, { status: 400 });
  }

  if (!payloadJson) {
    return json({ error: 'payloadJson is required' }, { status: 400 });
  }

  if (!opponentChildId) {
    return json({ error: 'opponentChildId is required' }, { status: 400 });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const authHeader = request.headers.get('Authorization') || '';

  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    return json({ error: 'Supabase environment variables are missing' }, { status: 500 });
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  const userClient = createClient(supabaseUrl, anonKey, {
    global: {
      headers: {
        Authorization: authHeader,
      },
    },
  });

  const userResult = await userClient.auth.getUser();
  const user = userResult.data.user;
  if (!user) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  let requesterChildId = childId;
  if (!requesterChildId && localProfileId) {
    const memberships = await adminClient
      .from('household_members')
      .select('household_id')
      .eq('account_id', user.id)
      .eq('status', 'active');

    if (memberships.error) {
      return json({ error: memberships.error.message }, { status: 500 });
    }

    const householdIds = (memberships.data || []).map((item) => item.household_id);
    const requesterChild = await adminClient
      .from('child_profiles')
      .select('id')
      .eq('local_profile_id', localProfileId)
      .in('household_id', householdIds)
      .limit(1)
      .maybeSingle();

    if (requesterChild.error) {
      return json({ error: requesterChild.error.message }, { status: 500 });
    }

    requesterChildId = requesterChild.data?.id || '';
  }

  if (!requesterChildId) {
    return json({ error: 'Sync the current child to cloud before creating a PK match' }, { status: 400 });
  }

  if (requesterChildId === opponentChildId) {
    return json({ error: 'You cannot challenge the same child' }, { status: 400 });
  }

  const childProfilesResult = await adminClient
    .from('child_profiles')
    .select('id,household_id,pk_access')
    .in('id', [requesterChildId, opponentChildId]);

  if (childProfilesResult.error) {
    return json({ error: childProfilesResult.error.message }, { status: 500 });
  }

  const profileMap = new Map((childProfilesResult.data || []).map((row) => [row.id, row]));
  const requesterChildProfile = profileMap.get(requesterChildId);
  const opponentChild = profileMap.get(opponentChildId);

  if (!requesterChildProfile) {
    return json({ error: 'The current child profile is unavailable' }, { status: 404 });
  }

  if (!opponentChild) {
    return json({ error: 'The selected opponent child was not found' }, { status: 404 });
  }

  const sameHouseholdPeer = requesterChildProfile.household_id === opponentChild.household_id;
  if (!sameHouseholdPeer) {
    if (opponentChild.pk_access !== 'friends') {
      return json({ error: 'The selected child does not accept PK challenges right now' }, { status: 400 });
    }

    const friendResult = await adminClient
      .from('child_friendships')
      .select('child_id')
      .eq('child_id', requesterChildId)
      .eq('friend_child_id', opponentChildId)
      .eq('status', 'active')
      .maybeSingle();

    if (friendResult.error) {
      return json({ error: friendResult.error.message }, { status: 500 });
    }

    if (!friendResult.data) {
      return json({ error: 'The selected child is not an active friend or household peer' }, { status: 400 });
    }
  }

  const questionSetResult = await adminClient
    .from('pk_question_sets')
    .insert({
      game_type: gameType,
      payload_json: payloadJson,
      difficulty,
      created_by_account_id: user.id,
    })
    .select('id')
    .single();

  if (questionSetResult.error) {
    return json({ error: questionSetResult.error.message }, { status: 500 });
  }

  const expiresAt = new Date(Date.now() + 72 * 3600 * 1000).toISOString();
  const matchResult = await adminClient
    .from('pk_matches')
    .insert({
      game_type: gameType,
      question_set_id: questionSetResult.data.id,
      challenger_child_id: requesterChildId,
      opponent_child_id: opponentChildId,
      status: 'pending',
      difficulty,
      expires_at: expiresAt,
      created_by_account_id: user.id,
    })
    .select('id,question_set_id,expires_at')
    .single();

  if (matchResult.error) {
    return json({ error: matchResult.error.message }, { status: 500 });
  }

  return json({
    ok: true,
    matchId: matchResult.data.id,
    questionSetId: matchResult.data.question_set_id,
    expiresAt: matchResult.data.expires_at,
  });
});
