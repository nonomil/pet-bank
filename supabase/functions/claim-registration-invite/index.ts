import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

function json(data: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(data), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
    },
    ...init,
  });
}

function normalizeInviteCode(value: unknown) {
  return String(value || '').trim().toUpperCase();
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, { status: 405 });
  }

  const body = await request.json().catch(() => ({}));

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

  const inviteCode = normalizeInviteCode(
    body.inviteCode || user.user_metadata?.registration_invite_code,
  );
  if (!inviteCode) {
    return json({ ok: true, skipped: true, reason: 'missing_registration_invite_code' });
  }

  const accountUpsertResult = await adminClient.from('accounts').upsert({
    id: user.id,
    email: user.email || null,
    parent_name: user.user_metadata?.parent_name || null,
  });
  if (accountUpsertResult.error) {
    return json({ error: accountUpsertResult.error.message }, { status: 500 });
  }

  const inviteResult = await adminClient
    .from('registration_invites')
    .select('id,invite_code,status,expires_at,claimed_by_account_id')
    .eq('invite_code', inviteCode)
    .maybeSingle();

  if (inviteResult.error) {
    return json({ error: inviteResult.error.message }, { status: 500 });
  }

  const invite = inviteResult.data;
  if (!invite) {
    return json({ error: 'Registration invite not found' }, { status: 404 });
  }

  if (invite.claimed_by_account_id === user.id && invite.status === 'claimed') {
    return json({ ok: true, inviteCode, alreadyClaimed: true });
  }

  if (invite.expires_at && new Date(invite.expires_at).getTime() < Date.now()) {
    return json({ error: 'Registration invite has expired' }, { status: 400 });
  }

  if (invite.status !== 'pending') {
    return json({ error: 'Registration invite is no longer available' }, { status: 400 });
  }

  const updateInviteResult = await adminClient
    .from('registration_invites')
    .update({
      status: 'claimed',
      claimed_by_account_id: user.id,
      claimed_at: new Date().toISOString(),
    })
    .eq('id', invite.id);

  if (updateInviteResult.error) {
    return json({ error: updateInviteResult.error.message }, { status: 500 });
  }

  return json({
    ok: true,
    inviteCode,
    accountId: user.id,
  });
});
