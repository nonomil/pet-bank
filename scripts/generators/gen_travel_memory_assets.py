#!/usr/bin/env python3
"""Generate simple travel-memory assets through the project Agnes image key.

The key is read in-process from the user-provided key file and is never written
to output, prompts, manifests, or logs.
"""
from __future__ import annotations

import argparse
import base64
import json
import time
import urllib.error
import urllib.request
from pathlib import Path


BASE_URL = "https://apihub.agnes-ai.com/v1/images/generations"
MODEL = "agnes-image-2.1-flash"
SIZE = "1024x1024"
KEY_FILE = Path("docs/GPT生图/Agnes生图key.md")

ASSETS = [
    (
        "badges/forest-badge",
        "森林旅行纪念徽章",
        "A single glowing mushroom and small leaf trail keepsake badge for a children's pet adventure. "
        "Bright soft 3D toy illustration, friendly rounded silhouette, warm red mushroom cap, fresh green leaf, "
        "small golden sparkles, centered isolated object, generous padding. Perfectly flat solid #00ff00 chroma-key "
        "background only; no shadows outside the object; no text, letters, numbers, Chinese characters, pinyin, logo, watermark, UI.",
    ),
    (
        "badges/beach-badge",
        "海滩旅行纪念徽章",
        "A single friendly seashell with a tiny blue wave and beach bottle keepsake badge for a children's pet adventure. "
        "Bright soft 3D toy illustration, clear rounded silhouette, pearl shell, turquoise wave, tiny warm sparkle, "
        "centered isolated object, generous padding. Perfectly flat solid #00ff00 chroma-key background only; "
        "no shadows outside the object; no text, letters, numbers, Chinese characters, pinyin, logo, watermark, UI.",
    ),
    (
        "badges/stargarden-badge",
        "星光花园旅行纪念徽章",
        "A single glowing star flower with a tiny crescent moon keepsake badge for a children's pet adventure. "
        "Bright soft 3D toy illustration, deep blue violet and golden yellow accents, friendly rounded silhouette, "
        "centered isolated object, generous padding. Perfectly flat solid #00ff00 chroma-key background only; "
        "no shadows outside the object; no text, letters, numbers, Chinese characters, pinyin, logo, watermark, UI.",
    ),
    (
        "fridge-magnets/forest-mushroom-magnet",
        "森林蘑菇冰箱贴",
        "A single cute glowing mushroom refrigerator magnet, thick white sticker edge and tiny attached magnet thickness, "
        "bright soft 3D toy style for children, clean readable silhouette, centered isolated object, generous padding. "
        "Perfectly flat solid #00ff00 chroma-key background only; no cast shadow outside the sticker; no text, letters, "
        "numbers, Chinese characters, pinyin, logo, watermark, UI.",
    ),
    (
        "fridge-magnets/beach-shell-magnet",
        "海滩贝壳冰箱贴",
        "A single cute seashell refrigerator magnet, thick white sticker edge and tiny attached magnet thickness, "
        "bright soft 3D toy style for children, clean readable silhouette, pearl shell with a small wave accent, "
        "centered isolated object, generous padding. Perfectly flat solid #00ff00 chroma-key background only; "
        "no cast shadow outside the sticker; no text, letters, numbers, Chinese characters, pinyin, logo, watermark, UI.",
    ),
    (
        "fridge-magnets/stargarden-star-magnet",
        "星花冰箱贴",
        "A single cute star flower refrigerator magnet, thick white sticker edge and tiny attached magnet thickness, "
        "bright soft 3D toy style for children, deep blue violet and golden yellow accents, clear rounded silhouette, "
        "centered isolated object, generous padding. Perfectly flat solid #00ff00 chroma-key background only; "
        "no cast shadow outside the sticker; no text, letters, numbers, Chinese characters, pinyin, logo, watermark, UI.",
    ),
    (
        "cards/forest-card-bg",
        "森林旅行纪念卡底图",
        "A clean horizontal collectible card background, glowing mushroom forest trail, soft green and warm red palette, "
        "simple large shapes, open calm center area for later labels, storybook 3D toy illustration, no character, no readable text, no letters, no numbers, no Chinese characters, "
        "no pinyin, no logo, no watermark, no UI.",
    ),
    (
        "cards/beach-card-bg",
        "海滩旅行纪念卡底图",
        "A clean horizontal collectible card background, friendly blue beach with seashells and small waves, turquoise and pearl palette, "
        "simple large shapes, open calm center area for later labels, storybook 3D toy illustration, no character, no readable text, no letters, no numbers, no Chinese characters, "
        "no pinyin, no logo, no watermark, no UI.",
    ),
    (
        "cards/stargarden-card-bg",
        "星光花园旅行纪念卡底图",
        "A clean horizontal collectible card background, dreamy star flower garden with tiny crescent moon, deep blue violet and golden yellow palette, "
        "simple large shapes, open calm center area for later labels, storybook 3D toy illustration, no character, no readable text, no letters, no numbers, no Chinese characters, "
        "no pinyin, no logo, no watermark, no UI.",
    ),
    (
        "pet-cards/pet-travel-card-frame",
        "宠物旅行卡牌统一卡框",
        "A clean vertical collectible pet travel card frame, soft rounded border, gentle gradient panels and small decorative "
        "stars and leaves around the edge, large blank portrait opening and blank lower information area for HTML overlay, "
        "bright child-friendly 3D toy illustration, no character, no readable text, no letters, no numbers, no Chinese characters, "
        "no pinyin, no logo, no watermark, no UI.",
    ),
]


