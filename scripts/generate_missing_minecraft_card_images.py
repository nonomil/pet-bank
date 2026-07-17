"""Generate and attach missing Minecraft vocabulary card images.

The generator only targets cards without a valid local image. Generated
artwork is deliberately text-free so learner-facing labels stay in HTML.
"""

from __future__ import annotations

import argparse
import base64
import concurrent.futures
import io
import json
import re
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
VOCAB_PATH = ROOT / "data" / "learn" / "packs" / "english-mc-hybrid-2026" / "modules" / "minecraft-vocab.json"
CARD_ROOT = ROOT / "assets" / "learn" / "english-vocab" / "minecraft-cards"
MANIFEST_PATH = CARD_ROOT / "manifest.json"
KEY_PATH = ROOT / "docs" / "生图" / "生图接口资源key" / "TOKEN24.md"
ENDPOINT = "https://tokenx24.com/v1/images/generations"
MODEL = "gpt-image-2"


def read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8-sig"))


def write_json(path: Path, value: Any) -> None:
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def key() -> str:
    text = KEY_PATH.read_text(encoding="utf-8")
    patterns = (
        r'"OPENAI_API_KEY"\s*:\s*"([^"]+)"',
        r"OPENAI_API_KEY\s*=\s*[\"']([^\"']+)[\"']",
    )
    for pattern in patterns:
        match = re.search(pattern, text)
        if match:
            return match.group(1)
    raise RuntimeError(f"OPENAI_API_KEY not found in {KEY_PATH}")


def read_key(path: Path) -> str:
    text = path.read_text(encoding="utf-8")
    patterns = (
        r'"OPENAI_API_KEY"\s*:\s*"([^"]+)"',
        r"OPENAI_API_KEY\s*=\s*[\"']([^\"']+)[\"']",
    )
    for pattern in patterns:
        match = re.search(pattern, text)
        if match:
            return match.group(1)
    for line in text.splitlines():
        value = line.strip().strip("\"'")
        if len(value) >= 32 and " " not in value and not value.startswith("#") and "/" not in value:
            return value
    raise RuntimeError(f"No image API key found in {path}")


def slug(value: str) -> str:
    value = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return value[:48] or "word"


def local_path(relative: str) -> Path:
    return ROOT / Path(relative.replace("/", "/"))


def valid_image(path: Path) -> bool:
    if not path.exists():
        return False
    try:
        with Image.open(path) as image:
            image.verify()
        return True
    except Exception:
        return False


def extract_bytes(value: Any) -> bytes | None:
    if isinstance(value, dict):
        for name in ("b64_json", "image_base64"):
            candidate = value.get(name)
            if isinstance(candidate, str) and len(candidate) > 1000:
                if candidate.startswith("data:") and "," in candidate:
                    candidate = candidate.split(",", 1)[1]
                return base64.b64decode(candidate)
        url = value.get("url")
        if isinstance(url, str) and url.startswith(("http://", "https://")):
            with urllib.request.urlopen(url, timeout=300) as response:
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


def prompt_for(card: dict[str, Any]) -> str:
    word = str(card.get("word") or "Minecraft vocabulary").strip()
    category = str(card.get("category") or "Minecraft item").strip()
    translation = str(card.get("translation") or "").strip()
    if word.lower() == "hardcore heart":
        return (
            "A single centered voxel pixel-art red health heart icon for a Minecraft-style educational flashcard. "
            "Bright red heart with a small dark-red shadow, clean square silhouette, isolated on a soft warm cream background, "
            "subtle ground shadow, no text, no letters, no logos, no UI, no watermark, square composition."
        )
    return (
        f"A single centered Minecraft-inspired voxel pixel-art object representing the English vocabulary word '{word}' "
        f"({translation}), category: {category}. Clean educational flashcard asset, bright natural colors, "
        "one clear subject only, front three-quarter view, isolated on a soft warm cream background, subtle ground shadow, "
        "consistent game-like block geometry, no text, no letters, no logos, no UI, no watermark, square composition."
    )


