import subprocess
from pathlib import Path


def test_family_social_ops_script_covers_invites_and_diagnostics():
    script = Path("scripts/family-social-ops.mjs").read_text(encoding="utf-8")

    assert "SUPABASE_SERVICE_ROLE_KEY" in script
    assert "registration:list" in script
    assert "registration:issue" in script
    assert "registration:revoke" in script
    assert "registration:seed-sql" in script
    assert "household-invites:list" in script
    assert "household-invites:revoke" in script
    assert "household:inspect" in script
    assert "child:inspect" in script
    assert "pilot:overview" in script
    assert "pilot:doctor" in script
    assert "cloud-config.local.js 已就绪" in script
    assert "config:install-local" in script
    assert "config:inspect" in script
    assert "pk:inspect" in script
    assert "pair:inspect" in script
    assert "diagnostics:compare" in script
    assert "cloud_config_local_missing" in script
    assert "pilot:bundle" in script
    assert "deploy:bundle" in script
    assert "logs:report" in script
    assert "异常雷达" in script
    assert "childrenNeverSynced" in script
    assert "householdsWithoutChildren" in script
    assert "stalePkMatches" in script
    assert "template:manual-run" in script
    assert "template:deploy-log" in script
    assert "template:go-no-go" in script
    assert "template:all" in script
    assert "registration_invites" in script
    assert "household_invites" in script
    assert "child_profiles" in script
    assert "activity_feed" in script


def test_family_social_log_templates_exist_with_rollout_structure():
    manual_template = Path("docs/家庭账号社交体系/联调上线/manual-run-template.md").read_text(encoding="utf-8")
    deploy_template = Path("docs/家庭账号社交体系/联调上线/deploy-log-template.md").read_text(encoding="utf-8")
    go_no_go_template = Path("docs/家庭账号社交体系/联调上线/go-no-go-template.md").read_text(encoding="utf-8")

    assert "{{DATE}}" in manual_template
    assert "`A01`" in manual_template
    assert "`C05`" in manual_template
    assert "household:inspect" in manual_template
    assert "{{DATE}}" in deploy_template
    assert "supabase db push" in deploy_template
    assert "validate-registration-invite" in deploy_template
    assert "{{REGISTRATION_ISSUE_COMMAND}}" in deploy_template
    assert "pilot:overview" in deploy_template
    assert "{{GO_NO_GO_FILE}}" in go_no_go_template
    assert "Go / No-Go 核心检查" in go_no_go_template


def test_env_example_mentions_service_role_for_ops_script():
    env_example = Path(".env.example").read_text(encoding="utf-8")
    gitignore = Path(".gitignore").read_text(encoding="utf-8")

    assert "family-social-ops.mjs" in env_example
    assert "\nSUPABASE_URL=" in env_example
    assert "\nSUPABASE_ANON_KEY=" in env_example
    assert "SUPABASE_SERVICE_ROLE_KEY" in env_example
    assert "cloud-config.local.js" in gitignore


def test_rollout_docs_reference_family_social_ops_script():
    deploy_doc = Path("docs/家庭账号社交体系/联调上线/01-Supabase部署与环境准备.md").read_text(encoding="utf-8")
    rollout_readme = Path("docs/家庭账号社交体系/联调上线/README.md").read_text(encoding="utf-8")
    risk_doc = Path("docs/家庭账号社交体系/联调上线/04-剩余风险与二期计划.md").read_text(encoding="utf-8")

    assert "family-social-ops.mjs" in deploy_doc
    assert "family-social-ops.mjs" in rollout_readme
    assert "family-social-ops.mjs" in risk_doc
    assert "pilot:doctor" in rollout_readme
    assert "pilot:doctor" in deploy_doc
    assert "template:manual-run" in rollout_readme
    assert "template:deploy-log" in deploy_doc
    assert "pilot:overview" in rollout_readme
    assert "pilot:overview" in deploy_doc
    assert "异常" in rollout_readme


