from __future__ import annotations

import json
import shutil
import subprocess
import sys
from pathlib import Path

from PIL import Image

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")


REPO_ROOT = Path(__file__).resolve().parents[1]
SCRIPT = REPO_ROOT / ".claude" / "skills" / "gpt-image-pipeline" / "publish_transparent_assets.py"
TMP_ROOT = REPO_ROOT / ".tmp_publish_transparent_assets_test"


def run_publish(input_name: str, base_name: str) -> subprocess.CompletedProcess[str]:
    input_path = REPO_ROOT / "assets" / "ui" / "playground-parts" / input_name
    out_dir = TMP_ROOT / base_name
    return subprocess.run(
        [
            sys.executable,
            str(SCRIPT),
            "--input",
            str(input_path),
            "--out",
            str(out_dir),
            "--base-name",
            base_name,
            "--mode",
            "checkerboard",
        ],
        cwd=REPO_ROOT,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        encoding="utf-8",
        errors="replace",
    )


def edge_alpha_stats(path: Path) -> dict[str, int]:
    img = Image.open(path).convert("RGBA")
    w, h = img.size
    alphas: list[int] = []
    for x in range(w):
        alphas.append(img.getpixel((x, 0))[3])
        alphas.append(img.getpixel((x, h - 1))[3])
    for y in range(1, h - 1):
        alphas.append(img.getpixel((0, y))[3])
        alphas.append(img.getpixel((w - 1, y))[3])
    return {
        "nonzero": sum(1 for a in alphas if a > 0),
        "max": max(alphas) if alphas else 0,
    }


def main() -> None:
    if TMP_ROOT.exists():
        shutil.rmtree(TMP_ROOT)
    TMP_ROOT.mkdir(parents=True)

    runs = [
        ("游乐场-汉字.png", "hanzi-card"),
        ("游乐场-排行榜.png", "leaderboard-card"),
    ]

    summary: dict[str, object] = {"runs": []}
    for input_name, base_name in runs:
        result = run_publish(input_name, base_name)
        out_dir = TMP_ROOT / base_name
        png_path = out_dir / f"{base_name}.png"
        webp_path = out_dir / f"{base_name}.webp"
        manifest_path = out_dir / "publish_manifest.json"
        run_summary = {
            "input": input_name,
            "base_name": base_name,
            "returncode": result.returncode,
            "output_tail": result.stdout[-1200:],
            "png_exists": png_path.exists(),
            "webp_exists": webp_path.exists(),
            "manifest_exists": manifest_path.exists(),
        }
        if png_path.exists():
            run_summary["png_edge"] = edge_alpha_stats(png_path)
        if webp_path.exists():
            run_summary["webp_edge"] = edge_alpha_stats(webp_path)
        summary["runs"].append(run_summary)

    print(json.dumps(summary, ensure_ascii=False, indent=2))

    for item in summary["runs"]:
        if item["returncode"] != 0:
            raise SystemExit(item["returncode"])
        if not item["png_exists"]:
            raise SystemExit(f"missing png output for {item['base_name']}")
        if not item["webp_exists"]:
            raise SystemExit(f"missing webp output for {item['base_name']}")
        if not item["manifest_exists"]:
            raise SystemExit(f"missing manifest for {item['base_name']}")
        if item["png_edge"]["nonzero"] != 0 or item["png_edge"]["max"] != 0:
            raise SystemExit(f"png edge is not fully transparent for {item['base_name']}")
        if item["webp_edge"]["nonzero"] != 0 or item["webp_edge"]["max"] != 0:
            raise SystemExit(f"webp edge is not fully transparent for {item['base_name']}")


if __name__ == "__main__":
    main()
