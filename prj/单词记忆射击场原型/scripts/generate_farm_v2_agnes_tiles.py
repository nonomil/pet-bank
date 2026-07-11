#!/usr/bin/env python3
"""Generate Farm V2 top-down map tiles via Agnes.

First-pass usage:
    python prj/单词记忆射击场原型/scripts/generate_farm_v2_agnes_tiles.py --tile farm_tile_r2_c2 --force
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
DEFAULT_SIZE = "1536x1536"
MAX_RETRY = 2

ROOT = Path(__file__).resolve().parents[3]
PROJECT = Path(__file__).resolve().parents[1]
OUT_DIR = PROJECT / "assets" / "generated" / "reference" / "farm-v2-agnes"

TILES = [
    {
        "id": "farm_tile_r1_c1_v1",
        "label": "农场入口拐角",
        "size": DEFAULT_SIZE,
        "file": "farm_tile_r1_c1_v1.png",
        "prompt": (
            "Create the upper-left tile of a bright top-down children's farm adventure map. "
            "This tile is the farm entrance corner with a dirt path entering from the right side and curving down slightly, "
            "outer wooden fences along the top and left edges, a small patch of flowers and grass tufts, and one tiny crop patch near a far corner. "
            "Keep the main walking area open and readable. "
            "No characters, no animals, no monsters, no tools, no signs, no text, no logos, no UI. "
            "Polished Minecraft-inspired block farm art, crisp, sunny, child-friendly, game map tile."
        ),
    },
    {
        "id": "farm_tile_r1_c2_v1",
        "label": "菜地十字路",
        "size": DEFAULT_SIZE,
        "file": "farm_tile_r1_c2_v1.png",
        "prompt": (
            "Create the upper-middle tile of a bright top-down children's farm adventure map. "
            "This tile is a path crossroad with neat crop rows and a slim irrigation line or planted border near the outer edge, "
            "while the central crossing remains open for gameplay movement. "
            "Use light wooden fences only at far edges, bright grass, warm path color, and clear top-down readability. "
            "No characters, no animals, no monsters, no scarecrow, no signs, no text, no logos, no UI. "
            "Polished Minecraft-inspired farm tile, crisp and sunny."
        ),
    },
    {
        "id": "farm_tile_r1_c2_v2",
        "label": "菜地十字路-v2",
        "size": DEFAULT_SIZE,
        "file": "farm_tile_r1_c2_v2.png",
        "prompt": (
            "Create the upper-middle tile of a bright top-down children's farm adventure map. "
            "This is a crop-crossroad tile with a clean dirt path crossing through planted fields. "
            "Use neat crop rows near the four outer quadrants, but keep the road crossing readable and open. "
            "Absolutely no person, no villager, no child, no hero, no scarecrow, no statue, no signpost, no marker, no face, no animal, no monster, no text, no letters, no numbers, no logo, no UI. "
            "Outer fences only. Bright sunny polished Minecraft-inspired farm tile, crisp and game-readable."
        ),
    },
    {
        "id": "farm_tile_r1_c3_v1",
        "label": "玻璃温室角",
        "size": DEFAULT_SIZE,
        "file": "farm_tile_r1_c3_v1.png",
        "prompt": (
            "Create the upper-right tile of a bright top-down children's farm adventure map. "
            "This tile features a greenhouse near the upper-right area, with connecting dirt path from left or bottom, "
            "some flowers and small crop details near edges, and enough clear ground for movement. "
            "No center clutter, no people, no animals, no monsters, no text, no logos, no UI. "
            "Bright polished Minecraft-inspired farm map tile, child-friendly and crisp."
        ),
    },
    {
        "id": "farm_tile_r1_c3_v2",
        "label": "玻璃温室角-v2",
        "size": DEFAULT_SIZE,
        "file": "farm_tile_r1_c3_v2.png",
        "prompt": (
            "Create the upper-right tile of a bright top-down children's farm adventure map. "
            "Show one greenhouse near the upper-right side, path connections from left and lower edges, flowers and small crop details near borders, and open ground for movement. "
            "Absolutely no people, no child, no hero, no villager, no scarecrow, no doll, no statue, no animal, no monster, no text, no numbers, no letters, no logo, no UI. "
            "Keep the tile readable, bright, polished, Minecraft-inspired, and suitable for gameplay."
        ),
    },
    {
        "id": "farm_tile_r1_c3_v3",
        "label": "玻璃温室角-v3",
        "size": DEFAULT_SIZE,
        "file": "farm_tile_r1_c3_v3.png",
        "prompt": (
            "Create the upper-right tile of a bright top-down children's farm adventure map as a clean playable map tile, not a scene illustration. "
            "Place a single glass greenhouse anchored tightly into the upper-right corner and partially along the right edge. "
            "A dirt path should enter from the left edge and bend gently toward the lower-right edge, leaving a broad open grass area in the middle-left for movement. "
            "Add only tiny border details: a few flowers, one narrow crop strip, and low wooden fencing on far outer edges. "
            "Absolutely no people, no villagers, no child, no hero, no faces, no statues, no scarecrow, no animals, no sheep, no cows, no chickens, no pets, no monsters, no carts, no tools, no signs, no signposts, no text, no letters, no numbers, no logos, no UI. "
            "Do not place any character-shaped object or decorative figure anywhere. "
            "Bright sunny polished Minecraft-inspired farm art, crisp, readable, open, child-friendly, gameplay-first."
        ),
    },
    {
        "id": "farm_tile_r1_c3_v4",
        "label": "玻璃温室角-v4",
        "size": DEFAULT_SIZE,
        "file": "farm_tile_r1_c3_v4.png",
        "prompt": (
            "Create an empty environment-only upper-right farm map tile for a top-down adventure game. "
            "Show a single clean glass greenhouse attached to the upper-right corner and right border, with no occupants and no nearby decorative props. "
            "A simple dirt path should enter from the left edge and bend toward the lower-right edge. "
            "Leave the middle and lower-left area as open grass for movement. "
            "Only minimal edge decoration is allowed: a few flowers and one small crop strip near borders. "
            "No people, no villagers, no child, no hero, no faces, no statues, no scarecrow, no animals, no sheep, no chickens, no cows, no pets, no monsters, no tools, no carts, no signs, no signposts, no boxes, no text, no letters, no numbers, no logos, no UI. "
            "This is a background map tile only, with zero living creatures and zero character-like objects. "
            "Bright sunny polished Minecraft-inspired environment art, crisp, simple, readable, gameplay-first."
        ),
    },
    {
        "id": "farm_tile_r2_c2",
        "label": "中央草地活动区",
        "size": DEFAULT_SIZE,
        "file": "farm_tile_r2_c2.png",
        "prompt": (
            "Create the center tile of a bright top-down children's farm adventure map. "
            "The scene is the central grass clearing of the farm, designed for gameplay movement. "
            "Keep the center open and readable for a small hero to run around. Around the edges: a curved dirt path connection on at least two sides, "
            "short wooden fences, one small greenhouse visible near an edge but not blocking the center, neat crop rows and flower patches kept mostly near corners, "
            "soft sunny light, vivid green grass, warm wood, clean block-inspired geometry. Minecraft-inspired but polished and storybook-clean. "
            "No characters, no animals, no monsters, no tools in the center, no text, no letters, no numbers, no logos, no UI, no watermark. "
            "High-detail game background tile, crisp and not blurry."
        ),
    },
    {
        "id": "farm_tile_r2_c1_v1",
        "label": "湖边码头替代左中块",
        "size": DEFAULT_SIZE,
        "file": "farm_tile_r2_c1_v1.png",
        "prompt": (
            "Create the middle-left tile of a bright top-down children's farm adventure map. "
            "This tile should feel like a side path near a farm pond or water edge, but keep the water small and pushed to the outer side. "
            "Show a dirt path running through the tile, light wooden fencing on outer edges, a tiny dock or bridge hint near the far-left boundary, "
            "and open walkable grass near the center-right side. "
            "No characters, no animals, no monsters, no text, no logos, no UI. "
            "Polished Minecraft-inspired farm art, crisp, sunny, game-ready."
        ),
    },
    {
        "id": "farm_tile_r2_c2_v2",
        "label": "中央草地活动区-v2",
        "size": DEFAULT_SIZE,
        "file": "farm_tile_r2_c2_v2.png",
        "prompt": (
            "Create the center tile of a bright top-down children's farm adventure map for actual gameplay. "
            "This must be an empty playable farm clearing, not a poster and not a decorated fenced arena. "
            "Keep the middle 55 percent of the tile as open grass and light path space for character movement. "
            "Show curved farm paths entering from top and bottom, with light wooden fences only near the outer edges. "
            "Include one greenhouse near a far corner, small crop beds near corners, and a few flowers as edge decoration, "
            "but do not place any object, fence ring, sign, prop, or character in the middle. "
            "Absolutely no people, no child, no hero, no animals, no monsters, no tools, no carts, no scarecrow, "
            "no readable text, no letters, no numbers, no logos, no UI, no watermark. "
            "Bright sunny farm colors, Minecraft-inspired block geometry, polished and crisp, child-friendly, clean and readable, high-resolution game map tile."
        ),
    },
    {
        "id": "farm_tile_r2_c2_v3",
        "label": "中央草地活动区-v3",
        "size": DEFAULT_SIZE,
        "file": "farm_tile_r2_c2_v3.png",
        "prompt": (
            "Create the center tile of a bright top-down children's farm adventure map for gameplay. "
            "The center must be a wide open grassy clearing for movement, with no fence ring, no enclosed arena, no circular barrier, and no object placed in the middle. "
            "Paths may pass along the top and bottom edges and connect softly into the scene, but the central area must stay open. "
            "Wooden fences are allowed only on the outer boundary edges of the tile, never around the middle. "
            "Put the greenhouse in one upper corner, crop beds in lower corners, and tiny flower patches near edges only. "
            "Absolutely no characters, no animals, no monsters, no tools, no signs, no scarecrow, no carts, no text, no letters, no numbers, no logos, no UI, no watermark. "
            "Bright sunny farm, polished Minecraft-inspired block geometry, crisp, clean, child-friendly, readable as a playable map tile rather than a poster."
        ),
    },
    {
        "id": "farm_tile_r2_c2_v4",
        "label": "中央草地活动区-v4",
        "size": DEFAULT_SIZE,
        "file": "farm_tile_r2_c2_v4.png",
        "prompt": (
            "Create a top-down farm center map tile for a children's game with a large open central lawn. "
            "The middle of the image must stay mostly empty grass, no fence circle, no pen, no corral, no arena, no structure in the middle. "
            "Show only light paths entering from top and left and fading around the open center. "
            "Put farm details only near the boundaries: one greenhouse in the upper-right corner, one small crop bed in the lower-left corner, a second crop bed in the lower-right corner, and sparse flowers along fences. "
            "Fences only on the very outer border, never around the center. "
            "No people, no hero, no villagers, no scarecrow, no animals, no monsters, no tools, no signs, no text, no logos. "
            "Bright sunny, crisp, polished, Minecraft-inspired but cleaner and more elegant, clearly a playable game tile."
        ),
    },
    {
        "id": "farm_tile_r2_c2_v5",
        "label": "中央草地活动区-v5",
        "size": DEFAULT_SIZE,
        "file": "farm_tile_r2_c2_v5.png",
        "prompt": (
            "Create a bright polished top-down children's farm gameplay tile. "
            "Design it like an explorable central plaza of a farm, but made of grass and paths rather than stone. "
            "The center 60 percent of the tile must remain open and free for movement. "
            "Use an asymmetrical layout: path entering from top, another from bottom-right, greenhouse at upper-left edge, crop rows near lower-right, flowers and bushes only near corners, wood fences only at the far outside edges. "
            "Do not create any fence ring, enclosure, courtyard border, or central object. "
            "No characters, no child, no hero, no animals, no scarecrow, no wagon, no tools, no text, no UI, no watermark. "
            "Bright daylight, vivid green, warm wood, crisp game-ready map tile, Minecraft-inspired but refined."
        ),
    },
    {
        "id": "farm_tile_r2_c2_v6",
        "label": "中央草地活动区-v6",
        "size": DEFAULT_SIZE,
        "file": "farm_tile_r2_c2_v6.png",
        "prompt": (
            "Create a clean top-down farm map tile for a children's English learning game. "
            "This is the movement hub tile, so keep the center broad, flat, open, and readable. "
            "No fences across the center, no circular layout, no enclosed ring, no central prop. "
            "Use soft dirt paths skimming the outer half of the tile, outer-edge wooden fences, one glass greenhouse tucked into an upper corner, two tiny crop patches near opposite lower corners, and a few flowers near the outer border. "
            "The image should feel like a real playable map segment, not a farm poster. "
            "No characters, no animals, no monsters, no signs, no scarecrow, no tools, no text, no logos, no UI. "
            "Child-friendly, sunny, crisp, polished block-inspired farm art."
        ),
    },
    {
        "id": "farm_tile_r2_c2_v7",
        "label": "中央草地活动区-v7",
        "size": DEFAULT_SIZE,
        "file": "farm_tile_r2_c2_v7.png",
        "prompt": (
            "Create the center tile of a bright top-down children's farm adventure map for gameplay. "
            "Keep the center mostly open grass with a simple path crossing near the upper and lower edges, not through the center. "
            "No greenhouse in the middle, no fence ring, no bright magical light spot, no central prop, no scarecrow, no sign, no person, no animal, no monster, no text, no logos, no UI. "
            "Small farm details like one greenhouse and crop beds may appear only near corners or far edges. "
            "Bright sunny polished Minecraft-inspired farm tile, readable and clearly made for movement."
        ),
    },
    {
        "id": "farm_tile_r2_c2_v8",
        "label": "中央草地活动区-v8",
        "size": DEFAULT_SIZE,
        "file": "farm_tile_r2_c2_v8.png",
        "prompt": (
            "Create the exact center tile of a bright top-down children's farm adventure map for gameplay movement. "
            "This must look like a clean map segment, not a poster, not a fenced yard, and not a special event area. "
            "Keep the middle 65 percent of the tile as open grass with maybe a very soft worn path edge near the top and bottom only. "
            "No fence ring, no square pen, no corral, no arena, no glowing object, no shrine, no sign, no scarecrow, no crate, no center prop, no building in the center. "
            "Only place farm landmarks near outer edges: one small greenhouse cropped into a far corner, two tiny crop beds near opposite corners, a few flowers near the border, and short fence fragments only at the far boundaries. "
            "Absolutely no people, no villagers, no child, no hero, no faces, no animals, no pets, no monsters, no carts, no tools, no text, no letters, no numbers, no logos, no UI. "
            "The tile should feel open, breathable, bright, sunny, polished, Minecraft-inspired, crisp, and highly readable for a small character to run around."
        ),
    },
    {
        "id": "farm_tile_r2_c2_v9",
        "label": "中央草地活动区-v9",
        "size": DEFAULT_SIZE,
        "file": "farm_tile_r2_c2_v9.png",
        "prompt": (
            "Create an empty environment-only center farm map tile for a top-down adventure game. "
            "Keep the middle 70 percent of the tile as plain open grass with subtle worn ground texture only. "
            "A dirt path may touch the top edge and bottom edge, but must not cross the middle. "
            "Add only tiny map landmarks near the far boundaries: one very small greenhouse cropped into a top-left corner, two tiny crop beds in opposite corners, short fence fragments along the outer border, and a few flowers near edges. "
            "No center object, no fenced square, no pen, no corral, no glowing altar, no shrine, no statue, no sign, no scarecrow, no crate, no well, no prop of any kind in the middle. "
            "No people, no villagers, no child, no hero, no faces, no animals, no pets, no monsters, no tools, no carts, no text, no letters, no numbers, no logos, no UI. "
            "This must be a pure background tile with zero living creatures and zero focal object. "
            "Bright sunny polished Minecraft-inspired environment art, clean, crisp, calm, open, readable for gameplay."
        ),
    },
    {
        "id": "farm_tile_r2_c3_v1",
        "label": "菜园弯道",
        "size": DEFAULT_SIZE,
        "file": "farm_tile_r2_c3_v1.png",
        "prompt": (
            "Create the middle-right tile of a bright top-down children's farm adventure map. "
            "This tile is a curved side path passing by vegetable beds and a small wooden shed or farm storage hint pushed to an edge. "
            "Keep the center-left of the tile open enough for movement, with crop beds, flowers, and fences staying mostly near the boundary. "
            "No characters, no animals, no monsters, no signs, no text, no logos, no UI. "
            "Bright polished Minecraft-inspired farm map tile, crisp and child-friendly."
        ),
    },
    {
        "id": "farm_tile_r3_c1_v1",
        "label": "果树花圃",
        "size": DEFAULT_SIZE,
        "file": "farm_tile_r3_c1_v1.png",
        "prompt": (
            "Create the lower-left tile of a bright top-down children's farm adventure map. "
            "This tile includes a small orchard or fruit-tree corner with flowers and a path connection from top or right, "
            "outer fences, and a clear walkable area crossing part of the tile. "
            "Keep trees near edges and corners, not blocking the main route. "
            "No characters, no animals, no monsters, no signs, no text, no logos, no UI. "
            "Sunny polished Minecraft-inspired farm tile, crisp and game-readable."
        ),
    },
    {
        "id": "farm_tile_r3_c2_v1",
        "label": "草坡跑道",
        "size": DEFAULT_SIZE,
        "file": "farm_tile_r3_c2_v1.png",
        "prompt": (
            "Create the lower-middle tile of a bright top-down children's farm adventure map. "
            "This tile is a gentle grass slope path section with a main dirt road entering upward, "
            "some fence edges and flower clusters, and maybe a straw bale or windmill hint only near the far edge. "
            "The center should remain readable and mostly open for movement. "
            "No characters, no animals, no monsters, no scarecrow, no text, no logos, no UI. "
            "Bright polished Minecraft-inspired farm game tile."
        ),
    },
    {
        "id": "farm_tile_r3_c3_v1",
        "label": "围栏岔口",
        "size": DEFAULT_SIZE,
        "file": "farm_tile_r3_c3_v1.png",
        "prompt": (
            "Create the lower-right tile of a bright top-down children's farm adventure map. "
            "This tile is a fence corner and branching path area with a small storehouse or supply corner near an outer edge, "
            "flowers and grass tufts near the boundaries, and a readable open route through the tile. "
            "Do not clutter the center. "
            "No characters, no animals, no monsters, no signs, no text, no logos, no UI. "
            "Polished Minecraft-inspired farm art, crisp, sunny, child-friendly."
        ),
    }
]

PACKS = {
    "farm-v2-selected": [
        "farm_tile_r1_c1_v1",
        "farm_tile_r1_c2_v2",
        "farm_tile_r1_c3_v3",
        "farm_tile_r2_c1_v1",
        "farm_tile_r2_c2_v8",
        "farm_tile_r2_c3_v1",
        "farm_tile_r3_c1_v1",
        "farm_tile_r3_c2_v1",
        "farm_tile_r3_c3_v1",
    ],
}


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


def request_tile(token: str, prompt: str, size: str) -> bytes:
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
        except Exception as exc:  # pragma: no cover
            last_error = str(exc)
        if attempt <= MAX_RETRY:
            time.sleep(1.5 * attempt)
    raise RuntimeError(last_error or "Agnes request failed")


def generate_one(record: dict, token: str, force: bool) -> dict:
    target_base = OUT_DIR / Path(record["file"]).stem
    existing = next(iter(sorted(OUT_DIR.glob(f"{target_base.name}.*"))), None)
    if existing and existing.stat().st_size > 10 * 1024 and not force:
        return {
            "ok": True,
            "status": "skipped-existing",
            "id": record["id"],
            "label": record["label"],
            "file": existing.name,
            "path": str(existing.relative_to(PROJECT)),
            "bytes": existing.stat().st_size,
            "size": record["size"],
        }

    image = request_tile(token, record["prompt"], record["size"])
    ext = sniff_ext(image)
    out_path = OUT_DIR / f"{record['id']}{ext}"
    out_path.write_bytes(image)
    return {
        "ok": True,
        "status": "generated",
        "id": record["id"],
        "label": record["label"],
        "file": out_path.name,
        "path": str(out_path.relative_to(PROJECT)),
        "bytes": len(image),
        "size": record["size"],
        "prompt": record["prompt"],
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--tile", help="tile id to generate")
    parser.add_argument("--all", action="store_true", help="generate all known tiles")
    parser.add_argument("--pack", choices=sorted(PACKS.keys()), help="generate a predefined tile pack")
    parser.add_argument("--force", action="store_true", help="regenerate even if output exists")
    args = parser.parse_args()

    if not args.tile and not args.all and not args.pack:
        raise SystemExit("Use --tile <id>, --pack <name>, or --all")

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    token = load_token()
    if args.all:
        selected = TILES
    elif args.pack:
        wanted = set(PACKS[args.pack])
        selected = [item for item in TILES if item["id"] in wanted]
    else:
        selected = [item for item in TILES if item["id"] == args.tile]
    if not selected:
        raise SystemExit(f"Unknown tile or empty pack: {args.tile or args.pack}")

    results = []
    for item in selected:
        result = generate_one(item, token, args.force)
        results.append(result)
        print(f"{result['status']}: {result['file']} ({round(result['bytes'] / 1024, 1)} KB)")

    manifest = {
        "generator": MODEL,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "results": results,
    }
    (OUT_DIR / "_result.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
