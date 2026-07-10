#!/usr/bin/env python3
"""Generate sci-fi word-cannon stage backgrounds via Agnes."""
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
IMG_SIZE = "1536x1024"
MAX_RETRY = 2

PROMPTS = [
    (
        "map-metal-corridor",
        "金属走廊",
        "cinematic sci-fi side arena background for a children's typing cannon web game, sleek metallic corridor, "
        "warm gold guide lights on the floor, dark steel wall panels, subtle hologram lane marks in the center, "
        "clear open vertical combat lane, readable negative space for small falling targets, polished arcade style, "
        "cool and official, not cute, not crowded, no characters, no cannon, no words, no text, no watermark, no UI",
    ),
    (
        "map-space-hangar",
        "太空机库",
        "cinematic sci-fi arena background for a typing cannon game, futuristic space hangar with distant ships and docking arms, "
        "soft blue rim lights, amber runway strips, deep perspective center lane, smoky depth, high-tech but clean composition, "
        "room for gameplay elements in the middle, polished web game background, not cute, no characters, no labels, no text, no watermark, no UI",
    ),
    (
        "map-future-training",
        "未来训练场",
        "futuristic training arena background for a sci-fi word cannon game, modular simulation chamber, teal holographic target rails, "
        "glowing floor rings, brushed alloy surfaces, balanced contrast, wide clean center area for gameplay, premium arcade look, "
        "not crowded, not cute, no characters, no cannon, no readable text, no watermark, no UI",
    ),
    (
        "map-forge-industrial",
        "熔炉工业区",
        "high-energy industrial sci-fi arena background for a typing cannon game, molten forge facility, orange furnace glow, "
        "heavy steel platforms, vapor haze, ember reflections, clear vertical central lane and readable foreground floor, "
        "stylized but polished, official arcade feel, not cute, no characters, no cannon, no text, no watermark, no UI",
    ),
]


def load_token(env_path: Path) -> str:
    token = os.environ.get("AGNES_TOKEN")
    if token:
        return token
    if env_path.exists():
        for line in env_path.read_text(encoding="utf-8").splitlines():
            if line.startswith("AGNES_TOKEN="):
                return line.split("=", 1)[1].strip().strip('"').strip("'")
    raise RuntimeError("AGNES_TOKEN not found in environment or .env")


def sniff_ext(img_bytes: bytes) -> str:
    if img_bytes.startswith(b"\x89PNG\r\n\x1a\n"):
        return ".png"
    if img_bytes[:3] == b"\xff\xd8\xff":
        return ".jpg"
    if img_bytes[:4] == b"RIFF" and img_bytes[8:12] == b"WEBP":
        return ".webp"
    return ".png"


def gen_one(prompt: str, token: str, timeout: int = 120) -> dict:
    req = urllib.request.Request(
        f"{BASE_URL}/images/generations",
        data=json.dumps({
            "model": MODEL,
            "prompt": prompt,
            "n": 1,
            "size": IMG_SIZE,
        }).encode(),
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            data = json.loads(resp.read().decode())
    except urllib.error.HTTPError as exc:
        err = exc.read().decode(errors="replace")
        return {"ok": False, "error": f"HTTP {exc.code}: {err[:300]}"}
    except Exception as exc:  # pragma: no cover
        return {"ok": False, "error": str(exc)}

    try:
        item = data["data"][0]
        if item.get("b64_json"):
            img_bytes = base64.b64decode(item["b64_json"])
        elif item.get("url"):
            with urllib.request.urlopen(item["url"], timeout=90) as resp:
                img_bytes = resp.read()
        else:
            return {"ok": False, "error": f"no image data: {str(item)[:200]}"}
    except Exception as exc:  # pragma: no cover
        return {"ok": False, "error": f"parse: {exc}"}

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
    parser.add_argument(
        "--out",
        default="assets/generated/word-cannon-maps",
        help="output directory relative to the prototype root",
    )
    parser.add_argument("--force", action="store_true", help="regenerate even if output already exists")
    args = parser.parse_args()

    prototype_root = Path(__file__).resolve().parents[1]
    repo_root = prototype_root.parents[1]
    env_path = repo_root / ".env"
    out_dir = (prototype_root / args.out).resolve() if not Path(args.out).is_absolute() else Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)

    token = load_token(env_path)
    print(f"[env] AGNES_TOKEN loaded (len={len(token)})")
    print(f"[cfg] model={MODEL} size={IMG_SIZE} out={out_dir}")

    results = []
    started_at = time.time()
    for slug, title, prompt in PROMPTS:
        existing = next(iter(sorted(out_dir.glob(f"{slug}.*"))), None)
        if existing and existing.stat().st_size > 10 * 1024 and not args.force:
            size_kb = round(existing.stat().st_size / 1024, 1)
            print(f"  [skip] {slug} -> {existing.name} {size_kb}KB")
            results.append({
                "ok": True,
                "slug": slug,
                "title": title,
                "path": str(existing),
                "size_kb": size_kb,
                "skipped": True,
            })
            continue

        print(f"  [gen ] {slug}: {title}")
        step_start = time.time()
        result = gen_with_retry(prompt, token)
        elapsed = round(time.time() - step_start, 1)
        if not result["ok"]:
            print(f"         FAILED ({elapsed}s): {result['error'][:180]}")
            results.append({
                "ok": False,
                "slug": slug,
                "title": title,
                "error": result["error"],
                "elapsed": elapsed,
                "prompt": prompt,
            })
            continue

        img_bytes = result["img_bytes"]
        out_path = out_dir / f"{slug}{sniff_ext(img_bytes)}"
        out_path.write_bytes(img_bytes)
        size_kb = round(len(img_bytes) / 1024, 1)
        print(f"         -> {out_path.name} {size_kb}KB ({elapsed}s)")
        results.append({
            "ok": True,
            "slug": slug,
            "title": title,
            "path": str(out_path),
            "size_kb": size_kb,
            "elapsed": elapsed,
            "prompt": prompt,
        })
        time.sleep(0.4)

    manifest = {
        "model": MODEL,
        "size": IMG_SIZE,
        "results": results,
        "total_elapsed": round(time.time() - started_at, 1),
    }
    (out_dir / "_result.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")

    ok_count = sum(1 for item in results if item["ok"])
    print(f"\n=== Summary ===\nOK: {ok_count}/{len(results)}")
    return 0 if ok_count == len(results) else 1


if __name__ == "__main__":
    raise SystemExit(main())