def test_family_social_ops_can_render_pilot_report_from_json(tmp_path):
    output = tmp_path / "pilot-overview-report.md"
    result = subprocess.run(
        [
            "node",
            "scripts/family-social-ops.mjs",
            "pilot:report",
            "--json-input",
            "prj/fixtures/family-social-pilot-overview-sample.json",
            "--date",
            "2026-07-05",
            "--output",
            str(output),
            "--force",
        ],
        cwd=Path.cwd(),
        capture_output=True,
        text=True,
        encoding="utf-8",
        check=False,
    )

    assert result.returncode == 0, result.stderr or result.stdout
    report = output.read_text(encoding="utf-8")
    assert "# 家庭账号社交试运行巡检报告（2026-07-05）" in report
    assert "## 异常雷达" in report
    assert "REG-EXPIRE-001" in report
    assert "pk-stale-001" in report


def test_family_social_ops_can_render_pilot_bundle_from_json(tmp_path):
    result = subprocess.run(
        [
            "node",
            "scripts/family-social-ops.mjs",
            "pilot:bundle",
            "--json-input",
            "prj/fixtures/family-social-pilot-overview-sample.json",
            "--date",
            "2026-07-05",
            "--output-dir",
            str(tmp_path),
            "--force",
        ],
        cwd=Path.cwd(),
        capture_output=True,
        text=True,
        encoding="utf-8",
        check=False,
    )

    assert result.returncode == 0, result.stderr or result.stdout
    overview_json = tmp_path / "pilot-overview-2026-07-05.json"
    overview_md = tmp_path / "pilot-overview-2026-07-05.md"
    doctor_json = tmp_path / "pilot-doctor-2026-07-05.json"
    doctor_md = tmp_path / "pilot-doctor-2026-07-05.md"
    manual_run = tmp_path / "manual-run-2026-07-05.md"
    deploy_log = tmp_path / "deploy-log-2026-07-05.md"
    go_no_go = tmp_path / "go-no-go-2026-07-05.md"

    assert overview_json.exists()
    assert overview_md.exists()
    assert doctor_json.exists()
    assert doctor_md.exists()
    assert manual_run.exists()
    assert deploy_log.exists()
    assert go_no_go.exists()

    bundle_json = overview_json.read_text(encoding="utf-8")
    assert '"source": "json-input"' in bundle_json
    report = overview_md.read_text(encoding="utf-8")
    assert "## 异常雷达" in report
    assert "REG-EXPIRE-001" in report
    doctor_report = doctor_md.read_text(encoding="utf-8")
    assert "# 家庭账号社交联调前体检（2026-07-05）" in doctor_report


def test_family_social_ops_can_run_pilot_doctor_json(tmp_path):
    env_file = tmp_path / ".env"
    env_file.write_text(
        "\n".join([
            "APP_SUPABASE_URL=https://demo-project.supabase.co",
            "APP_SUPABASE_ANON_KEY=test-anon-key",
            "SUPABASE_SERVICE_ROLE_KEY=test-service-role-key",
            "APP_SUPABASE_SITE_URL=http://127.0.0.1:5500",
        ]),
        encoding="utf-8",
    )

    result = subprocess.run(
        [
            "node",
            "scripts/family-social-ops.mjs",
            "pilot:doctor",
            "--env-file",
            str(env_file),
            "--date",
            "2026-07-05",
            "--json",
        ],
        cwd=Path.cwd(),
        capture_output=True,
        text=True,
        encoding="utf-8",
        check=False,
    )

    assert result.returncode == 0, result.stderr or result.stdout
    assert '"ready": true' in result.stdout
    assert 'APP_SUPABASE_URL / SUPABASE_URL 已配置' in result.stdout
    assert 'APP_SUPABASE_ANON_KEY / SUPABASE_ANON_KEY 已配置' in result.stdout
    assert 'SUPABASE_SERVICE_ROLE_KEY' in result.stdout
    assert 'cloud-config.local.js 已就绪' in result.stdout


def test_family_social_ops_can_generate_registration_seed_sql(tmp_path):
    output = tmp_path / "registration-invites-2026-07-05.sql"
    result = subprocess.run(
        [
            "node",
            "scripts/family-social-ops.mjs",
            "registration:seed-sql",
            "--date",
            "2026-07-05",
            "--prefix",
            "PARENT-BETA",
            "--batch",
            "pilot-1",
            "--output",
            str(output),
            "--force",
        ],
        cwd=Path.cwd(),
        capture_output=True,
        text=True,
        encoding="utf-8",
        check=False,
    )

    assert result.returncode == 0, result.stderr or result.stdout
    sql = output.read_text(encoding="utf-8")
    assert "insert into public.registration_invites" in sql
    assert "PARENT-BETA" in sql
    assert "update public.registration_invites" in sql


