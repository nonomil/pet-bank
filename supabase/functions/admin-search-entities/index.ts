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
  if (!Number.isFinite(parsed)) return 10;
  return Math.max(1, Math.min(20, Math.round(parsed)));
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, { status: 405 });
  }

  const body = await request.json().catch(() => ({}));
  const query = String(body.query || '').trim();
  const limit = normalizeLimit(body.limit);

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

  if (!query) {
    return json({
      ok: true,
      accounts: [],
      households: [],
      children: [],
    });
  }

  const [accountsResult, householdsResult, childrenResult] = await Promise.all([
    adminClient
      .from('accounts')
      .select('id,email,parent_name,created_at')
      .or(`email.ilike.%${query}%,parent_name.ilike.%${query}%`)
      .order('created_at', { ascending: false })
      .limit(limit),
    adminClient
      .from('households')
      .select('id,name,owner_account_id,created_at')
      .ilike('name', `%${query}%`)
      .order('created_at', { ascending: false })
      .limit(limit),
    adminClient
      .from('child_profiles')
      .select('id,household_id,display_name,local_profile_id,friend_code,created_at')
      .or(`display_name.ilike.%${query}%,local_profile_id.ilike.%${query}%`)
      .order('created_at', { ascending: false })
      .limit(limit),
  ]);

  if (accountsResult.error) {
    return json({ error: accountsResult.error.message }, { status: 500 });
  }
  if (householdsResult.error) {
    return json({ error: householdsResult.error.message }, { status: 500 });
  }
  if (childrenResult.error) {
    return json({ error: childrenResult.error.message }, { status: 500 });
  }

  return json({
    ok: true,
    accounts: accountsResult.data || [],
    households: householdsResult.data || [],
    children: childrenResult.data || [],
  });
});
