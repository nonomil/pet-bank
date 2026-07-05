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
  const inviteId = String(body.inviteId || '').trim();
  if (!inviteId) {
    return json({ error: 'inviteId is required' }, { status: 400 });
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

  const inviteResult = await adminClient
    .from('registration_invites')
    .select('id,invite_code,status,created_by_account_id')
    .eq('id', inviteId)
    .maybeSingle();

  if (inviteResult.error) {
    return json({ error: inviteResult.error.message }, { status: 500 });
  }

  const invite = inviteResult.data;
  if (!invite) {
    return json({ error: 'Registration invite not found' }, { status: 404 });
  }

  if (invite.created_by_account_id !== user.id) {
    return json({ error: 'Only the invite creator can revoke it' }, { status: 403 });
  }

  if (invite.status !== 'pending') {
    return json({ error: 'Only pending invites can be revoked' }, { status: 400 });
  }

  const updateResult = await adminClient
    .from('registration_invites')
    .update({ status: 'revoked' })
    .eq('id', inviteId);

  if (updateResult.error) {
    return json({ error: updateResult.error.message }, { status: 500 });
  }

  return json({
    ok: true,
    inviteId,
    inviteCode: invite.invite_code,
    status: 'revoked',
  });
});
