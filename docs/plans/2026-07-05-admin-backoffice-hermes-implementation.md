# Admin Backoffice And Hermes Deployment Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a lightweight same-site admin backoffice, safe schema-evolution guardrails, and Hermes-readable deployment descriptors for the Supabase-backed family account system.

**Architecture:** Reuse the existing Supabase Auth account system, add an `admin` role layer in Postgres, route admin reads and writes through dedicated Edge Functions, and keep deployment metadata split into human-readable docs plus machine-readable repo config. All data evolution must remain migration-driven and additive-first.

**Tech Stack:** HTML, CSS, Vanilla JS, Supabase Auth, Postgres SQL migrations, RLS, Edge Functions, Python contract tests, TOML, YAML, markdown docs

---

### Task 1: Add the admin role schema contract

**Files:**
- Create: `prj/test_admin_role_schema_contract.py`
- Create: `supabase/migrations/20260705_012_admin_roles.sql`
- Modify: `docs/家庭账号社交体系/02-数据模型与权限.md`

**Step 1: Write the failing test**

```python
from pathlib import Path


def test_admin_role_migration_contains_role_and_audit_tables():
    sql = Path("supabase/migrations/20260705_012_admin_roles.sql").read_text(encoding="utf-8")
    lowered = sql.lower()
    assert "create table if not exists public.user_roles" in lowered
    assert "create table if not exists public.admin_audit_logs" in lowered
    assert "create or replace function public.is_admin" in lowered
```

**Step 2: Run test to verify it fails**

Run: `python -m pytest prj/test_admin_role_schema_contract.py -q`

Expected: FAIL because the admin role migration does not exist yet.

**Step 3: Write minimal implementation**

```sql
create table if not exists public.user_roles (
    account_id uuid not null references public.accounts(id) on delete cascade,
    role text not null check (role in ('admin')),
    granted_by_account_id uuid references public.accounts(id) on delete set null,
    granted_at timestamptz not null default now(),
    primary key (account_id, role)
);

create table if not exists public.admin_audit_logs (
    id uuid primary key default gen_random_uuid(),
    actor_account_id uuid not null references public.accounts(id) on delete restrict,
    action_type text not null,
    target_type text not null,
    target_id text,
    payload_json jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
);

create or replace function public.is_admin(target_account_id uuid default auth.uid())
returns boolean
language sql
stable
as $$
    select exists (
        select 1
        from public.user_roles ur
        where ur.account_id = target_account_id
          and ur.role = 'admin'
    );
$$;
```

**Step 4: Run test to verify it passes**

Run: `python -m pytest prj/test_admin_role_schema_contract.py -q`

Expected: PASS

**Step 5: Commit**

```bash
git add prj/test_admin_role_schema_contract.py supabase/migrations/20260705_012_admin_roles.sql docs/家庭账号社交体系/02-数据模型与权限.md
git commit -m "feat: add admin role schema contract"
```

### Task 2: Add the admin shell entry and gate

**Files:**
- Create: `admin.html`
- Create: `js/admin-auth.js`
- Create: `prj/test_admin_backoffice_shell_contract.py`
- Modify: `css/style.css`

**Step 1: Write the failing test**

```python
from pathlib import Path


def test_admin_html_loads_admin_auth_shell():
    html = Path("admin.html").read_text(encoding="utf-8")
    assert 'id="admin-root"' in html
    assert "js/admin-auth.js" in html
```

**Step 2: Run test to verify it fails**

Run: `python -m pytest prj/test_admin_backoffice_shell_contract.py -q`

Expected: FAIL because `admin.html` does not exist yet.

**Step 3: Write minimal implementation**

```html
<main id="admin-root"></main>
<script src="js/cloud-client.js"></script>
<script src="js/auth.js"></script>
<script src="js/admin-auth.js"></script>
```

```js
window.AdminAuth = {
  boot() {
    return Promise.resolve();
  }
};
```

**Step 4: Run test to verify it passes**

Run: `python -m pytest prj/test_admin_backoffice_shell_contract.py -q`

Expected: PASS

**Step 5: Commit**

```bash
git add admin.html js/admin-auth.js prj/test_admin_backoffice_shell_contract.py css/style.css
git commit -m "feat: add admin shell entry"
```

### Task 3: Add admin inspection functions for accounts, households, and children

**Files:**
- Create: `supabase/functions/admin-search-entities/index.ts`
- Create: `supabase/functions/admin-list-invites/index.ts`
- Create: `js/admin-console.js`
- Create: `prj/test_admin_ops_contract.py`

**Step 1: Write the failing test**

```python
from pathlib import Path


def test_admin_search_function_requires_admin_check():
    fn = Path("supabase/functions/admin-search-entities/index.ts").read_text(encoding="utf-8")
    assert "is_admin" in fn
    assert "service_role" in fn.lower() or "serviceRoleKey" in fn
```

**Step 2: Run test to verify it fails**

Run: `python -m pytest prj/test_admin_ops_contract.py -q`

Expected: FAIL because the admin functions do not exist yet.

**Step 3: Write minimal implementation**

```ts
const isAdminResult = await adminClient.rpc("is_admin", { target_account_id: user.id });
if (!isAdminResult.data) {
  return json({ error: "forbidden" }, { status: 403 });
}
```

