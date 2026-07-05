from __future__ import annotations

import json
import shutil
import subprocess
import sys
from pathlib import Path

from PIL import Image, ImageDraw

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")


REPO_ROOT = Path(__file__).resolve().parents[1]
PIPELINE = REPO_ROOT / ".claude" / "skills" / "gpt-image-pipeline" / "pipeline.py"
PROMPTS = REPO_ROOT / ".claude" / "skills" / "gpt-image-pipeline" / "prompt_templates.py"
REMOVE_BG = REPO_ROOT / ".claude" / "skills" / "gpt-image-pipeline" / "remove_background.py"
TMP_ROOT = REPO_ROOT / ".tmp_gpt_image_pipeline_smoke"


def build_fixtures(root: Path) -> None:
    root.mkdir(exist_ok=True)

    sheet = Image.new("RGBA", (120, 80), (255, 255, 255, 255))
    draw = ImageDraw.Draw(sheet)
    draw.rounded_rectangle((10, 10, 50, 70), radius=10, fill=(255, 100, 100, 255))
    draw.rounded_rectangle((70, 10, 110, 70), radius=10, fill=(100, 140, 255, 255))
    sheet.save(root / "sheet.png")

    white_bg = Image.new("RGBA", (120, 120), (255, 255, 255, 255))
    draw_bg = ImageDraw.Draw(white_bg)
    draw_bg.ellipse((20, 20, 100, 100), fill=(70, 190, 120, 255))
    white_bg.save(root / "white_bg.png")


def build_ps1(root: Path) -> Path:
    script = root / "run_smoke.ps1"
    script.write_text(
        "\n".join(
            [
                "$ErrorActionPreference = 'Stop'",
                f"$root = '{root}'",
                f"python '{PROMPTS}' --template ui-card --subject 'cute math reward badge' --output (Join-Path $root 'prompt.txt')",
                (
                    f"python '{REMOVE_BG}' --input (Join-Path $root 'white_bg.png') --mode solid-color "
                    "--color white --tolerance 20 --out (Join-Path $root 'clean') --trim"
                ),
                (
                    f"python '{PIPELINE}' --mode post-process --input (Join-Path $root 'sheet.png') "
                    "--sheet-cols 2 --sheet-rows 1 --remove-bg none "
                    "--out (Join-Path $root 'out')"
                ),
            ]
        ),
        encoding="utf-8-sig",
    )
    return script


def main() -> None:
    if TMP_ROOT.exists():
        shutil.rmtree(TMP_ROOT)
    build_fixtures(TMP_ROOT)
    ps1 = build_ps1(TMP_ROOT)

    result = subprocess.run(
        ["powershell", "-ExecutionPolicy", "Bypass", "-File", str(ps1)],
        cwd=REPO_ROOT,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        encoding="utf-8",
        errors="replace",
    )

    manifest = TMP_ROOT / "out" / "_manifest.json"
    clean_file = TMP_ROOT / "clean" / "white_bg_clean.png"
    clean_corner_alpha = None
    if clean_file.exists():
        clean_corner_alpha = Image.open(clean_file).convert("RGBA").getpixel((0, 0))[3]
    summary = {
        "returncode": result.returncode,
        "manifest_exists": manifest.exists(),
        "clean_file_exists": clean_file.exists(),
        "clean_corner_alpha": clean_corner_alpha,
        "output_preview": result.stdout[-1200:],
    }
    print(json.dumps(summary, ensure_ascii=False, indent=2))

    if result.returncode != 0:
        raise SystemExit(result.returncode)
    if not manifest.exists():
        raise SystemExit("missing _manifest.json")
    if not clean_file.exists():
        raise SystemExit("missing cleaned png")
    if clean_corner_alpha != 0:
        raise SystemExit(f"expected transparent corner, got alpha={clean_corner_alpha}")


if __name__ == "__main__":
    main()
