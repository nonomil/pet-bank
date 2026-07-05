# Family Account Social System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add cloud-backed family accounts, multi-child household data, cross-family visits, and async math/hanzi PK on top of the current static pet-bank frontend.

**Architecture:** Keep the existing static HTML + Vanilla JS frontend, add a Supabase-backed identity and data layer, and treat the current `ProfileManager` local profile system as an import bridge and offline fallback rather than the long-term source of truth. Build the system in vertical slices: auth/household first, friend graph second, visits third, async PK last.

**Tech Stack:** HTML, CSS, Vanilla JS, Supabase Auth, Postgres, RLS, Supabase Edge Functions, Python smoke tests, markdown docs

---

### Task 1: Add the cloud contract and client bootstrap

**Files:**
- Create: `js/cloud-client.js`
- Modify: `.env.example`
- Modify: `index.html`
- Create: `supabase/migrations/20260705_001_base_extensions.sql`
- Test: `prj/cloud_contract_smoke.test.py`

**Step 1: Write the failing test**

```python
from pathlib import Path

def test_cloud_bootstrap_script_is_loaded():
    html = Path("index.html").read_text(encoding="utf-8")
    assert "js/cloud-client.js" in html
```

**Step 2: Run test to verify it fails**

Run: `python -m pytest prj/cloud_contract_smoke.test.py -q`

Expected: FAIL because the frontend does not yet load a cloud client bootstrap.

**Step 3: Write minimal implementation**

```js
window.CloudClient = {
  isEnabled() {
    return Boolean(window.APP_SUPABASE_URL && window.APP_SUPABASE_ANON_KEY);
  }
};
```

```html
<script src="js/cloud-client.js"></script>
```

**Step 4: Run test to verify it passes**

Run: `python -m pytest prj/cloud_contract_smoke.test.py -q`

Expected: PASS

**Step 5: Commit**

```bash
git add .env.example index.html js/cloud-client.js supabase/migrations/20260705_001_base_extensions.sql prj/cloud_contract_smoke.test.py
git commit -m "chore: add cloud client bootstrap contract"
```

### Task 2: Add auth shell and session gating

**Files:**
- Create: `js/auth.js`
- Modify: `index.html`
- Modify: `css/style.css`
- Modify: `js/app.js`
- Test: `prj/auth_shell_smoke.test.py`

**Step 1: Write the failing test**

```python
from pathlib import Path

def test_index_contains_auth_mount():
    html = Path("index.html").read_text(encoding="utf-8")
    assert 'id="auth-root"' in html
```

**Step 2: Run test to verify it fails**

Run: `python -m pytest prj/auth_shell_smoke.test.py -q`

Expected: FAIL because there is no auth container yet.

**Step 3: Write minimal implementation**

```html
<div id="auth-root"></div>
```

```js
window.AuthSystem = {
  boot() {
    return Promise.resolve();
  }
};
```

**Step 4: Run test to verify it passes**

Run: `python -m pytest prj/auth_shell_smoke.test.py -q`

Expected: PASS

**Step 5: Commit**

```bash
git add index.html css/style.css js/app.js js/auth.js prj/auth_shell_smoke.test.py
git commit -m "feat: add auth shell and session gate"
```

### Task 3: Add household core tables and family invite flow

**Files:**
- Create: `supabase/migrations/20260705_002_households.sql`
- Create: `supabase/functions/accept-household-invite/index.ts`
- Create: `js/household.js`
- Modify: `index.html`
- Modify: `js/auth.js`
- Test: `prj/household_contract.test.py`

**Step 1: Write the failing test**

```python
from pathlib import Path

def test_household_migration_contains_membership_table():
    sql = Path("supabase/migrations/20260705_002_households.sql").read_text(encoding="utf-8")
    assert "create table if not exists household_members" in sql.lower()
```

**Step 2: Run test to verify it fails**

Run: `python -m pytest prj/household_contract.test.py -q`

Expected: FAIL because the household schema file does not exist yet.

**Step 3: Write minimal implementation**

```sql
create table if not exists households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_account_id uuid not null,
  created_at timestamptz not null default now()
);

create table if not exists household_members (
  household_id uuid not null references households(id) on delete cascade,
  account_id uuid not null,
  role text not null check (role in ('owner', 'guardian')),
  status text not null default 'active',
  primary key (household_id, account_id)
);
```

