"""Generate sentence-scene memory images for Minecraft vocabulary cards with Agnes.

The script is resumable: prompts are already stored in each card, generated files
are written locally, and the card is updated only after the image passes validation.
"""

from __future__ import annotations

import argparse
import base64
import io
import json
import re
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
VOCAB_PATH = ROOT / "data" / "learn" / "packs" / "english-mc-hybrid-2026" / "modules" / "minecraft-vocab.json"
KEY_PATH = ROOT / "docs" / "生图" / "生图接口资源key" / "Agnes生图key.md"
ENDPOINT = "https://apihub.agnes-ai.com/v1/images/generations"
MODEL = "agnes-image-2.1-flash"
OUTPUT_ROOT = ROOT / "assets" / "learn" / "english-vocab" / "minecraft-card-backs"
PREFIX = "assets/learn/english-vocab/minecraft-card-backs/"


def read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8-sig"))


def write_json(path: Path, value: Any) -> None:
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def read_key(path: Path) -> str:
    for line in path.read_text(encoding="utf-8").splitlines():
        value = line.strip().strip("\"'")
        if len(value) >= 32 and " " not in value and not value.startswith("#") and "/" not in value:
            return value
    raise RuntimeError(f"No Agnes key found in {path}")


def slug(value: str) -> str:
    value = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return value[:54] or "word"


def valid_image(path: Path) -> bool:
    if not path.exists() or path.stat().st_size < 1024:
        return False
    try:
        with Image.open(path) as image:
            return image.width == 512 and image.height == 512
    except Exception:
        return False


def extract_bytes(value: Any) -> bytes | None:
    if isinstance(value, dict):
        for key in ("b64_json", "image_base64", "result"):
            candidate = value.get(key)
            if isinstance(candidate, str) and len(candidate) > 1000:
                if candidate.startswith("data:") and "," in candidate:
                    candidate = candidate.split(",", 1)[1]
                return base64.b64decode(candidate)
        if isinstance(value.get("url"), str):
            with urllib.request.urlopen(value["url"], timeout=300) as response:
                return response.read()
        for child in value.values():
            result = extract_bytes(child)
            if result:
                return result
    elif isinstance(value, list):
        for child in value:
            result = extract_bytes(child)
            if result:
                return result
    return None


def generate(card: dict[str, Any], api_key: str) -> bytes:
    prompt = str(card.get("backImagePrompt") or "").strip()
    if not prompt:
        raise RuntimeError(f"missing backImagePrompt for {card.get('word')}")
    payload = json.dumps({"model": MODEL, "prompt": prompt, "n": 1, "size": "1024x1024"}).encode("utf-8")
    image = None
    last_error = None
    for attempt in range(1, 4):
        request = urllib.request.Request(
            ENDPOINT,
            data=payload,
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(request, timeout=360) as response:
                image = extract_bytes(json.loads(response.read().decode("utf-8")))
            break
        except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError, json.JSONDecodeError) as error:
            last_error = error
            if isinstance(error, urllib.error.HTTPError) and error.code not in (429, 500, 502, 503, 504):
                raise
            if attempt < 3:
                time.sleep(10 * attempt)
    if not image:
        raise RuntimeError(f"Agnes response contains no image bytes after retries: {last_error}")
    return image


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--limit", type=int, default=1)
    parser.add_argument("--word", default="")
    args = parser.parse_args()
    document = read_json(VOCAB_PATH)
    cards = document.get("cards", [])
    selected = [(index, card) for index, card in enumerate(cards) if args.word.lower() in str(card.get("word", "")).lower()]
    if not selected:
        selected = list(enumerate(cards))
    selected = selected[: max(1, args.limit)]
    api_key = read_key(KEY_PATH) if args.apply else ""
    results = []
    for index, card in selected:
        filename = f"card-{index + 1:04d}-{slug(card.get('word', 'word'))}.png"
        output = OUTPUT_ROOT / filename
        relative = PREFIX + filename
        if valid_image(output):
            results.append({"index": index, "word": card.get("word"), "path": relative, "skipped": True})
            continue
        if not args.apply:
            results.append({"index": index, "word": card.get("word"), "path": relative, "skipped": False})
            continue
        raw = generate(card, api_key)
        with Image.open(io.BytesIO(raw)) as source:
            image = source.convert("RGB").resize((512, 512), Image.Resampling.LANCZOS)
            output.parent.mkdir(parents=True, exist_ok=True)
            image.save(output, "PNG", optimize=True)
        if not valid_image(output):
            raise RuntimeError(f"generated image failed validation: {output}")
        card["backImage"] = relative
        card["backImageSource"] = MODEL
        card["backImageQuality"] = "agnes-sentence-scene-v1"
        results.append({"index": index, "word": card.get("word"), "path": relative, "skipped": False})
    if args.apply:
        document["imagePromptPolicy"]["status"] = "partially-generated"
        document["imagePromptPolicy"]["generatedCount"] = sum(1 for card in cards if card.get("backImage"))
        write_json(VOCAB_PATH, document)
    print(json.dumps({"model": MODEL, "apply": args.apply, "results": results}, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