def test_family_social_ops_can_generate_deploy_bundle(tmp_path):
    result = subprocess.run(
        [
            "node",
            "scripts/family-social-ops.mjs",
            "deploy:bundle",
            "--date",
            "2026-07-05",
            "--project-ref",
            "demo-project-ref",
            "--url",
            "https://demo-project.supabase.co",
            "--anon-key",
            "demo-anon-key",
            "--site-url",
            "http://127.0.0.1:5500",
            "--output-dir",
            str(tmp_path),
            "--force",
        ],
        cwd=Path.cwd(),
        capture_output=True,
        text=True,
        encoding="utf-8",
        check=False,
    )

    assert result.returncode == 0, result.stderr or result.stdout
    ps1 = tmp_path / "supabase-deploy-2026-07-05.ps1"
    js = tmp_path / "cloud-config-2026-07-05.js"
    local_js = tmp_path / "cloud-config.local.js"
    sql = tmp_path / "registration-invites-2026-07-05.sql"
    deploy_log = tmp_path / "deploy-log-2026-07-05.md"
    assert ps1.exists()
    assert js.exists()
    assert local_js.exists()
    assert sql.exists()
    assert deploy_log.exists()
    ps1_text = ps1.read_text(encoding="utf-8")
    js_text = js.read_text(encoding="utf-8")
    local_js_text = local_js.read_text(encoding="utf-8")
    sql_text = sql.read_text(encoding="utf-8")
    assert "supabase db push" in ps1_text
    assert "supabase secrets set" in ps1_text
    assert "SUPABASE_URL=$SupabaseUrl" in ps1_text
    assert "SUPABASE_ANON_KEY=$SupabaseAnonKey" in ps1_text
    assert "SUPABASE_SERVICE_ROLE_KEY=$SupabaseServiceRoleKey" in ps1_text
    assert "supabase functions deploy validate-registration-invite" in ps1_text
    assert "supabase functions deploy submit-pk-attempt" in ps1_text
    assert "window.__PETBANK_CLOUD_CONFIG__" in js_text
    assert "__PETBANK_CLOUD_CONFIG_SOURCE__" in js_text
    assert "https://demo-project.supabase.co" in js_text
    assert "window.__PETBANK_CLOUD_CONFIG__" in local_js_text
    assert "__PETBANK_CLOUD_CONFIG_SOURCE__" in local_js_text
    assert "demo-anon-key" in local_js_text
    assert "insert into public.registration_invites" in sql_text


def test_family_social_ops_can_install_local_cloud_config(tmp_path):
    output = tmp_path / "cloud-config.local.js"
    result = subprocess.run(
        [
            "node",
            "scripts/family-social-ops.mjs",
            "config:install-local",
            "--url",
            "https://demo-project.supabase.co",
            "--anon-key",
            "demo-anon-key",
            "--site-url",
            "http://127.0.0.1:5500",
            "--output",
            str(output),
            "--force",
        ],
        cwd=Path.cwd(),
        capture_output=True,
        text=True,
        encoding="utf-8",
        check=False,
    )

    assert result.returncode == 0, result.stderr or result.stdout
    assert output.exists()
    js_text = output.read_text(encoding="utf-8")
    assert "window.__PETBANK_CLOUD_CONFIG__" in js_text
    assert "__PETBANK_CLOUD_CONFIG_SOURCE__" in js_text
    assert "cloud-config.local.js" in js_text
    assert "demo-anon-key" in js_text


def test_family_social_ops_rejects_placeholder_local_cloud_config_install(tmp_path):
    env_file = tmp_path / ".env"
    env_file.write_text("", encoding="utf-8")
    output = tmp_path / "cloud-config.local.js"
    result = subprocess.run(
        [
            "node",
            "scripts/family-social-ops.mjs",
            "config:install-local",
            "--env-file",
            str(env_file),
            "--output",
            str(output),
            "--force",
        ],
        cwd=Path.cwd(),
        capture_output=True,
        text=True,
        encoding="utf-8",
        check=False,
    )

    assert result.returncode != 0
    combined = (result.stderr or "") + (result.stdout or "")
    assert "--url" in combined or "APP_SUPABASE_URL" in combined
    assert not output.exists()


