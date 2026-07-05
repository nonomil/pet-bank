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
  const matchId = String(body.matchId || '').trim();
  const localProfileId = String(body.localProfileId || '').trim();
  const childId = String(body.childId || '').trim();
  const summary = body.summary || {};

  if (!matchId) {
    return json({ error: 'matchId is required' }, { status: 400 });
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
    return json({ error: 'Sync the current child to cloud before submitting a PK attempt' }, { status: 400 });
  }

  const matchResult = await adminClient
    .from('pk_matches')
    .select('id,status,challenger_child_id,opponent_child_id,expires_at')
    .eq('id', matchId)
    .maybeSingle();

  if (matchResult.error) {
    return json({ error: matchResult.error.message }, { status: 500 });
  }

  const match = matchResult.data;
  if (!match) {
    return json({ error: 'PK match not found' }, { status: 404 });
  }

  if (match.challenger_child_id !== requesterChildId && match.opponent_child_id !== requesterChildId) {
    return json({ error: 'The current child is not part of this PK match' }, { status: 403 });
  }

  if (match.expires_at && new Date(match.expires_at).getTime() < Date.now()) {
    await adminClient.from('pk_matches').update({ status: 'expired' }).eq('id', matchId);
    return json({ error: 'This PK match has expired' }, { status: 400 });
  }

  const existingAttempt = await adminClient
    .from('pk_match_attempts')
    .select('id')
    .eq('match_id', matchId)
    .eq('child_id', requesterChildId)
    .maybeSingle();

  if (existingAttempt.error) {
    return json({ error: existingAttempt.error.message }, { status: 500 });
  }

  if (existingAttempt.data) {
    return json({ error: 'This child has already submitted a result for the match' }, { status: 409 });
  }

  const insertResult = await adminClient
    .from('pk_match_attempts')
    .insert({
      match_id: matchId,
      child_id: requesterChildId,
      score: Number(summary.score) || 0,
      correct_count: summary.correctCount != null ? Number(summary.correctCount) : null,
      duration_ms: summary.durationMs != null ? Number(summary.durationMs) : null,
      payload_json: summary.payloadJson || {},
    });

  if (insertResult.error) {
    return json({ error: insertResult.error.message }, { status: 500 });
  }

  const attemptsResult = await adminClient
    .from('pk_match_attempts')
    .select('match_id,child_id,score,correct_count,duration_ms,payload_json,completed_at')
    .eq('match_id', matchId)
    .order('completed_at', { ascending: true });

  if (attemptsResult.error) {
    return json({ error: attemptsResult.error.message }, { status: 500 });
  }

  const attempts = attemptsResult.data || [];
  const nextStatus = attempts.length >= 2 ? 'completed' : 'active';
  const updateMatchResult = await adminClient
    .from('pk_matches')
    .update({ status: nextStatus })
    .eq('id', matchId);

  if (updateMatchResult.error) {
    return json({ error: updateMatchResult.error.message }, { status: 500 });
  }

  return json({
    ok: true,
    matchId,
    matchStatus: nextStatus,
    attempts,
  });
});
