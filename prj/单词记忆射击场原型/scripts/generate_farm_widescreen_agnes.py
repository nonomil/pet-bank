#!/usr/bin/env python3
"""Generate widescreen farm world screens via Agnes.

Usage:
    python prj/单词记忆射击场原型/scripts/generate_farm_widescreen_agnes.py --row3 --force
"""

from __future__ import annotations

import argparse
import base64
import json
import os
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path


API_URL = "https://apihub.agnes-ai.com/v1/images/generations"
MODEL = "agnes-image-2.1-flash"
DEFAULT_SIZE = "1536x864"
MAX_RETRY = 2

ROOT = Path(__file__).resolve().parents[3]
PROJECT = Path(__file__).resolve().parents[1]
BG_DIR = PROJECT / "assets" / "背景图片"
REF_DIR = PROJECT / "assets" / "generated" / "reference" / "farm-widescreen-agnes"

BASE_STYLE = (
    "Create one 16:9 landscape gameplay background for a children's English learning action game. "
    "Camera: top-down or slightly tilted top-down. "
    "Style: polished children's game environment art, Minecraft-inspired farm shapes and materials, "
    "but cleaner, sharper, brighter, and more premium than a raw voxel screenshot. "
    "This must look like a real playable game screen with clear movement space and low clutter. "
    "This is an empty environment-only background screen, not an illustration with inhabitants. "
    "Absolutely no people, no villagers, no child characters, no hero, no humanoid figures, no faces, no workers, no farmers, no animals, no pets, no monsters, no scarecrow, no statues, no dolls, no signposts, no boards, no hanging signs, no icons, no text, no letters, no numbers, no UI. "
    "Do not place any living creature or character-shaped object anywhere, even tiny in the distance. "
)

SCENES = [
    {
        "id": "farm-wide-07",
        "slot": "07",
        "label": "南侧果园弯道",
        "size": DEFAULT_SIZE,
        "prompt": (
            BASE_STYLE
            + "Scene type: south orchard bend, lower-left screen of a connected farm world. "
            "Composition: a dirt lane curves in from the upper-right and sweeps toward the lower-left edge. "
            "Keep the center and lower-middle readable and open for movement and enemy chasing. "
            "Place orchard trees, low fences, one narrow water edge, flower strips, and one small crop patch only near the outer edges. "
            "Do not block the main route. "
            "No path walkers, no orchard workers, no fence decorations, no signs near the lane. "
            "Bright sunny colors, gameplay-first."
        ),
    },
    {
        "id": "farm-wide-08",
        "slot": "08",
        "label": "南侧花园路口",
        "size": DEFAULT_SIZE,
        "prompt": (
            BASE_STYLE
            + "Scene type: south garden crossroads, lower-middle screen of a connected farm world. "
            "Composition: a broad open grassy play area in the center, with two soft dirt paths meeting near the lower half. "
            "One path comes from upper-left, one from upper-right, and both open toward the bottom edge. "
            "Keep the center 60 percent clear. "
            "Place fenced garden beds, short hedges, tiny bridge corner, and distant shed edge only around the boundaries. "
            "No central marker, no gardener, no child, no decorative doll, no sign near any path. "
            "Readable, bright, calm, and made for movement."
        ),
    },
    {
        "id": "farm-wide-09",
        "slot": "09",
        "label": "农场出口岔道",
        "size": DEFAULT_SIZE,
        "prompt": (
            BASE_STYLE
            + "Scene type: farm exit gate, lower-right final screen of a connected farm world. "
            "Composition: a clear route flows from the upper-left across the scene and exits near the lower-right edge. "
            "Keep the center open and readable. "
            "Place a wooden fence line, gate-like boundary, a small tool hut corner, and tidy crop beds only near far edges. "
            "The scene should suggest progress toward the edge of the farm world without adding story props. "
            "No guard, no villager, no gate sign, no warning sign, no hanging board, no tiny figure near the exit. "
            "Bright, crisp, child-friendly, gameplay-first."
        ),
    },
]


