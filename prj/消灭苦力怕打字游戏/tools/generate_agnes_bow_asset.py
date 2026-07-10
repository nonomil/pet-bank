from __future__ import annotations

import base64
import json
import os
import time
import urllib.error
import urllib.request
from pathlib import Path

from PIL import Image, ImageDraw


PROJECT = Path(__file__).resolve().parents[1]
ROOT = PROJECT.parents[1]
OUT = PROJECT / "assets" / "generated" / "typing-defense-assets"
REFERENCE = PROJECT / "assets" / "generated" / "reference"
MANIFEST = OUT / "manifest.json"
API_URL = "https://apihub.agnes-ai.com/v1/images/generations"
MODEL = "agnes-image-2.1-flash"

PROMPT = """Create one transparent PNG game UI asset: a chunky pixel-art bow launcher inspired by voxel sandbox games, for a children's typing defense web game. The bow sits facing upward, centered, with a wooden curved bow, taut pale string, small arrow notch, soft contact shadow included inside the asset. Cute toy-like, bright but not childish clipart, 2.5D pixel/block style, no readable text, no letters, no numbers, no logo, no character, no background, true transparent alpha channel, generous padding, single complete object."""


def load_token() -> str:
    token = os.environ.get("AGNES_TOKEN", "").strip()
    if token:
        return token
    env_path = ROOT / ".env"
    if env_path.exists():
        for line in env_path.read_text(encoding="utf-8").splitlines():
            if line.startswith("AGNES_TOKEN="):
                return line.split("=", 1)[1].strip().strip('"')
    raise RuntimeError("AGNES_TOKEN not found")


def request_agnes(token: str) -> bytes:
    payload = {
        "model": MODEL,
        "prompt": PROMPT,
        "n": 1,
        "size": "1024x1024",
    }
    request = urllib.request.Request(
        API_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=180) as response:
        data = json.loads(response.read().decode("utf-8"))

    item = data.get("data", [{}])[0]
    if item.get("b64_json"):
        return base64.b64decode(item["b64_json"])
    if item.get("url"):
        with urllib.request.urlopen(item["url"], timeout=120) as response:
            return response.read()
    raise RuntimeError(f"Agnes returned no image payload: {str(data)[:500]}")


def trim_and_fit(image: Image.Image) -> Image.Image:
    rgba = remove_checkerboard(image.convert("RGBA"))
    alpha = rgba.getchannel("A")
    bbox = alpha.getbbox()
    if bbox is None:
        raise RuntimeError("generated image has empty alpha")
    cropped = rgba.crop(bbox)
    cropped.thumbnail((220, 170), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (256, 192), (0, 0, 0, 0))
    x = (canvas.width - cropped.width) // 2
    y = canvas.height - cropped.height - 12
    canvas.alpha_composite(cropped, (x, y))
    draw = ImageDraw.Draw(canvas, "RGBA")
    draw.ellipse((83, 158, 173, 181), fill=(10, 22, 12, 48))
    return canvas


def remove_checkerboard(image: Image.Image) -> Image.Image:
    pixels = image.load()
    for y in range(image.height):
        for x in range(image.width):
            r, g, b, a = pixels[x, y]
            if a == 0:
                continue
            spread = max(r, g, b) - min(r, g, b)
            bright = max(r, g, b)
            if bright > 150 and spread < 32:
                pixels[x, y] = (r, g, b, 0)
            elif bright > 190 and abs(r - g) < 50 and abs(g - b) < 50:
                pixels[x, y] = (r, g, b, 0)
    return image


def fallback_bow() -> Image.Image:
    image = Image.new("RGBA", (256, 192), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    draw.ellipse((72, 151, 184, 178), fill=(12, 24, 12, 62))
    draw.arc((76, 38, 180, 156), 74, 286, fill=(104, 62, 28, 255), width=18)
    draw.arc((91, 50, 165, 146), 72, 288, fill=(151, 93, 42, 255), width=8)
    draw.line((128, 45, 128, 154), fill=(242, 232, 194, 245), width=5)
    draw.rectangle((122, 95, 134, 144), fill=(92, 56, 28, 255))
    draw.polygon([(128, 30), (118, 54), (138, 54)], fill=(214, 225, 225, 255))
    draw.rectangle((124, 53, 132, 101), fill=(91, 58, 30, 255))
    draw.polygon([(111, 112), (128, 100), (145, 112), (128, 120)], fill=(225, 78, 88, 245))
    return image


def update_manifest(asset_path: Path, source: str, error: str | None = None) -> None:
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    rel = "assets/generated/typing-defense-assets/bow_launcher_agnes.png"
    image = Image.open(asset_path).convert("RGBA")
    bbox = image.getchannel("A").getbbox() or (0, 0, 0, 0)
    entry = {
        "name": "bow_launcher_agnes",
        "file": rel,
        "size": [image.width, image.height],
        "bbox": list(bbox),
        "source": source,
    }
    if error:
        entry["note"] = f"Agnes request failed, local fallback used: {error[:180]}"
    assets = [asset for asset in manifest["assets"] if asset.get("name") != "bow_launcher_agnes"]
    assets.append(entry)
    manifest["assets"] = assets
    manifest["agnes"] = {
        "model": MODEL,
        "promptFile": "assets/generated/reference/bow-launcher-agnes-prompt.md",
        "lastRun": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
        "status": "ok" if not error else "fallback",
    }
    MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    REFERENCE.mkdir(parents=True, exist_ok=True)
    prompt_file = REFERENCE / "bow-launcher-agnes-prompt.md"
    prompt_file.write_text(f"# Agnes Bow Launcher Prompt\n\n{PROMPT}\n", encoding="utf-8")
    target = OUT / "bow_launcher_agnes.png"
    raw = REFERENCE / "bow-launcher-agnes-raw.png"

    try:
        if not raw.exists():
            image_bytes = request_agnes(load_token())
            raw.write_bytes(image_bytes)
        image = trim_and_fit(Image.open(raw))
        source = "agnes-image-2.1-flash"
        error = None
    except (RuntimeError, urllib.error.URLError, urllib.error.HTTPError, OSError) as exc:
        image = fallback_bow()
        source = "local-fallback-after-agnes-attempt"
        error = str(exc)

    image.save(target)
    update_manifest(target, source, error)
    print(json.dumps({"path": str(target), "source": source, "error": error}, ensure_ascii=False))


if __name__ == "__main__":
    main()