**Step 4: Run test to verify it passes**

Run: `python -m pytest prj/test_admin_ops_contract.py -q`

Expected: PASS

**Step 5: Commit**

```bash
git add supabase/functions/admin-search-entities/index.ts supabase/functions/admin-list-invites/index.ts js/admin-console.js prj/test_admin_ops_contract.py
git commit -m "feat: add admin inspection functions"
```

### Task 4: Add admin audit logging for privileged actions

**Files:**
- Modify: `supabase/functions/admin-list-invites/index.ts`
- Modify: `supabase/functions/revoke-registration-invite/index.ts`
- Modify: `supabase/functions/revoke-household-invite/index.ts`
- Create: `prj/test_admin_audit_contract.py`

**Step 1: Write the failing test**

```python
from pathlib import Path


def test_admin_actions_write_audit_logs():
    js = Path("supabase/functions/admin-list-invites/index.ts").read_text(encoding="utf-8")
    assert "admin_audit_logs" in js
```

**Step 2: Run test to verify it fails**

Run: `python -m pytest prj/test_admin_audit_contract.py -q`

Expected: FAIL because audit logging is not wired yet.

**Step 3: Write minimal implementation**

```ts
await adminClient.from("admin_audit_logs").insert({
  actor_account_id: user.id,
  action_type: "admin.list_invites",
  target_type: "registration_invites",
  payload_json: { query }
});
```

**Step 4: Run test to verify it passes**

Run: `python -m pytest prj/test_admin_audit_contract.py -q`

Expected: PASS

**Step 5: Commit**

```bash
git add supabase/functions/admin-list-invites/index.ts supabase/functions/revoke-registration-invite/index.ts supabase/functions/revoke-household-invite/index.ts prj/test_admin_audit_contract.py
git commit -m "feat: add admin audit logs"
```

### Task 5: Add the safe deployment descriptors for Hermes

**Files:**
- Create: `supabase/config.toml`
- Create: `.env.production.example`
- Create: `ops/hermes.yaml`
- Create: `prj/test_hermes_deploy_contract.py`
- Modify: `docs/README.md`
- Modify: `docs/plans/README.md`

**Step 1: Write the failing test**

```python
from pathlib import Path
import tomllib


def test_repo_contains_machine_readable_deploy_descriptors():
    config = Path("supabase/config.toml").read_bytes()
    data = tomllib.loads(config.decode("utf-8"))
    assert "project_id" in data
    assert Path("ops/hermes.yaml").exists()
    assert Path(".env.production.example").exists()
```

**Step 2: Run test to verify it fails**

Run: `python -m pytest prj/test_hermes_deploy_contract.py -q`

Expected: FAIL because the files do not exist yet.

**Step 3: Write minimal implementation**

```toml
project_id = "pet-bank-local"

[remotes.production]
project_id = "your-production-project-ref"
```

```yaml
version: 1
project:
  name: pet-bank
```

**Step 4: Run test to verify it passes**

Run: `python -m pytest prj/test_hermes_deploy_contract.py -q`

Expected: PASS

**Step 5: Commit**

```bash
git add supabase/config.toml .env.production.example ops/hermes.yaml prj/test_hermes_deploy_contract.py docs/README.md docs/plans/README.md
git commit -m "chore: add hermes deploy descriptors"
```

### Task 6: Verify the admin design package and rollout rules

**Files:**
- Modify: `docs/plans/2026-07-05-admin-backoffice-hermes-design.md`
- Modify: `docs/plans/2026-07-05-admin-backoffice-hermes-implementation.md`
- Test: `prj/test_admin_role_schema_contract.py`
- Test: `prj/test_admin_backoffice_shell_contract.py`
- Test: `prj/test_admin_ops_contract.py`
- Test: `prj/test_admin_audit_contract.py`
- Test: `prj/test_hermes_deploy_contract.py`

**Step 1: Run the targeted contract tests**

Run: `python -m pytest prj/test_admin_role_schema_contract.py prj/test_admin_backoffice_shell_contract.py prj/test_admin_ops_contract.py prj/test_admin_audit_contract.py prj/test_hermes_deploy_contract.py -q`

Expected: PASS

**Step 2: Run syntax checks**

Run: `node --check js/admin-auth.js && node --check js/admin-console.js`

Expected: PASS

**Step 3: Run the full Python regression suite**

Run: `python -m pytest (Get-ChildItem 'prj' -Filter 'test_*.py' | Sort-Object Name | ForEach-Object { $_.FullName }) -q`

Expected: PASS

**Step 4: Commit**

```bash
git add docs/plans/2026-07-05-admin-backoffice-hermes-design.md docs/plans/2026-07-05-admin-backoffice-hermes-implementation.md
git commit -m "docs: finalize admin backoffice rollout package"
```

---

Plan complete and saved to `docs/plans/2026-07-05-admin-backoffice-hermes-implementation.md`.

Two execution options:

1. Subagent-Driven (this session) - I dispatch fresh subagent per task, review between tasks, fast iteration
2. Parallel Session (separate) - Open new session with executing-plans, batch execution with checkpoints