def test_family_social_ops_can_inspect_config_json(tmp_path):
    env_file = tmp_path / ".env"
    env_file.write_text(
        "\n".join([
            "APP_SUPABASE_URL=https://demo-project.supabase.co",
            "APP_SUPABASE_ANON_KEY=test-anon-key",
            "SUPABASE_SERVICE_ROLE_KEY=test-service-role-key",
            "APP_SUPABASE_SITE_URL=http://127.0.0.1:5500",
        ]),
        encoding="utf-8",
    )
    config_file = tmp_path / "cloud-config.local.js"
    install_result = subprocess.run(
        [
            "node",
            "scripts/family-social-ops.mjs",
            "config:install-local",
            "--env-file",
            str(env_file),
            "--output",
            str(config_file),
            "--force",
        ],
        cwd=Path.cwd(),
        capture_output=True,
        text=True,
        encoding="utf-8",
        check=False,
    )
    assert install_result.returncode == 0, install_result.stderr or install_result.stdout

    result = subprocess.run(
        [
            "node",
            "scripts/family-social-ops.mjs",
            "config:inspect",
            "--env-file",
            str(env_file),
            "--cloud-config-file",
            str(config_file),
            "--json",
        ],
        cwd=Path.cwd(),
        capture_output=True,
        text=True,
        encoding="utf-8",
        check=False,
    )

    assert result.returncode == 0, result.stderr or result.stdout
    payload = __import__("json").loads(result.stdout)
    assert payload["envFile"]["exists"] is True
    assert payload["envConfig"]["supabaseUrl"] == "https://demo-project.supabase.co"
    assert payload["envConfig"]["hasAnonKey"] is True
    assert payload["cloudConfigFile"]["exists"] is True
    assert payload["cloudConfigFile"]["sourceKey"] == "cloud-config.local.js"
    assert payload["cloudConfigFile"]["supabaseUrl"] == "https://demo-project.supabase.co"
    assert payload["effectiveStaticDefault"]["sourceKey"] == "cloud-config.local.js"
    assert payload["effectiveStaticDefault"]["supabaseUrl"] == "https://demo-project.supabase.co"
    assert "浏览器里已保存的配置" in payload["notes"][0]


def test_family_social_ops_can_inspect_pk_json():
    result = subprocess.run(
        [
            "node",
            "scripts/family-social-ops.mjs",
            "pk:inspect",
            "--json-input",
            "prj/fixtures/family-social-pk-inspect-sample.json",
            "--json",
        ],
        cwd=Path.cwd(),
        capture_output=True,
        text=True,
        encoding="utf-8",
        check=False,
    )

    assert result.returncode == 0, result.stderr or result.stdout
    payload = __import__("json").loads(result.stdout)
    assert payload["summary"]["matchId"] == "pk-match-001"
    assert payload["summary"]["questionCount"] == 3
    assert payload["summary"]["attemptCount"] == 2
    assert payload["summary"]["winnerChildId"] == "child-a-001"
    assert payload["summary"]["winnerReason"] == "duration"
    assert payload["questionSet"]["summaryText"] == "HSK 1 · 看拼音选字 / 例句填空 · 3 题同题挑战"
    assert payload["challenger"]["child"]["display_name"] == "小明"
    assert payload["challenger"]["attempt"]["score"] == 90
    assert payload["opponent"]["attempt"]["durationMs"] == 61000
    assert payload["recentActivity"][0]["event_type"] == "pk_match_completed"


