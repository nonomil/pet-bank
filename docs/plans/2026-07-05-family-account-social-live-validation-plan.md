# Family Account Social Live Validation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Prove the family-account social system works in a real Supabase project with dual-parent, multi-child, cross-household, and async PK flows before wider rollout.

**Architecture:** Treat the current codebase as the implementation baseline and focus this plan on deployment, seeded test data, manual multi-device validation, and rollout gating. Keep changes small and evidence-driven: deploy first, validate second, only patch code after a reproduced failure.

**Tech Stack:** Supabase CLI, Supabase Auth, Postgres migrations, Supabase Edge Functions, Vanilla JS frontend, Python contract tests, markdown rollout docs

---

### Task 1: Freeze the current evidence baseline

**Files:**
- Modify: `docs/家庭账号社交体系/联调上线/README.md`
- Modify: `docs/plans/2026-07-05-family-account-social-task-list.md`
- Test: `prj/test_cloud_contract_smoke.py`
- Test: `prj/test_auth_shell_smoke.py`
- Test: `prj/test_household_contract.py`
- Test: `prj/test_registration_invite_contract.py`
- Test: `prj/test_household_peer_social_contract.py`
- Test: `prj/test_activity_feed_contract.py`

**Step 1: Run the family-social regression baseline**

```bash
python -m pytest prj/test_cloud_contract_smoke.py prj/test_auth_shell_smoke.py prj/test_household_contract.py prj/test_registration_invite_contract.py prj/test_household_peer_social_contract.py prj/test_activity_feed_contract.py -q
```

**Step 2: Record the current pass/fail snapshot in docs**

Expected:

- current pass count is documented
- remaining unproven live behaviors are listed explicitly

**Step 3: Commit the doc-only evidence freeze**

```bash
git add docs/家庭账号社交体系/联调上线/README.md docs/plans/2026-07-05-family-account-social-task-list.md
git commit -m "docs: freeze family social validation baseline"
```

### Task 2: Deploy migrations and functions to a real Supabase project

**Files:**
- Modify: `docs/家庭账号社交体系/联调上线/01-Supabase部署与环境准备.md`
- Modify: `.env.example`
- Create: `docs/家庭账号社交体系/联调上线/deploy-log-YYYY-MM-DD.md`
- Test: `supabase/migrations/20260705_001_base_extensions.sql`
- Test: `supabase/functions/validate-registration-invite/index.ts`

**Step 1: Link the target Supabase project**

```bash
supabase login
supabase link --project-ref <project-ref>
```

Expected:

- local repo is linked to the intended pilot project

**Step 2: Push migrations**

```bash
supabase db push
```

Expected:

- all `20260705_00x` migrations apply without errors

**Step 3: Deploy the 11 Edge Functions**

```bash
supabase functions deploy validate-registration-invite
supabase functions deploy claim-registration-invite
supabase functions deploy issue-registration-invite
supabase functions deploy list-registration-invites
supabase functions deploy revoke-registration-invite
supabase functions deploy issue-household-invite
supabase functions deploy revoke-household-invite
supabase functions deploy accept-household-invite
supabase functions deploy redeem-friend-code
supabase functions deploy issue-pk-match
supabase functions deploy submit-pk-attempt
```

Expected:

- all 11 functions are live

**Step 4: Seed registration invites**

```sql
insert into public.registration_invites (invite_code, status, label, expires_at, metadata_json)
values ('PARENT-BETA-001', 'pending', 'dual-parent-a', now() + interval '30 days', '{"batch":"pilot-1"}'::jsonb);
```

Expected:

- at least one valid registration invite exists for manual signup

**Step 5: Commit the deployment notes**

```bash
git add .env.example docs/家庭账号社交体系/联调上线/01-Supabase部署与环境准备.md docs/家庭账号社交体系/联调上线/deploy-log-YYYY-MM-DD.md
git commit -m "docs: capture family social supabase deployment notes"
```

### Task 3: Validate dual-parent same-household and cross-device restore

**Files:**
- Modify: `docs/家庭账号社交体系/联调上线/02-双账号双设备联调验收矩阵.md`
- Create: `docs/家庭账号社交体系/联调上线/manual-run-YYYY-MM-DD.md`
- Test: `js/auth.js`
- Test: `js/household.js`
- Test: `js/cloud-restore.js`

**Step 1: Create family A and sync at least two children**

Manual validation:

- parent A1 signs up with a registration invite
- parent A1 creates household A
- parent A1 syncs child A-1 and child A-2