**Step 4: Run test to verify it passes**

Run: `python -m pytest prj/household_contract.test.py -q`

Expected: PASS

**Step 5: Commit**

```bash
git add supabase/migrations/20260705_002_households.sql supabase/functions/accept-household-invite/index.ts js/household.js index.html js/auth.js prj/household_contract.test.py
git commit -m "feat: add household core schema and invite flow"
```

### Task 4: Sync children and existing local profiles into cloud child records

**Files:**
- Create: `supabase/migrations/20260705_003_children_and_pet_state.sql`
- Create: `js/profile-sync.js`
- Modify: `js/profiles.js`
- Modify: `js/pet.js`
- Modify: `js/home.js`
- Modify: `js/app.js`
- Test: `prj/profile_import_contract.test.py`

**Step 1: Write the failing test**

```python
from pathlib import Path

def test_profile_sync_reads_profilemanager_snapshot_keys():
    js = Path("js/profile-sync.js").read_text(encoding="utf-8")
    assert "petbank_profile_data_" in js
```

**Step 2: Run test to verify it fails**

Run: `python -m pytest prj/profile_import_contract.test.py -q`

Expected: FAIL because the import bridge is not implemented.

**Step 3: Write minimal implementation**

```js
window.ProfileSync = {
  snapshotPrefix: 'petbank_profile_data_',
  exportLocalProfiles() {
    return (window.ProfileManager ? window.ProfileManager.list() : []).map(p => ({ id: p.id, name: p.name }));
  }
};
```

**Step 4: Run test to verify it passes**

Run: `python -m pytest prj/profile_import_contract.test.py -q`

Expected: PASS

**Step 5: Commit**

```bash
git add supabase/migrations/20260705_003_children_and_pet_state.sql js/profile-sync.js js/profiles.js js/pet.js js/home.js js/app.js prj/profile_import_contract.test.py
git commit -m "feat: add child sync and local profile import bridge"
```

### Task 5: Add child friend code redemption and friendship graph

**Files:**
- Create: `supabase/migrations/20260705_004_friend_graph.sql`
- Create: `supabase/functions/redeem-friend-code/index.ts`
- Create: `js/social.js`
- Modify: `index.html`
- Modify: `js/home.js`
- Test: `prj/friend_graph_contract.test.py`

**Step 1: Write the failing test**

```python
from pathlib import Path

def test_friend_graph_migration_contains_child_friendships():
    sql = Path("supabase/migrations/20260705_004_friend_graph.sql").read_text(encoding="utf-8")
    assert "child_friendships" in sql
```

**Step 2: Run test to verify it fails**

Run: `python -m pytest prj/friend_graph_contract.test.py -q`

Expected: FAIL because the friend graph schema does not exist yet.

**Step 3: Write minimal implementation**

```sql
create table if not exists child_friendships (
  child_id uuid not null,
  friend_child_id uuid not null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  primary key (child_id, friend_child_id)
);
```

**Step 4: Run test to verify it passes**

Run: `python -m pytest prj/friend_graph_contract.test.py -q`

Expected: PASS

**Step 5: Commit**

```bash
git add supabase/migrations/20260705_004_friend_graph.sql supabase/functions/redeem-friend-code/index.ts js/social.js index.html js/home.js prj/friend_graph_contract.test.py
git commit -m "feat: add child friendship graph and friend code flow"
```

### Task 6: Add async house visits and lightweight social interactions

**Files:**
- Create: `supabase/migrations/20260705_005_house_visits.sql`
- Modify: `js/home.js`
- Modify: `js/social.js`
- Modify: `css/style.css`
- Test: `prj/house_visit_contract.test.py`

**Step 1: Write the failing test**

```python
from pathlib import Path

def test_house_visit_schema_contains_action_type():
    sql = Path("supabase/migrations/20260705_005_house_visits.sql").read_text(encoding="utf-8")
    assert "action_type" in sql
```

**Step 2: Run test to verify it fails**

Run: `python -m pytest prj/house_visit_contract.test.py -q`

Expected: FAIL because visit persistence is missing.

**Step 3: Write minimal implementation**

```sql
create table if not exists house_visits (
  id uuid primary key default gen_random_uuid(),
  from_child_id uuid not null,
  to_child_id uuid not null,
  action_type text not null,
  message text,
  created_at timestamptz not null default now()
);
```