def test_family_social_ops_can_inspect_child_pair_json():
    result = subprocess.run(
        [
            "node",
            "scripts/family-social-ops.mjs",
            "pair:inspect",
            "--json-input",
            "prj/fixtures/family-social-pair-inspect-sample.json",
            "--json",
        ],
        cwd=Path.cwd(),
        capture_output=True,
        text=True,
        encoding="utf-8",
        check=False,
    )

    assert result.returncode == 0, result.stderr or result.stdout
    payload = __import__("json").loads(result.stdout)
    assert payload["summary"]["sameHousehold"] is False
    assert payload["summary"]["friendshipState"] == "mutual"
    assert payload["aToB"]["canViewHouse"] is True
    assert payload["bToA"]["canViewHouse"] is False
    assert payload["aToB"]["canVisit"] is True
    assert payload["bToA"]["canVisit"] is False
    assert payload["aToB"]["canChallenge"] is False
    assert payload["bToA"]["canChallenge"] is True
    assert payload["recentVisits"][0]["action_type"] == "wave"
    assert payload["recentPkMatches"][0]["status"] == "pending"


def test_family_social_ops_can_compare_diagnostics_json():
    result = subprocess.run(
        [
            "node",
            "scripts/family-social-ops.mjs",
            "diagnostics:compare",
            "--left-json",
            "prj/fixtures/family-social-diagnostics-device-a.json",
            "--right-json",
            "prj/fixtures/family-social-diagnostics-device-b.json",
            "--json",
        ],
        cwd=Path.cwd(),
        capture_output=True,
        text=True,
        encoding="utf-8",
        check=False,
    )

    assert result.returncode == 0, result.stderr or result.stdout
    payload = __import__("json").loads(result.stdout)
    assert payload["left"]["device"]["label"] == "设备1-家长A1"
    assert payload["right"]["device"]["label"] == "设备2-家长A2"
    assert payload["summary"]["samePrimaryHouseholdId"] is True
    assert payload["summary"]["sameUserId"] is False
    assert payload["summary"]["cloudChildrenAligned"] is False
    assert payload["summary"]["localProfilesAligned"] is False
    assert payload["summary"]["leftCloudChildCount"] == 2
    assert payload["summary"]["rightCloudChildCount"] == 1
    assert payload["onlyOnLeft"]["cloudChildIds"] == ["child-a-002"]
    assert payload["onlyOnLeft"]["localProfileIds"] == ["profile-a-002"]
    assert payload["right"]["restore"]["lastHydratedAt"] == "2026-07-05T09:20:00.000Z"
    assert payload["differences"][0]["type"] == "cloud_child_missing_on_right"


def test_family_social_ops_can_compare_diagnostics_detect_shared_child_mismatch():
    result = subprocess.run(
        [
            "node",
            "scripts/family-social-ops.mjs",
            "diagnostics:compare",
            "--left-json",
            "prj/fixtures/family-social-diagnostics-shared-left.json",
            "--right-json",
            "prj/fixtures/family-social-diagnostics-shared-right.json",
            "--json",
        ],
        cwd=Path.cwd(),
        capture_output=True,
        text=True,
        encoding="utf-8",
        check=False,
    )

    assert result.returncode == 0, result.stderr or result.stdout
    payload = __import__("json").loads(result.stdout)
    assert payload["left"]["device"]["label"] == "设备1-恢复前"
    assert payload["right"]["device"]["label"] == "设备2-恢复后"
    assert payload["summary"]["cloudChildrenAligned"] is True
    assert payload["summary"]["sharedChildFieldsAligned"] is False
    assert payload["summary"]["sharedChildFieldMismatchCount"] == 2
    assert payload["differences"][0]["type"] == "shared_child_field_mismatch"
    assert payload["differences"][0]["childId"] == "child-a-001"
    assert payload["differences"][0]["field"] == "localProfileId"
    assert payload["differences"][1]["field"] == "visitAccess"


def test_family_social_ops_can_generate_logs_report(tmp_path):
    output = tmp_path / "function-logs-2026-07-05.md"
    result = subprocess.run(
        [
            "node",
            "scripts/family-social-ops.mjs",
            "logs:report",
            "--json-input",
            "prj/fixtures/family-social-function-logs-sample.json",
            "--date",
            "2026-07-05",
            "--output",
            str(output),
            "--force",
        ],
        cwd=Path.cwd(),
        capture_output=True,
        text=True,
        encoding="utf-8",
        check=False,
    )

    assert result.returncode == 0, result.stderr or result.stdout
    report = output.read_text(encoding="utf-8")
    assert "# 家庭账号社交函数日志汇总（2026-07-05）" in report
    assert "issue-household-invite" in report
    assert "household owner validation failed" in report
