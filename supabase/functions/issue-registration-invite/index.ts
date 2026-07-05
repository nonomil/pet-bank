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
  return `PARENT-${crypto.randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase()}`;
}

function normalizeExpiresDays(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 30;
  return Math.max(1, Math.min(90, Math.round(parsed)));
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, { status: 405 });
  }

  const body = await request.json().catch(() => ({}));
  const label = String(body.label || '').trim();
  const householdId = String(body.householdId || '').trim();
  const expiresDays = normalizeExpiresDays(body.expiresDays);

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

  const expiresAt = new Date(Date.now() + expiresDays * 24 * 60 * 60 * 1000).toISOString();
  const metadataJson = {
    source: 'manual_issue',
    householdId: householdId || null,
  };

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const inviteCode = buildInviteCode();
    const insertResult = await adminClient
      .from('registration_invites')
      .insert({
        invite_code: inviteCode,
        status: 'pending',
        label: label || null,
        expires_at: expiresAt,
        created_by_account_id: user.id,
        metadata_json: metadataJson,
      })
      .select('id,invite_code,status,label,expires_at,created_at,metadata_json')
      .single();

    if (!insertResult.error) {
      return json({
        ok: true,
        invite: insertResult.data,
      });
    }

    if (!String(insertResult.error.message || '').toLowerCase().includes('duplicate')) {
      return json({ error: insertResult.error.message }, { status: 500 });
    }
  }

  return json({ error: 'Failed to generate a unique registration invite code' }, { status: 500 });
});