def read_token(path: Path) -> str:
    for line in path.read_text(encoding="utf-8").splitlines():
        value = line.strip()
        if value.startswith("sk-"):
            return value
    raise RuntimeError("Agnes key file does not contain a supported token")


def sniff_ext(data: bytes) -> str:
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return ".png"
    if data[:3] == b"\xff\xd8\xff":
        return ".jpg"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return ".webp"
    raise RuntimeError("Agnes returned an unsupported image format")


def request_image(prompt: str, token: str) -> tuple[bytes, dict]:
    body = json.dumps({"model": MODEL, "prompt": prompt, "n": 1, "size": SIZE}).encode("utf-8")
    request = urllib.request.Request(
        BASE_URL,
        data=body,
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=180) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")[:300]
        raise RuntimeError(f"HTTP {error.code}: {detail}") from error
    items = payload.get("data") or []
    if not items:
        raise RuntimeError("Agnes response contained no image data")
    item = items[0]
    if item.get("b64_json"):
        image = base64.b64decode(item["b64_json"])
    elif item.get("url"):
        with urllib.request.urlopen(item["url"], timeout=180) as response:
            image = response.read()
    else:
        raise RuntimeError("Agnes response contained neither url nor b64_json")
    metadata = {"responseKeys": sorted(item.keys()), "hasRevisedPrompt": bool(item.get("revised_prompt"))}
    return image, metadata


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", default="assets/generated/travel-memory")
    parser.add_argument("--key-file", default=str(KEY_FILE))
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()

    repo = Path(__file__).resolve().parents[2]
    out = Path(args.out)
    if not out.is_absolute():
        out = repo / out
    out.mkdir(parents=True, exist_ok=True)
    prompt_dir = out / "reference"
    prompt_dir.mkdir(parents=True, exist_ok=True)
    token = read_token(repo / args.key_file if not Path(args.key_file).is_absolute() else Path(args.key_file))

    results = []
    for relative, title, prompt in ASSETS:
        prompt_path = prompt_dir / (Path(relative).name + ".prompt.txt")
        prompt_path.write_text(prompt + "\n", encoding="utf-8")
        target = out / f"{relative}.png"
        target.parent.mkdir(parents=True, exist_ok=True)
        if target.exists() and not args.force:
            results.append({"name": relative, "title": title, "status": "skipped", "file": target.relative_to(repo).as_posix()})
            continue
        try:
            image, metadata = request_image(prompt, token)
            ext = sniff_ext(image)
            if ext != ".png":
                target = target.with_suffix(ext)
            target.write_bytes(image)
            results.append({"name": relative, "title": title, "status": "raw", "file": target.relative_to(repo).as_posix(), **metadata})
            print(f"generated {relative} ({len(image)} bytes)")
        except Exception as error:
            results.append({"name": relative, "title": title, "status": "failed", "error": str(error)[:300]})
            print(f"failed {relative}: {str(error)[:180]}")
        time.sleep(0.5)

    (out / "generation-result.json").write_text(json.dumps({"model": MODEL, "size": SIZE, "source": "Agnes", "results": results}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    failed = [item for item in results if item["status"] == "failed"]
    print(f"summary {len(results) - len(failed)}/{len(results)} generated-or-skipped")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
