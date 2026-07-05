import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

function json(data: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(data), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
    },
    ...init,
  });
}

function normalizeLimit(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 20;
  return Math.max(1, Math.min(50, Math.round(parsed)));
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, { status: 405 });
  }

  const body = await request.json().catch(() => ({}));
  const limit = normalizeLimit(body.limit);
  const status = String(body.status || '').trim();

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

  const isAdminResult = await adminClient.rpc('is_admin', { target_account_id: user.id });
  if (isAdminResult.error) {
    return json({ error: isAdminResult.error.message }, { status: 500 });
  }
  if (!isAdminResult.data) {
    return json({ error: 'Forbidden' }, { status: 403 });
  }

  let registrationQuery = adminClient
    .from('registration_invites')
    .select('id,invite_code,status,label,expires_at,claimed_at,created_at,created_by_account_id')
    .order('created_at', { ascending: false })
    .limit(limit);

  let householdQuery = adminClient
    .from('household_invites')
    .select('id,household_id,invite_code,status,role,expires_at,claimed_at,created_at,invited_by_account_id')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (status) {
    registrationQuery = registrationQuery.eq('status', status);
    householdQuery = householdQuery.eq('status', status);
  }

  const [registrationResult, householdResult] = await Promise.all([
    registrationQuery,
    householdQuery,
  ]);

  if (registrationResult.error) {
    return json({ error: registrationResult.error.message }, { status: 500 });
  }
  if (householdResult.error) {
    return json({ error: householdResult.error.message }, { status: 500 });
  }

  return json({
    ok: true,
    registrationInvites: registrationResult.data || [],
    householdInvites: householdResult.data || [],
  });
});
