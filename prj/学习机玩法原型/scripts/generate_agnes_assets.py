"""Generate learning arcade prototype images with Agnes.

This script reads AGNES_TOKEN from the environment or the repo .env file.
It writes project-local assets and a manifest without storing secrets.
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


ASSETS = [
    {
        "id": "learning-arcade-stage",
        "file": "learning-arcade-stage.png",
        "size": "1792x1024",
        "prompt": (
            "A bright modern children's keyboard learning game stage background for a web app. "
            "Soft 3D clay toy UI style, gentle classroom-playground atmosphere, pastel sky, "
            "subtle block world objects, blank learning cards, star rewards, rounded toy-like props. "
            "Keep the center and lower-middle spacious and calm so HTML cards and buttons can sit on top. "
            "Every card, tile, button, note and board face must be completely blank. "
            "No letters, no numbers, no Chinese characters, no pinyin, no fake writing, no glyphs, no logos, "
            "no characters, no official Minecraft branding, no clutter, no dark mood."
        ),
    },
    {
        "id": "home-card-word-shooter",
        "file": "home-card-word-shooter.png",
        "size": "1024x1024",
        "prompt": (
            "A square game selection card illustration for a children's English typing space shooter. "
            "Cool sci-fi but still friendly for a 6 year old: a small left-side player starfighter fires thin glowing beams "
            "toward several smaller enemy drones approaching from the right, with blank floating target panels above the drones. "
            "Cinematic neon teal, yellow and red accents, clean composition, not cute, not oversized, usable inside a web UI card. "
            "All panels must be completely blank. No readable text, no letters, no numbers, no Chinese characters, no logos, no clutter."
        ),
    },
    {
        "id": "home-card-word-cannon",
        "file": "home-card-word-cannon.png",
        "size": "1024x1024",
        "prompt": (
            "A square game selection card illustration for a pinyin cannon word game. "
            "A compact sci-fi toy cannon sits near the bottom of a circular arena, shooting elegant light trajectories "
            "up toward several small blank target blocks in the upper half. "
            "Beautiful circular radar ring, glassy blue-green arena, gold coin and star reward sparks, balanced spacing, polished web game style. "
            "Every target and panel must be blank. No readable text, no pinyin, no letters, no numbers, no Chinese characters, no logos, no clutter."
        ),
    },
    {
        "id": "home-card-pinyin-snake",
        "file": "home-card-pinyin-snake.png",
        "size": "1024x1024",
        "prompt": (
            "A square game selection card illustration for a pinyin snake keyboard game. "
            "Full-screen style rounded grid board viewed slightly from above, a sleek small snake path curves through the grid, "
            "with colorful dot foods and a few blank floating tile markers. "
            "Fresh arcade look, bright but not childish, clean professional web UI card image, stable readable empty spaces. "
            "All tiles and markers must be blank. No readable text, no pinyin, no letters, no numbers, no Chinese characters, no logos, no clutter."
        ),
    },
]


def repo_root() -> Path:
    return Path(__file__).resolve().parents[3]


def prototype_dir() -> Path:
    return Path(__file__).resolve().parents[1]


def load_dotenv(root: Path) -> None:
    env_path = root / ".env"
    if not env_path.exists():
        return
    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value


def request_json(url: str, token: str, payload: dict) -> dict:
    data = json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(
        url,
        data=data,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=180) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")[:500]
        raise RuntimeError(f"Agnes HTTP {exc.code}: {detail}") from exc


def download(url: str) -> bytes:
    with urllib.request.urlopen(url, timeout=180) as response:
        return response.read()


def generate_asset(asset: dict, token: str, output_dir: Path, force: bool) -> dict:
    output_path = output_dir / asset["file"]
    if output_path.exists() and not force:
        return {
            **asset,
            "bytes": output_path.stat().st_size,
            "status": "skipped-existing",
        }

    payload = {
        "model": MODEL,
        "prompt": asset["prompt"],
        "n": 1,
        "size": asset["size"],
    }
    response = request_json(API_URL, token, payload)
    data = response.get("data") or []
    if not data:
        raise RuntimeError(f"Agnes returned no image data for {asset['id']}: {str(response)[:500]}")

    first = data[0]
    if first.get("url"):
        image_bytes = download(first["url"])
    elif first.get("b64_json"):
        image_bytes = base64.b64decode(first["b64_json"])
    else:
        raise RuntimeError(f"Agnes image data for {asset['id']} has no url or b64_json")

    output_path.write_bytes(image_bytes)
    return {
        **asset,
        "bytes": output_path.stat().st_size,
        "status": "generated",
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--force", action="store_true", help="Regenerate even if files already exist.")
    parser.add_argument("--delay", type=float, default=2.0, help="Seconds between requests.")
    args = parser.parse_args()

    root = repo_root()
    load_dotenv(root)
    token = os.environ.get("AGNES_TOKEN", "").strip()
    if not token:
        raise SystemExit("AGNES_TOKEN is missing. Set it in .env or the environment.")

    output_dir = prototype_dir() / "assets" / "generated"
    output_dir.mkdir(parents=True, exist_ok=True)

    records = []
    for index, asset in enumerate(ASSETS):
        record = generate_asset(asset, token, output_dir, args.force)
        records.append(record)
        print(f"{record['status']}: {record['file']} ({record['bytes']} bytes)")
        if index < len(ASSETS) - 1:
            time.sleep(args.delay)

    manifest = {
        "generator": MODEL,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "assets": records,
    }
    (output_dir / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(f"manifest: {output_dir / 'manifest.json'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