**Step 4: Run test to verify it passes**

Run: `python -m pytest prj/house_visit_contract.test.py -q`

Expected: PASS

**Step 5: Commit**

```bash
git add supabase/migrations/20260705_005_house_visits.sql js/home.js js/social.js css/style.css prj/house_visit_contract.test.py
git commit -m "feat: add async house visit persistence"
```

### Task 7: Add shared question sets for async math and hanzi PK

**Files:**
- Create: `supabase/migrations/20260705_006_async_pk.sql`
- Create: `supabase/functions/issue-pk-match/index.ts`
- Create: `js/pk-service.js`
- Modify: `js/math-pk.js`
- Modify: `js/hanzi-game.js`
- Modify: `js/leaderboard.js`
- Test: `prj/async_pk_contract.test.py`

**Step 1: Write the failing test**

```python
from pathlib import Path

def test_async_pk_schema_contains_question_sets():
    sql = Path("supabase/migrations/20260705_006_async_pk.sql").read_text(encoding="utf-8")
    assert "pk_question_sets" in sql
```

**Step 2: Run test to verify it fails**

Run: `python -m pytest prj/async_pk_contract.test.py -q`

Expected: FAIL because async PK tables and service code do not exist.

**Step 3: Write minimal implementation**

```sql
create table if not exists pk_question_sets (
  id uuid primary key default gen_random_uuid(),
  game_type text not null,
  payload_json jsonb not null,
  difficulty text,
  created_at timestamptz not null default now()
);

create table if not exists pk_matches (
  id uuid primary key default gen_random_uuid(),
  game_type text not null,
  question_set_id uuid not null references pk_question_sets(id),
  challenger_child_id uuid not null,
  opponent_child_id uuid not null,
  status text not null default 'pending',
  expires_at timestamptz
);
```

**Step 4: Run test to verify it passes**

Run: `python -m pytest prj/async_pk_contract.test.py -q`

Expected: PASS

**Step 5: Commit**

```bash
git add supabase/migrations/20260705_006_async_pk.sql supabase/functions/issue-pk-match/index.ts js/pk-service.js js/math-pk.js js/hanzi-game.js js/leaderboard.js prj/async_pk_contract.test.py
git commit -m "feat: add async math and hanzi pk foundation"
```

### Task 8: Verify, document, and prepare rollout

**Files:**
- Modify: `docs/家庭账号社交体系/01-方案总览.md`
- Modify: `docs/家庭账号社交体系/02-数据模型与权限.md`
- Modify: `docs/家庭账号社交体系/03-分阶段落地计划.md`
- Modify: `docs/plans/2026-07-05-family-account-social-task-list.md`
- Test: `prj/cloud_contract_smoke.test.py`
- Test: `prj/auth_shell_smoke.test.py`
- Test: `prj/household_contract.test.py`
- Test: `prj/profile_import_contract.test.py`
- Test: `prj/friend_graph_contract.test.py`
- Test: `prj/house_visit_contract.test.py`
- Test: `prj/async_pk_contract.test.py`

**Step 1: Run the targeted contract tests**

Run: `python -m pytest prj/cloud_contract_smoke.test.py prj/auth_shell_smoke.test.py prj/household_contract.test.py prj/profile_import_contract.test.py prj/friend_graph_contract.test.py prj/house_visit_contract.test.py prj/async_pk_contract.test.py -q`

Expected: PASS

**Step 2: Run a path and script audit**

Run: `rg -n "cloud-client|auth-root|household_members|petbank_profile_data_|child_friendships|house_visits|pk_question_sets" index.html js supabase docs`

Expected: the new architecture hooks and schema names are present in code and docs.

**Step 3: Update docs if implementation deviated**

```md
- adjust scope wording
- update chosen auth method
- record any deferred features explicitly
```

**Step 4: Commit**

```bash
git add docs/家庭账号社交体系 docs/plans/2026-07-05-family-account-social-task-list.md
git commit -m "docs: finalize family account social rollout plan"
```

---

Plan complete and saved to `docs/plans/2026-07-05-family-account-social-implementation.md`.

Two execution options:

1. Subagent-Driven (this session) - I dispatch fresh subagent per task, review between tasks, fast iteration
2. Parallel Session (separate) - Open new session with executing-plans, batch execution with checkpoints

