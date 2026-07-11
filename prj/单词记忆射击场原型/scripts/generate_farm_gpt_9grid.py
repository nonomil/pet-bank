#!/usr/bin/env python3
"""Generate or import a farm GPT 9-grid preview pack.

Default flow:
1. Generate a stitched farm world image through the Bee workflow helper.
2. Crop it into the farm-gpt-9grid runtime tile directory.
3. Persist a small provenance json beside the manifest.

Fallback flow:
  --source <png>
Skips Bee generation and uses an existing stitched source image directly.
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from datetime import date
from pathlib import Path


def repo_root() -> Path:
    current = Path(__file__).resolve()
    for parent in current.parents:
        if (parent / "docs" / "GPT生图" / "GPT生图模型key.md").exists():
            return parent
    raise SystemExit("Cannot locate repo root")


ROOT = repo_root()
PROJECT = ROOT / "prj" / "单词记忆射击场原型"
REFERENCE_DIR = PROJECT / "assets" / "generated" / "reference" / "farm-gpt-9grid-20260710"
PROMPT_FILE = REFERENCE_DIR / "farm-gpt-9grid.prompt.txt"
BOXES_FILE = PROJECT / "assets" / "generated" / "world-bg-tiles" / "farm-9grid-boxes.json"
OUT_DIR = PROJECT / "assets" / "generated" / "world-bg-tiles" / "farm-gpt-9grid"
MANIFEST_PATH = PROJECT / "assets" / "generated" / "world-bg-tiles" / "farm-gpt-9grid-manifest.json"
SOURCE_META = PROJECT / "assets" / "generated" / "world-bg-tiles" / "farm-gpt-9grid-source.json"
DEFAULT_PREFIX = "farm-gpt-9grid-source"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--source",
        default="",
        help="Existing stitched png to crop instead of generating through Bee",
    )
    parser.add_argument(
        "--prefix",
        default=DEFAULT_PREFIX,
        help="Prefix for generated Bee output files",
    )
    parser.add_argument(
        "--size",
        default="1536x1024",
        help="Bee generation size",
    )
    return parser.parse_args()


def run(cmd: list[str]) -> None:
    print("$ " + " ".join(str(part) for part in cmd))
    result = subprocess.run(cmd, cwd=str(ROOT), check=False)
    if result.returncode != 0:
        raise SystemExit(result.returncode)


def generate_with_bee(prefix: str, size: str) -> Path:
    run([
        sys.executable,
        "-X",
        "utf8",
        str(ROOT / ".codex" / "skills" / "gpt-image-bee-workflow" / "scripts" / "bee_image_workflow.py"),
        "generate",
        "--prompt-file",
        str(PROMPT_FILE),
        "--out",
        str(REFERENCE_DIR),
        "--prefix",
        prefix,
        "--size",
        size,
    ])
    image_path = REFERENCE_DIR / f"{prefix}.png"
    if not image_path.exists():
        raise SystemExit(f"Expected generated image missing: {image_path}")
    return image_path


def crop_source(source_path: Path) -> None:
    run([
        sys.executable,
        "-X",
        "utf8",
        str(PROJECT / "scripts" / "export_world_tiles_from_boxes.py"),
        "--source",
        str(source_path),
        "--boxes",
        str(BOXES_FILE),
        "--out",
        str(OUT_DIR),
    ])


def count_exported_tiles() -> int:
    return len(sorted(OUT_DIR.glob("farm_tile_r*_c*.png")))


def write_source_meta(source_path: Path, prefix: str, generated: bool, tile_count: int) -> None:
    payload = {
        "sourceImage": str(source_path.relative_to(ROOT)).replace("\\", "/"),
        "boxes": str(BOXES_FILE.relative_to(ROOT)).replace("\\", "/"),
        "manifest": str(MANIFEST_PATH.relative_to(ROOT)).replace("\\", "/"),
        "tilesDir": str(OUT_DIR.relative_to(ROOT)).replace("\\", "/"),
        "exportScript": str((PROJECT / "scripts" / "export_world_tiles_from_boxes.py").relative_to(ROOT)).replace("\\", "/"),
        "workflowScript": str((PROJECT / "scripts" / "generate_farm_gpt_9grid.py").relative_to(ROOT)).replace("\\", "/"),
        "promptFile": str(PROMPT_FILE.relative_to(ROOT)).replace("\\", "/"),
        "exportedAt": str(date.today()),
        "generatedViaBee": generated,
        "prefix": prefix,
        "tileCount": tile_count,
        "notes": "Parallel farm GPT preview pack. Default farm manifest remains unchanged until manual switch."
    }
    SOURCE_META.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def verify_runtime_artifacts(tile_count: int) -> None:
    if not MANIFEST_PATH.exists():
        raise SystemExit(f"Expected manifest missing: {MANIFEST_PATH}")
    if tile_count != 9:
        raise SystemExit(f"Expected 9 exported tiles, got {tile_count}")


def main() -> int:
    args = parse_args()
    REFERENCE_DIR.mkdir(parents=True, exist_ok=True)
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    if args.source:
        source_path = Path(args.source)
        if not source_path.is_absolute():
            source_path = ROOT / source_path
        generated = False
    else:
        source_path = generate_with_bee(args.prefix, args.size)
        generated = True

    if not source_path.exists():
        raise SystemExit(f"Source image not found: {source_path}")

    crop_source(source_path)
    tile_count = count_exported_tiles()
    verify_runtime_artifacts(tile_count)
    write_source_meta(source_path, args.prefix, generated, tile_count)
    print(f"SOURCE={source_path}")
    print(f"TILES={OUT_DIR}")
    print(f"META={SOURCE_META}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
