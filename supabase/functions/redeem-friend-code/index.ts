import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

function json(data: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(data), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
    },
    ...init,
  });
}

function dedupeIds(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, { status: 405 });
  }

  const body = await request.json().catch(() => ({}));
  const friendCode = String(body.friendCode || '').trim().toUpperCase();
  const localProfileId = String(body.localProfileId || '').trim();
  const childId = String(body.childId || '').trim();

  if (!friendCode) {
    return json({ error: 'friendCode is required' }, { status: 400 });
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

  const membershipResult = await adminClient
    .from('household_members')
    .select('household_id')
    .eq('account_id', user.id)
    .eq('status', 'active');

  if (membershipResult.error) {
    return json({ error: membershipResult.error.message }, { status: 500 });
  }

  const householdIds = dedupeIds((membershipResult.data || []).map((item) => item.household_id));
  if (!householdIds.length) {
    return json({ error: 'Join or create a household first' }, { status: 400 });
  }

  let requesterChildId = childId;
  if (!requesterChildId && localProfileId) {
    const requesterResult = await adminClient
      .from('child_profiles')
      .select('id')
      .eq('local_profile_id', localProfileId)
      .in('household_id', householdIds)
      .limit(1)
      .maybeSingle();

    if (requesterResult.error) {
      return json({ error: requesterResult.error.message }, { status: 500 });
    }

    requesterChildId = requesterResult.data?.id || '';
  }

  if (!requesterChildId) {
    return json({ error: 'Sync the current child to cloud before redeeming a friend code' }, { status: 400 });
  }

  const requesterChildResult = await adminClient
    .from('child_profiles')
    .select('id,display_name,emoji,friend_code,household_id')
    .eq('id', requesterChildId)
    .maybeSingle();

  if (requesterChildResult.error) {
    return json({ error: requesterChildResult.error.message }, { status: 500 });
  }

  const requesterChild = requesterChildResult.data;
  if (!requesterChild || !householdIds.includes(requesterChild.household_id)) {
    return json({ error: 'Current child profile is unavailable' }, { status: 404 });
  }

  const targetChildResult = await adminClient
    .from('child_profiles')
    .select('id,display_name,emoji,friend_code,household_id')
    .eq('friend_code', friendCode)
    .maybeSingle();

  if (targetChildResult.error) {
    return json({ error: targetChildResult.error.message }, { status: 500 });
  }

  const targetChild = targetChildResult.data;
  if (!targetChild) {
    return json({ error: 'Friend code not found' }, { status: 404 });
  }

  if (targetChild.id === requesterChild.id) {
    return json({ error: 'You cannot add the same child as a friend' }, { status: 400 });
  }

  const friendshipRows = [
    {
      child_id: requesterChild.id,
      friend_child_id: targetChild.id,
      status: 'active',
      source: 'friend_code',
      initiated_by_account_id: user.id,
    },
    {
      child_id: targetChild.id,
      friend_child_id: requesterChild.id,
      status: 'active',
      source: 'friend_code',
      initiated_by_account_id: user.id,
    },
  ];

  const insertResult = await adminClient
    .from('child_friendships')
    .upsert(friendshipRows, {
      onConflict: 'child_id,friend_child_id',
    });

  if (insertResult.error) {
    return json({ error: insertResult.error.message }, { status: 500 });
  }

  return json({
    ok: true,
    requesterChild,
    targetChild,
  });
});
