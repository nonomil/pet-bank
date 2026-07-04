#!/usr/bin/env python3
"""Generate V2 pet card frame backgrounds via Agnes.

Usage:
    python scripts/generators/gen_card_frames_v2.py --out assets/cards/v2
"""
from __future__ import annotations

import argparse
import base64
import json
import os
import time
import urllib.error
import urllib.request
from pathlib import Path


BASE_URL = "https://apihub.agnes-ai.com/v1"
MODEL = "agnes-image-2.1-flash"
IMG_SIZE = "1024x1024"
MAX_RETRY = 2

PROMPTS = [
    (
        "common",
        "普通卡框底图",
        "storybook collectible pet card background template, warm parchment ivory and sage palette, "
        "soft decorative border, playful botanical corner ornaments, bright portrait area in upper middle, "
        "gentle blank information plate in lower area, child-friendly illustrated trading card mood, "
        "clean negative space for later text overlay, no character, no creature, no text, no letters, no numbers, no icons, no ui",
    ),
    (
        "rare",
        "稀有卡框底图",
        "storybook collectible pet card background template, bright sky blue and pearl gold palette, "
        "light crystal ribbon accents around the border, glowing portrait area in upper middle, "
        "clear lower information plate for later stat overlay, playful premium card look, "
        "clean negative space, no character, no creature, no text, no letters, no numbers, no icons, no ui",
    ),
    (
        "epic",
        "史诗卡框底图",
        "storybook collectible pet card background template, dreamy violet and rose gold palette, "
        "magical crystal flourishes and soft constellation ornament around the border, "
        "radiant portrait area in upper middle, structured lower information plate, premium illustrated fantasy card, "
        "clean negative space for later labels, no character, no creature, no text, no letters, no numbers, no icons, no ui",
    ),
    (
        "legendary",
        "传说卡框底图",
        "storybook collectible pet card background template, sunlit gold amber and warm orange palette, "
        "heroic ornate border with radiant highlights, festive leaf and ribbon motifs, "
        "large luminous portrait area in upper middle, elegant lower information plate for later stats, "
        "high-end child-friendly trading card illustration, clean negative space, no character, no creature, no text, no letters, no numbers, no icons, no ui",
    ),
]


def load_token(env_path: Path) -> str:
    token = os.environ.get("AGNES_TOKEN")
    if token:
        return token
    if not env_path.exists():
        raise RuntimeError(f".env not found: {env_path}")
    for line in env_path.read_text(encoding="utf-8").splitlines():
        if line.startswith("AGNES_TOKEN="):
            return line.split("=", 1)[1].strip().strip('"').strip("'")
    raise RuntimeError("AGNES_TOKEN not found in .env")


def sniff_ext(img_bytes: bytes) -> str:
    if img_bytes.startswith(b"\x89PNG\r\n\x1a\n"):
        return ".png"
    if img_bytes[:3] == b"\xff\xd8\xff":
        return ".jpg"
    if img_bytes[:4] == b"RIFF" and img_bytes[8:12] == b"WEBP":
        return ".webp"
    return ".png"


def gen_one(prompt: str, token: str, timeout: int = 120) -> dict:
    url = f"{BASE_URL}/images/generations"
    body = json.dumps(
        {
            "model": MODEL,
            "prompt": prompt,
            "n": 1,
            "size": IMG_SIZE,
        }
    ).encode()
    req = urllib.request.Request(
        url,
        data=body,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            data = json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        err = e.read().decode(errors="replace")
        return {"ok": False, "error": f"HTTP {e.code}: {err[:300]}"}
    except Exception as e:
        return {"ok": False, "error": str(e)}

    try:
        item = data["data"][0]
        if item.get("b64_json"):
            img_bytes = base64.b64decode(item["b64_json"])
        elif item.get("url"):
            with urllib.request.urlopen(item["url"], timeout=90) as r:
                img_bytes = r.read()
        else:
            return {"ok": False, "error": f"no image data: {str(item)[:200]}"}
    except Exception as e:
        return {"ok": False, "error": f"parse: {e}"}

    return {"ok": True, "img_bytes": img_bytes}


def gen_with_retry(prompt: str, token: str) -> dict:
    last_err = ""
    for attempt in range(1, MAX_RETRY + 2):
        result = gen_one(prompt, token)
        if result["ok"]:
            return result
        last_err = result["error"]
        if last_err.startswith(("HTTP 400", "HTTP 401", "HTTP 403")):
            return {"ok": False, "error": last_err}
        if attempt <= MAX_RETRY:
            time.sleep(1.5 * attempt)
    return {"ok": False, "error": last_err}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", default="assets/cards/v2", help="output directory relative to repo root")
    parser.add_argument("--force", action="store_true", help="regenerate even if output already exists")
    args = parser.parse_args()

    repo_root = Path(__file__).resolve().parents[2]
    env_path = repo_root / ".env"
    out_dir = (repo_root / args.out).resolve() if not Path(args.out).is_absolute() else Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)

    token = load_token(env_path)
    print(f"[env] AGNES_TOKEN loaded (len={len(token)})")
    print(f"[cfg] model={MODEL} size={IMG_SIZE} out={out_dir}")

    results = []
    t_total = time.time()
    for slug, title, prompt in PROMPTS:
        out_path = out_dir / f"frame-{slug}-v2.png"
        if out_path.exists() and out_path.stat().st_size > 10 * 1024 and not args.force:
            size_kb = round(out_path.stat().st_size / 1024, 1)
            print(f"  [skip] {slug} -> {out_path.name} {size_kb}KB")
            results.append({"ok": True, "slug": slug, "title": title, "path": str(out_path), "size_kb": size_kb, "skipped": True})
            continue

        print(f"  [gen ] {slug}: {title}")
        t0 = time.time()
        result = gen_with_retry(prompt, token)
        elapsed = round(time.time() - t0, 1)
        if not result["ok"]:
            print(f"         FAILED ({elapsed}s): {result['error'][:180]}")
            results.append({"ok": False, "slug": slug, "title": title, "error": result["error"], "elapsed": elapsed})
            continue

        img_bytes = result["img_bytes"]
        ext = sniff_ext(img_bytes)
        raw_path = out_dir / f"frame-{slug}-v2{ext}"
        raw_path.write_bytes(img_bytes)
        if raw_path != out_path:
            if out_path.exists():
                out_path.unlink()
            raw_path.replace(out_path)
        size_kb = round(out_path.stat().st_size / 1024, 1)
        print(f"         -> {out_path.name} {size_kb}KB ({elapsed}s)")
        results.append(
            {
                "ok": True,
                "slug": slug,
                "title": title,
                "path": str(out_path),
                "size_kb": size_kb,
                "elapsed": elapsed,
                "prompt": prompt,
            }
        )
        time.sleep(0.4)

    manifest = {
        "model": MODEL,
        "size": IMG_SIZE,
        "results": results,
        "total_elapsed": round(time.time() - t_total, 1),
    }
    (out_dir / "_result.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")

    ok_count = sum(1 for item in results if item["ok"])
    print(f"\n=== Summary ===\nOK: {ok_count}/{len(results)}")
    return 0 if ok_count == len(results) else 1


if __name__ == "__main__":
    raise SystemExit(main())