def generate_one(item: tuple[int, dict[str, Any]], api_key: str, endpoint: str, model: str) -> dict[str, Any]:
    index, card = item
    word = str(card.get("word") or "Minecraft vocabulary").strip()
    filename = f"card-generated-{index + 1:04d}-{slug(word)}.png"
    output = CARD_ROOT / filename
    if valid_image(output):
        return {"index": index, "card": card, "path": output, "bytes": output.stat().st_size, "skipped": True}
    payload = json.dumps({
        "model": model,
        "prompt": prompt_for(card),
        "n": 1,
        "size": "1024x1024",
        "quality": "medium",
    }).encode("utf-8")
    data = None
    last_error = None
    for attempt in range(3):
        request = urllib.request.Request(
            endpoint,
            data=payload,
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json", "Accept": "application/json"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(request, timeout=360) as response:
                data = json.loads(response.read().decode("utf-8"))
            break
        except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError, json.JSONDecodeError) as error:
            last_error = error
            if isinstance(error, urllib.error.HTTPError) and error.code not in (429, 500, 502, 503, 504):
                raise
            if attempt < 2:
                import time
                time.sleep(8 * (attempt + 1))
    if data is None:
        raise RuntimeError(f"image API failed after retries: {last_error}")
    image_bytes = extract_bytes(data)
    if not image_bytes:
        raise RuntimeError("image response contains no image bytes")
    with Image.open(io.BytesIO(image_bytes)) as source:
        image = source.convert("RGB").resize((512, 512), Image.Resampling.LANCZOS)
        output.parent.mkdir(parents=True, exist_ok=True)
        image.save(output, "PNG", optimize=True)
    if not valid_image(output):
        raise RuntimeError(f"generated image failed validation: {output}")
    return {"index": index, "card": card, "path": output, "bytes": output.stat().st_size, "skipped": False}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--limit", type=int, default=0)
    parser.add_argument("--concurrency", type=int, default=2)
    parser.add_argument("--provider", choices=("token24", "agnes"), default="token24")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    vocab = read_json(VOCAB_PATH)
    missing = []
    for index, card in enumerate(vocab.get("cards", [])):
        image = str(card.get("image") or "")
        if not image or not valid_image(local_path(image)):
            missing.append((index, card))
    provider = args.provider
    endpoint = ENDPOINT if provider == "token24" else "https://apihub.agnes-ai.com/v1/images/generations"
    model = MODEL if provider == "token24" else "agnes-image-2.1-flash"
    key_path = KEY_PATH if provider == "token24" else ROOT / "docs" / "生图" / "生图接口资源key" / "Agnes生图key.md"
    plan = {"totalCards": len(vocab.get("cards", [])), "missingImages": len(missing), "model": model, "provider": provider, "cards": [card.get("word", "") for _, card in missing]}
    if args.dry_run or not args.apply:
        print(json.dumps(plan, ensure_ascii=False, indent=2))
        return 0
    if args.limit < 0 or args.concurrency < 1:
        raise SystemExit("--limit must be >= 0 and --concurrency must be >= 1")
    selected = missing[: args.limit] if args.limit else missing
    api_key = read_key(key_path)
    results = []
    failures = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=args.concurrency) as executor:
        futures = {executor.submit(generate_one, item, api_key, endpoint, model): item for item in selected}
        for future in concurrent.futures.as_completed(futures):
            index, card = futures[future]
            try:
                result = future.result()
                results.append(result)
                print(f"OK {index + 1} {card.get('word', '')}", flush=True)
            except Exception as error:
                failures.append({"index": index, "word": card.get("word", ""), "error": str(error)})
                print(f"FAIL {index + 1} {card.get('word', '')}: {error}", flush=True)
    complete = not failures and len(results) == len(missing)
    if complete:
        for result in results:
            index = result["index"]
            card = vocab["cards"][index]
            relative = str(result["path"].relative_to(ROOT)).replace("\\", "/")
            card["image"] = relative
            card["imageSource"] = model
            card["imageSourceQuality"] = "generated-missing-card-v1"
        write_json(VOCAB_PATH, vocab)
        manifest = read_json(MANIFEST_PATH)
        existing = {str(item.get("path")): item for item in manifest.get("assets", [])}
        for result in results:
            index = result["index"]
            card = vocab["cards"][index]
            relative = str(result["path"].relative_to(ROOT)).replace("\\", "/")
            existing[relative] = {
                "id": card.get("id") or f"card-{index + 1:04d}",
                "word": card.get("word", ""),
                "source": model,
                "sourceQuality": "generated-missing-card-v1",
                "path": relative,
                "dimensions": [512, 512],
                "presentation": "square-raster",
            }
        manifest["assets"] = sorted(existing.values(), key=lambda item: item.get("path", ""))
        manifest["updatedAt"] = datetime.now(timezone.utc).isoformat()
        manifest["generationPolicy"] = f"Missing card images use text-free {model} voxel artwork through {provider}; learner text remains in HTML."
        write_json(MANIFEST_PATH, manifest)
    print(json.dumps({"status": "complete" if complete else "partial", "generated": len(results), "failures": failures, "model": model, "provider": provider}, ensure_ascii=False))
    return 0 if complete else 2


if __name__ == "__main__":
    raise SystemExit(main())
