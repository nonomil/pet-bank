from __future__ import annotations

import json
import shutil
import subprocess
import sys
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")


REPO_ROOT = Path(__file__).resolve().parents[1]
WORKFLOW_SCRIPT = REPO_ROOT / "prj" / "gpt-image-workflow" / "scripts" / "run-pipeline.ps1"
TMP_ROOT = REPO_ROOT / ".tmp_gpt_image_workflow_workspace"


def run_ps(*args: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["powershell", "-ExecutionPolicy", "Bypass", "-File", str(WORKFLOW_SCRIPT), *args],
        cwd=REPO_ROOT,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        encoding="utf-8",
        errors="replace",
    )


def main() -> None:
    if TMP_ROOT.exists():
        shutil.rmtree(TMP_ROOT)
    TMP_ROOT.mkdir(parents=True)

    preflight_dir = TMP_ROOT / "preflight"
    browser_dir = TMP_ROOT / "browser_handoff"
    publish_dir = TMP_ROOT / "publish_transparent"

    preflight = run_ps("-Mode", "preflight", "-OutDir", str(preflight_dir))
    browser = run_ps(
        "-Mode",
        "browser-handoff",
        "-Template",
        "ui-card",
        "-Subject",
        "cute math reward badge",
        "-OutDir",
        str(browser_dir),
    )
    publish = run_ps(
        "-Mode",
        "publish-transparent",
        "-Input",
        str(REPO_ROOT / "assets" / "ui" / "playground-parts" / "游乐场-排行榜.png"),
        "-OutDir",
        str(publish_dir),
        "-BaseName",
        "leaderboard-card",
        "-RemoveBg",
        "checkerboard",
    )

    summary = {
        "preflight_returncode": preflight.returncode,
        "browser_returncode": browser.returncode,
        "publish_returncode": publish.returncode,
        "preflight_output": preflight.stdout[-800:],
        "browser_output": browser.stdout[-800:],
        "publish_output": publish.stdout[-800:],
        "preflight_json_exists": (preflight_dir / "preflight.json").exists(),
        "browser_prompt_exists": (browser_dir / "browser_prompt.txt").exists(),
        "browser_handoff_exists": (browser_dir / "browser_handoff.md").exists(),
        "browser_manifest_exists": (browser_dir / "manifest.json").exists(),
        "publish_png_exists": (publish_dir / "leaderboard-card.png").exists(),
        "publish_webp_exists": (publish_dir / "leaderboard-card.webp").exists(),
        "publish_manifest_exists": (publish_dir / "publish_manifest.json").exists(),
    }
    print(json.dumps(summary, ensure_ascii=False, indent=2))

    if preflight.returncode != 0:
        raise SystemExit(preflight.returncode)
    if browser.returncode != 0:
        raise SystemExit(browser.returncode)
    if publish.returncode != 0:
        raise SystemExit(publish.returncode)
    if not (preflight_dir / "preflight.json").exists():
        raise SystemExit("missing preflight.json")
    if not (browser_dir / "browser_prompt.txt").exists():
        raise SystemExit("missing browser_prompt.txt")
    if not (browser_dir / "browser_handoff.md").exists():
        raise SystemExit("missing browser_handoff.md")
    if not (browser_dir / "manifest.json").exists():
        raise SystemExit("missing manifest.json")
    if not (publish_dir / "leaderboard-card.png").exists():
        raise SystemExit("missing leaderboard-card.png")
    if not (publish_dir / "leaderboard-card.webp").exists():
        raise SystemExit("missing leaderboard-card.webp")
    if not (publish_dir / "publish_manifest.json").exists():
        raise SystemExit("missing publish_manifest.json")


if __name__ == "__main__":
    main()