def load_dotenv() -> None:
    env_path = ROOT / ".env"
    if not env_path.exists():
        return
    for raw in env_path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value


def load_token() -> str:
    load_dotenv()
    token = os.environ.get("AGNES_TOKEN", "").strip()
    if token:
        return token
    raise RuntimeError("AGNES_TOKEN is missing")


def sniff_ext(data: bytes) -> str:
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return ".png"
    if data[:3] == b"\xff\xd8\xff":
        return ".jpg"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return ".webp"
    return ".png"


def request_image(token: str, prompt: str, size: str) -> bytes:
    payload = {
        "model": MODEL,
        "prompt": prompt,
        "n": 1,
        "size": size,
    }
    req = urllib.request.Request(
        API_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    last_error = ""
    for attempt in range(1, MAX_RETRY + 2):
        try:
            with urllib.request.urlopen(req, timeout=240) as resp:
                data = json.loads(resp.read().decode("utf-8"))
            first = (data.get("data") or [{}])[0]
            if first.get("b64_json"):
                return base64.b64decode(first["b64_json"])
            if first.get("url"):
                with urllib.request.urlopen(first["url"], timeout=240) as resp:
                    return resp.read()
            raise RuntimeError(f"no image payload: {str(first)[:300]}")
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace")[:400]
            last_error = f"HTTP {exc.code}: {detail}"
            if exc.code in (400, 401, 403):
                break
        except Exception as exc:
            last_error = str(exc)
        if attempt <= MAX_RETRY:
            time.sleep(1.5 * attempt)
    raise RuntimeError(last_error or "Agnes request failed")


def save_outputs(record: dict, image: bytes) -> dict:
    ext = sniff_ext(image)
    REF_DIR.mkdir(parents=True, exist_ok=True)
    BG_DIR.mkdir(parents=True, exist_ok=True)

    ref_path = REF_DIR / f"{record['id']}{ext}"
    bg_path = BG_DIR / f"{record['slot']}{ext}"
    ref_path.write_bytes(image)
    bg_path.write_bytes(image)
    return {
        "ok": True,
        "id": record["id"],
        "slot": record["slot"],
        "label": record["label"],
        "bytes": len(image),
        "reference": str(ref_path.relative_to(PROJECT)),
        "background": str(bg_path.relative_to(PROJECT)),
        "prompt": record["prompt"],
        "size": record["size"],
    }


def generate(record: dict, token: str, force: bool) -> dict:
    existing = next(iter(sorted(BG_DIR.glob(f"{record['slot']}.*"))), None)
    if existing and existing.stat().st_size > 10 * 1024 and not force:
        return {
            "ok": True,
            "status": "skipped-existing",
            "id": record["id"],
            "slot": record["slot"],
            "label": record["label"],
            "file": existing.name,
            "background": str(existing.relative_to(PROJECT)),
            "bytes": existing.stat().st_size,
        }

    image = request_image(token, record["prompt"], record["size"])
    result = save_outputs(record, image)
    result["status"] = "generated"
    result["file"] = f"{record['slot']}{sniff_ext(image)}"
    return result


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--slot", choices=[item["slot"] for item in SCENES], help="single widescreen slot to generate")
    parser.add_argument("--row3", action="store_true", help="generate slots 07-09")
    parser.add_argument("--force", action="store_true", help="regenerate even if outputs exist")
    args = parser.parse_args()

    if not args.slot and not args.row3:
        raise SystemExit("Use --slot <07|08|09> or --row3")

    token = load_token()
    selected = [item for item in SCENES if args.row3 or item["slot"] == args.slot]

    results = []
    for item in selected:
        result = generate(item, token, args.force)
        results.append(result)
        print(f"{result['status']}: {result['file']} ({round(result['bytes'] / 1024, 1)} KB)")

    manifest = {
        "generator": MODEL,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "results": results,
    }
    REF_DIR.mkdir(parents=True, exist_ok=True)
    (REF_DIR / "_row3_result.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