Expected:

- both children exist in the same household and each gets a cloud friend code

**Step 2: Invite parent A2 into the same household**

Manual validation:

- A1 issues a household invite
- A2 signs in on another device and accepts it

Expected:

- A2 sees household A and the existing children

**Step 3: Verify cross-device restore**

Manual validation:

- on device 2, log in without matching local profiles
- trigger child import / restore

Expected:

- cloud children appear locally
- latest cloud snapshot restores when local shell is missing

**Step 4: Save screenshots and IDs into the manual run log**

Expected:

- household IDs, child IDs, and screenshots are captured for later debugging

**Step 5: Commit the manual run notes**

```bash
git add docs/家庭账号社交体系/联调上线/02-双账号双设备联调验收矩阵.md docs/家庭账号社交体系/联调上线/manual-run-YYYY-MM-DD.md
git commit -m "docs: record dual-parent and restore validation run"
```

### Task 4: Validate friendship, visibility boundaries, and social actions

**Files:**
- Modify: `docs/家庭账号社交体系/联调上线/02-双账号双设备联调验收矩阵.md`
- Modify: `docs/家庭账号社交体系/联调上线/manual-run-YYYY-MM-DD.md`
- Test: `js/social.js`
- Test: `js/activity-feed.js`
- Test: `supabase/migrations/20260705_011_child_access_controls.sql`

**Step 1: Create family B and sync child B-1**

Expected:

- family B is isolated from family A before any friend redemption

**Step 2: Redeem friend code between A-1 and B-1**

Expected:

- both sides see the friendship relationship

**Step 3: Validate access controls**

Manual validation:

- set `home_visibility = private`
- set `visit_access = private`
- set `pk_access = private`

Expected:

- same-household child still works
- cross-household friend loses the corresponding ability

**Step 4: Trigger wave / gift / walk**

Expected:

- visit records and activity feed entries are created

**Step 5: Commit the updated validation log**

```bash
git add docs/家庭账号社交体系/联调上线/02-双账号双设备联调验收矩阵.md docs/家庭账号社交体系/联调上线/manual-run-YYYY-MM-DD.md
git commit -m "docs: record friend boundary validation run"
```

### Task 5: Validate async math and hanzi PK fairness

**Files:**
- Modify: `docs/家庭账号社交体系/联调上线/02-双账号双设备联调验收矩阵.md`
- Modify: `docs/家庭账号社交体系/联调上线/manual-run-YYYY-MM-DD.md`
- Modify: `docs/家庭账号社交体系/联调上线/04-剩余风险与二期计划.md`
- Test: `js/pk-service.js`
- Test: `js/math-pk.js`
- Test: `js/hanzi-game.js`

**Step 1: Issue a math PK from A-1 to B-1**

Expected:

- both players receive the same frozen question set

**Step 2: Submit the two attempts at different times**

Expected:

- the system settles a single result correctly after asynchronous completion

**Step 3: Repeat for hanzi PK**

Expected:

- current hanzi PK modes are verified or any gaps are written down explicitly

**Step 4: Confirm activity feed entries**

Expected:

- feed shows issued, submitted, and completed PK events

**Step 5: Commit the PK validation notes**

```bash
git add docs/家庭账号社交体系/联调上线/manual-run-YYYY-MM-DD.md docs/家庭账号社交体系/联调上线/04-剩余风险与二期计划.md
git commit -m "docs: record async pk validation run"
```

### Task 6: Make the rollout decision and capture fallback actions

**Files:**
- Modify: `docs/家庭账号社交体系/联调上线/03-上线检查与回滚手册.md`
- Modify: `docs/README.md`
- Modify: `docs/plans/README.md`
- Test: `docs/家庭账号社交体系/联调上线/README.md`

**Step 1: Review go/no-go against real evidence**

Expected:

- every required behavior is marked pass, fail, or unproven

**Step 2: Decide pilot scope**

Expected:

- one of: stay in dev-only, open to 2 internal families, or open to 5-10 family pilot

**Step 3: Update rollback guidance if new failure modes were found**

Expected:

- rollback actions reflect the actual manual test results

**Step 4: Commit the rollout decision**

```bash
git add docs/家庭账号社交体系/联调上线/03-上线检查与回滚手册.md docs/README.md docs/plans/README.md
git commit -m "docs: finalize family social rollout decision"
```

---

Plan complete and saved to `docs/plans/2026-07-05-family-account-social-live-validation-plan.md`.
