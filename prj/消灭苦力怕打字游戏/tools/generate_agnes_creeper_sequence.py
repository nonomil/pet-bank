from __future__ import annotations

import base64
import json
import os
import time
import urllib.error
import urllib.request
from pathlib import Path

from PIL import Image, ImageEnhance, ImageFilter


PROJECT = Path(__file__).resolve().parents[1]
ROOT = PROJECT.parents[1]
OUT = PROJECT / "assets" / "generated" / "typing-defense-assets"
REFERENCE = PROJECT / "assets" / "generated" / "reference"
SOURCE = PROJECT / "assets" / "source-project"
MANIFEST = OUT / "manifest.json"
API_URL = "https://apihub.agnes-ai.com/v1/images/generations"
MODEL = "agnes-image-2.1-flash"

STYLE = (
    "transparent PNG, true alpha, no checkerboard, no background, no text, no letters, "
    "chunky voxel sandbox game style, cute but still threatening, children's typing defense game, "
    "large readable silhouette, soft toy-like lighting, complete body, contact shadow inside the asset"
)

PROMPTS = {
    "creeper_generated_far": f"Small far-away green block monster, four little legs, front view, {STYLE}.",
    "creeper_generated_mid": f"Medium distance green block monster walking forward, four legs stepping, front view, {STYLE}.",
    "creeper_generated_near": f"Large close green block monster looming toward the camera, four legs, front view, {STYLE}.",
    "creeper_generated_danger": f"Large close green block monster glowing orange red as if about to explode, warning eyes, front view, {STYLE}.",
    "creeper_explosion_0": f"Voxel game explosion first frame, bright white yellow flash with green block fragments, no monster body, {STYLE}.",
    "creeper_explosion_1": f"Voxel game explosion second frame, orange yellow blast ring with many cube fragments, no monster body, {STYLE}.",
    "creeper_explosion_2": f"Voxel game explosion smoke final frame, fading dark smoke with scattered green cubes, no monster body, {STYLE}.",
}


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


def request_agnes(token: str, prompt: str) -> bytes:
    request = urllib.request.Request(
        API_URL,
        data=json.dumps({"model": MODEL, "prompt": prompt, "n": 1, "size": "1024x1024"}).encode("utf-8"),
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
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


def remove_light_background(image: Image.Image) -> Image.Image:
    rgba = image.convert("RGBA")
    pixels = rgba.load()
    for y in range(rgba.height):
        for x in range(rgba.width):
            r, g, b, a = pixels[x, y]
            if a == 0:
                continue
            spread = max(r, g, b) - min(r, g, b)
            bright = max(r, g, b)
            if bright > 168 and spread < 38:
                pixels[x, y] = (r, g, b, 0)
            elif bright > 206 and abs(r - g) < 58 and abs(g - b) < 58:
                pixels[x, y] = (r, g, b, 0)
    return rgba


def fit_asset(image: Image.Image, size: tuple[int, int], pad: int = 22) -> Image.Image:
    rgba = remove_light_background(image)
    alpha = rgba.getchannel("A")
    bbox = alpha.getbbox()
    if bbox is None:
        raise RuntimeError("empty alpha after background removal")
    left, top, right, bottom = bbox
    crop = rgba.crop((max(0, left - pad), max(0, top - pad), min(rgba.width, right + pad), min(rgba.height, bottom + pad)))
    crop.thumbnail((size[0] - 24, size[1] - 24), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", size, (0, 0, 0, 0))
    x = (size[0] - crop.width) // 2
    y = size[1] - crop.height - 8
    canvas.alpha_composite(crop, (x, y))
    return canvas


def fallback_asset(name: str) -> Image.Image:
    if name.startswith("creeper_explosion"):
        base = Image.open(OUT / "impact_flash.png").convert("RGBA").resize((360, 360), Image.Resampling.LANCZOS)
        if name.endswith("_1"):
            base = ImageEnhance.Color(base).enhance(1.4)
        if name.endswith("_2"):
            base = ImageEnhance.Brightness(base.filter(ImageFilter.GaussianBlur(2))).enhance(0.75)
        return base

    source_name = "mc_creeper_attack.webp" if name.endswith("danger") or name.endswith("near") else "mc_creeper_idle.webp"
    image = Image.open(SOURCE / source_name).convert("RGBA")
    if name.endswith("danger"):
        red = Image.new("RGBA", image.size, (255, 82, 34, 0))
        red.putalpha(image.getchannel("A").point(lambda value: int(value * 0.48)))
        image.alpha_composite(red)
    return fit_asset(image, (360, 420))


def write_manifest(generated: list[dict], errors: dict[str, str]) -> None:
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    names = {item["name"] for item in generated}
    manifest["assets"] = [asset for asset in manifest["assets"] if asset.get("name") not in names]
    manifest["assets"].extend(generated)
    manifest["agnesCreeperSequence"] = {
        "model": MODEL,
        "promptFile": "assets/generated/reference/creeper-sequence-agnes-prompts.md",
        "lastRun": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
        "status": "ok" if not errors else "partial-fallback",
        "errors": errors,
    }
    MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    REFERENCE.mkdir(parents=True, exist_ok=True)
    prompt_file = REFERENCE / "creeper-sequence-agnes-prompts.md"
    prompt_file.write_text("\n\n".join(f"## {name}\n{prompt}" for name, prompt in PROMPTS.items()), encoding="utf-8")

    token = None
    generated: list[dict] = []
    errors: dict[str, str] = {}

    for name, prompt in PROMPTS.items():
        raw_path = REFERENCE / f"{name}-raw.png"
        out_path = OUT / f"{name}.png"
        try:
            if not raw_path.exists():
                token = token or load_token()
                raw_path.write_bytes(request_agnes(token, prompt))
            size = (420, 420) if name.startswith("creeper_explosion") else (360, 420)
            image = fit_asset(Image.open(raw_path), size)
            source = MODEL
        except (RuntimeError, urllib.error.URLError, urllib.error.HTTPError, OSError) as exc:
            image = fallback_asset(name)
            source = "local-fallback-after-agnes-attempt"
            errors[name] = str(exc)[:240]

        image.save(out_path)
        bbox = image.getchannel("A").getbbox() or (0, 0, 0, 0)
        generated.append(
            {
                "name": name,
                "file": f"assets/generated/typing-defense-assets/{name}.png",
                "size": [image.width, image.height],
                "bbox": list(bbox),
                "source": source,
            }
        )
        print(json.dumps({"name": name, "source": source, "path": str(out_path)}, ensure_ascii=False))

    write_manifest(generated, errors)


if __name__ == "__main__":
    main()
