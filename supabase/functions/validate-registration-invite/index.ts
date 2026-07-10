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

function isInitialOwnerBootstrapEnabled() {
  const raw = String(Deno.env.get('PETBANK_ENABLE_INITIAL_OWNER_SIGNUP') || 'true').trim().toLowerCase();
  return !(raw === 'false' || raw === '0' || raw === 'off' || raw === 'no');
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, { status: 405 });
  }

  const body = await request.json().catch(() => ({}));
  const inviteCode = normalizeInviteCode(body.inviteCode);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    return json({ error: 'Supabase environment variables are missing' }, { status: 500 });
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  if (!inviteCode) {
    if (!isInitialOwnerBootstrapEnabled()) {
      return json({ error: 'inviteCode is required' }, { status: 400 });
    }

    const accountsCountResult = await adminClient
      .from('accounts')
      .select('id', { count: 'exact', head: true });

    if (accountsCountResult.error) {
      return json({ error: accountsCountResult.error.message }, { status: 500 });
    }

    const accountCount = Number(accountsCountResult.count || 0);
    if (accountCount === 0) {
      return json({
        ok: true,
        bootstrapAllowed: true,
        bootstrapMode: 'initial-owner',
        message: 'Initial owner signup is allowed because no parent accounts exist yet.',
      });
    }

    return json({ error: 'inviteCode is required' }, { status: 400 });
  }

  const inviteResult = await adminClient
    .from('registration_invites')
    .select('id,invite_code,status,label,expires_at,claimed_by_account_id')
    .eq('invite_code', inviteCode)
    .maybeSingle();

  if (inviteResult.error) {
    return json({ error: inviteResult.error.message }, { status: 500 });
  }

  const invite = inviteResult.data;
  if (!invite) {
    return json({ error: 'Registration invite not found' }, { status: 404 });
  }

  if (invite.expires_at && new Date(invite.expires_at).getTime() < Date.now()) {
    return json({ error: 'Registration invite has expired' }, { status: 400 });
  }

  if (invite.status !== 'pending') {
    return json({ error: 'Registration invite is no longer available' }, { status: 400 });
  }

  return json({
    ok: true,
    inviteCode,
    label: invite.label || null,
    expiresAt: invite.expires_at || null,
  });
});
