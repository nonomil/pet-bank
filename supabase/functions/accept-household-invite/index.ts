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
  const inviteCode = String(body.inviteCode || '').trim().toUpperCase();
  if (!inviteCode) {
    return json({ error: 'inviteCode is required' }, { status: 400 });
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

  await adminClient.from('accounts').upsert({
    id: user.id,
    email: user.email || null,
    parent_name: user.user_metadata?.parent_name || null,
  });

  const inviteResult = await adminClient
    .from('household_invites')
    .select('*')
    .eq('invite_code', inviteCode)
    .maybeSingle();

  if (inviteResult.error) {
    return json({ error: inviteResult.error.message }, { status: 500 });
  }

  const invite = inviteResult.data;
  if (!invite) {
    return json({ error: 'Invite code not found' }, { status: 404 });
  }

  if (invite.status !== 'pending') {
    return json({ error: 'Invite is no longer available' }, { status: 400 });
  }

  if (invite.expires_at && new Date(invite.expires_at).getTime() < Date.now()) {
    return json({ error: 'Invite has expired' }, { status: 400 });
  }

  const memberResult = await adminClient.from('household_members').upsert({
    household_id: invite.household_id,
    account_id: user.id,
    role: invite.role || 'guardian',
    status: 'active',
  });

  if (memberResult.error) {
    return json({ error: memberResult.error.message }, { status: 500 });
  }

  const updateInviteResult = await adminClient
    .from('household_invites')
    .update({
      status: 'accepted',
      claimed_by_account_id: user.id,
      claimed_at: new Date().toISOString(),
    })
    .eq('id', invite.id);

  if (updateInviteResult.error) {
    return json({ error: updateInviteResult.error.message }, { status: 500 });
  }

  return json({
    ok: true,
    householdId: invite.household_id,
    accountId: user.id,
    inviteCode,
  });
});
