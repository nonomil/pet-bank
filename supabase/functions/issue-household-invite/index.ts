import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

function json(data: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(data), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
    },
    ...init,
  });
}

function buildInviteCode() {
  return `HOME-${crypto.randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase()}`;
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, { status: 405 });
  }

  const body = await request.json().catch(() => ({}));
  const householdId = String(body.householdId || '').trim();
  if (!householdId) {
    return json({ error: 'householdId is required' }, { status: 400 });
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

  const accountUpsertResult = await adminClient.from('accounts').upsert({
    id: user.id,
    email: user.email || null,
    parent_name: user.user_metadata?.parent_name || null,
  });
  if (accountUpsertResult.error) {
    return json({ error: accountUpsertResult.error.message }, { status: 500 });
  }

  const householdResult = await adminClient
    .from('households')
    .select('id,name,owner_account_id')
    .eq('id', householdId)
    .maybeSingle();

  if (householdResult.error) {
    return json({ error: householdResult.error.message }, { status: 500 });
  }

  const household = householdResult.data;
  if (!household) {
    return json({ error: 'Household not found' }, { status: 404 });
  }

  if (household.owner_account_id !== user.id) {
    return json({ error: 'Only the household owner can issue invites' }, { status: 403 });
  }

  const revokeResult = await adminClient
    .from('household_invites')
    .update({ status: 'revoked' })
    .eq('household_id', householdId)
    .eq('status', 'pending');

  if (revokeResult.error) {
    return json({ error: revokeResult.error.message }, { status: 500 });
  }

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const inviteCode = buildInviteCode();
    const insertResult = await adminClient
      .from('household_invites')
      .insert({
        household_id: householdId,
        invite_code: inviteCode,
        invited_by_account_id: user.id,
        role: 'guardian',
        status: 'pending',
        expires_at: expiresAt,
      })
      .select('id,invite_code,status,role,expires_at,created_at')
      .single();

    if (!insertResult.error) {
      return json({
        ok: true,
        householdId,
        invite: insertResult.data,
      });
    }

    if (!String(insertResult.error.message || '').toLowerCase().includes('duplicate')) {
      return json({ error: insertResult.error.message }, { status: 500 });
    }
  }

  return json({ error: 'Failed to generate a unique household invite code' }, { status: 500 });
});
