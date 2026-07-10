from __future__ import annotations

import base64
import json
import os
import time
import urllib.error
import urllib.request
from pathlib import Path

from PIL import Image, ImageFilter, ImageOps


PROJECT = Path(__file__).resolve().parents[1]
ROOT = PROJECT.parents[1]
OUT = PROJECT / "assets" / "generated" / "typing-defense-assets"
REFERENCE = PROJECT / "assets" / "generated" / "reference"
MANIFEST = OUT / "manifest.json"
API_URL = "https://apihub.agnes-ai.com/v1/images/generations"
MODEL = "agnes-image-2.1-flash"
TARGET_SIZE = (1600, 900)

BACKGROUND_PROMPT = """Create an absolutely empty 16:9 voxel game landscape background for a children's typing and arithmetic defense web game. Bright sunny daytime, original block-world style. The scene must contain no people, no creatures, no monsters, no animals, no characters, no signs, no scoreboards, no plaques, no symbols, no letters, no numbers, no user interface, no weapons, no tools, no crossbows, no logos, no buildings in the center. Show only environment: grassy field, three very obvious dirt path lanes widening toward the viewer, clear horizon, soft square clouds, a few blocky trees and distant hills mostly on the far left and far right. Keep the center clean and empty for later web game overlays. The lower foreground should feel grounded and suitable for enemies standing on it without looking like they float. Kid-friendly, crisp, clean, colorful, calm, not dark, not scary."""

GROUND_PROMPT = """Create a near-ground foreground texture layer for a children's voxel typing-defense game. 16:9 landscape, only the lower gameplay ground: bright grass, three obvious dirt path lanes, blocky texture detail, subtle grass tufts, and clean readable lane edges that widen toward the viewer. No sky, no trees crossing the center, no characters, no UI, no text, no logos. The image should feel suitable for slight scrolling or repeated motion in a browser game foreground, so keep the composition clean and rhythmically patterned rather than like a single illustration."""

DUSK_BACKGROUND_PROMPT = """Create an absolutely empty 16:9 voxel game landscape background for a children's typing and arithmetic defense web game at warm sunset. Original block-world style, kid-friendly and readable. The scene must contain no people, no creatures, no monsters, no animals, no characters, no signs, no scoreboards, no plaques, no symbols, no letters, no numbers, no user interface, no weapons, no tools, no crossbows, no logos. Show only environment: grassy field, three obvious dirt path lanes widening toward the viewer, a clean horizon, warm peach-gold sky, soft square clouds lit by sunset, and a few blocky trees and distant hills pushed mostly to the far left and far right. Keep the center open and uncluttered for later web game overlays. The lower foreground must feel grounded so enemies can stand on it naturally. Calm, adventurous, colorful, not dark, not spooky."""

OVERCAST_BACKGROUND_PROMPT = """Create an absolutely empty 16:9 voxel game landscape background for a children's typing and arithmetic defense web game on a bright overcast forest-edge day. Original block-world style, kid-friendly and readable. The scene must contain no people, no creatures, no monsters, no animals, no characters, no signs, no scoreboards, no plaques, no symbols, no letters, no numbers, no user interface, no weapons, no tools, no logos. Show only environment: grassy field, three obvious dirt path lanes widening toward the viewer, a soft silver-blue sky with light clouds, a few richer blocky pine and oak trees pushed mostly to the far left and far right, and distant hills. Keep the center open and uncluttered for later web game overlays. The lower foreground must feel grounded so enemies can stand on it naturally. Gentle, adventurous, slightly faster-paced, but still cheerful and safe for young children."""


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


def request_agnes(token: str, prompt: str, size: str = "1536x1024") -> bytes:
    payload = {
        "model": MODEL,
        "prompt": prompt,
        "n": 1,
        "size": size,
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
    with urllib.request.urlopen(request, timeout=240) as response:
        data = json.loads(response.read().decode("utf-8"))

    item = data.get("data", [{}])[0]
    if item.get("b64_json"):
        return base64.b64decode(item["b64_json"])
    if item.get("url"):
        with urllib.request.urlopen(item["url"], timeout=180) as response:
            return response.read()
    raise RuntimeError(f"Agnes returned no image payload: {str(data)[:500]}")


def save_final(
    raw_path: Path,
    final_path: Path,
    fit: tuple[int, int],
    centering: tuple[float, float] = (0.5, 0.5),
) -> None:
    image = Image.open(raw_path).convert("RGB")
    fitted = ImageOps.fit(image, fit, method=Image.Resampling.LANCZOS, centering=centering)
    fitted.save(final_path, quality=92)


def smoothstep(value: float) -> float:
    clamped = min(1.0, max(0.0, value))
    return clamped * clamped * (3.0 - 2.0 * clamped)


def save_foreground_strip(
    raw_path: Path,
    final_path: Path,
    fit: tuple[int, int],
    centering: tuple[float, float] = (0.5, 0.76),
) -> None:
    image = Image.open(raw_path).convert("RGBA")
    fitted = ImageOps.fit(image, fit, method=Image.Resampling.LANCZOS, centering=centering)
    alpha = Image.new("L", fit, 0)
    pixels = alpha.load()
    width, height = fit
    for y in range(height):
        ratio = y / max(1, height - 1)
        fade = smoothstep((ratio - 0.24) / 0.52)
        a = int(fade * 255)
        for x in range(width):
            pixels[x, y] = a
    alpha = alpha.filter(ImageFilter.GaussianBlur(radius=6))
    fitted.putalpha(alpha)
    fitted.save(final_path)


def update_manifest(entries: list[dict], status: str) -> None:
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    names = {entry["name"] for entry in entries}
    manifest["assets"] = [asset for asset in manifest["assets"] if asset.get("name") not in names]
    manifest["assets"].extend(entries)
    manifest["agnesBackgrounds"] = {
        "model": MODEL,
        "promptFile": "assets/generated/reference/agnes-background-prompts.md",
        "lastRun": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
        "status": status,
    }
    manifest["agnesDuskBackgrounds"] = {
        "model": MODEL,
        "promptFile": "assets/generated/reference/agnes-background-prompts.md",
        "lastRun": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
        "status": status,
    }
    manifest["agnesOvercastBackgrounds"] = {
        "model": MODEL,
        "promptFile": "assets/generated/reference/agnes-background-prompts.md",
        "lastRun": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
        "status": status,
    }
    MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")


def make_entry(name: str, filename: str, image_path: Path, prompt: str, source: str) -> dict:
    image = Image.open(image_path)
    return {
        "name": name,
        "file": f"assets/generated/typing-defense-assets/{filename}",
        "size": [image.width, image.height],
        "source": source,
        "prompt": prompt[:180],
    }


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    REFERENCE.mkdir(parents=True, exist_ok=True)

    prompt_file = REFERENCE / "agnes-background-prompts.md"
    prompt_file.write_text(
        "# Agnes Background Prompts\n\n## Full Stage Background\n\n"
        + BACKGROUND_PROMPT
        + "\n\n## Near Ground Layer\n\n"
        + GROUND_PROMPT
        + "\n\n## Dusk Full Stage Background\n\n"
        + DUSK_BACKGROUND_PROMPT
        + "\n\n## Overcast Forest Edge Background\n\n"
        + OVERCAST_BACKGROUND_PROMPT
        + "\n",
        encoding="utf-8",
    )

    token = load_token()
    jobs = [
        {
            "raw": REFERENCE / "agnes-voxel-map-background-raw.png",
            "final": OUT / "voxel_map_background_agnes.jpg",
            "name": "voxel_map_background_agnes",
            "filename": "voxel_map_background_agnes.jpg",
            "prompt": BACKGROUND_PROMPT,
            "fit": TARGET_SIZE,
            "centering": (0.5, 0.56),
        },
        {
            "raw": REFERENCE / "agnes-ground-lanes-raw.png",
            "final": OUT / "voxel_ground_lanes_agnes.jpg",
            "name": "voxel_ground_lanes_agnes",
            "filename": "voxel_ground_lanes_agnes.jpg",
            "prompt": GROUND_PROMPT,
            "fit": TARGET_SIZE,
            "centering": (0.5, 0.76),
        },
        {
            "raw": REFERENCE / "agnes-voxel-map-background-raw.png",
            "final": OUT / "voxel_ground_foreground_agnes.png",
            "name": "voxel_ground_foreground_agnes",
            "filename": "voxel_ground_foreground_agnes.png",
            "prompt": f"{BACKGROUND_PROMPT} Transparent foreground strip derived locally from the same Agnes map background for runtime overlay.",
            "fit": TARGET_SIZE,
            "centering": (0.5, 0.56),
            "builder": "foreground",
            "source": f"{MODEL} + local-alpha-mask",
        },
        {
            "raw": REFERENCE / "agnes-voxel-map-background-dusk-raw.png",
            "final": OUT / "voxel_map_background_dusk_agnes.jpg",
            "name": "voxel_map_background_dusk_agnes",
            "filename": "voxel_map_background_dusk_agnes.jpg",
            "prompt": DUSK_BACKGROUND_PROMPT,
            "fit": TARGET_SIZE,
            "centering": (0.5, 0.56),
        },
        {
            "raw": REFERENCE / "agnes-voxel-map-background-dusk-raw.png",
            "final": OUT / "voxel_ground_foreground_dusk_agnes.png",
            "name": "voxel_ground_foreground_dusk_agnes",
            "filename": "voxel_ground_foreground_dusk_agnes.png",
            "prompt": f"{DUSK_BACKGROUND_PROMPT} Transparent foreground strip derived locally from the same Agnes dusk map background for runtime overlay.",
            "fit": TARGET_SIZE,
            "centering": (0.5, 0.56),
            "builder": "foreground",
            "source": f"{MODEL} + local-alpha-mask",
        },
        {
            "raw": REFERENCE / "agnes-voxel-map-background-overcast-raw.png",
            "final": OUT / "voxel_map_background_overcast_agnes.jpg",
            "name": "voxel_map_background_overcast_agnes",
            "filename": "voxel_map_background_overcast_agnes.jpg",
            "prompt": OVERCAST_BACKGROUND_PROMPT,
            "fit": TARGET_SIZE,
            "centering": (0.5, 0.56),
        },
        {
            "raw": REFERENCE / "agnes-voxel-map-background-overcast-raw.png",
            "final": OUT / "voxel_ground_foreground_overcast_agnes.png",
            "name": "voxel_ground_foreground_overcast_agnes",
            "filename": "voxel_ground_foreground_overcast_agnes.png",
            "prompt": f"{OVERCAST_BACKGROUND_PROMPT} Transparent foreground strip derived locally from the same Agnes overcast map background for runtime overlay.",
            "fit": TARGET_SIZE,
            "centering": (0.5, 0.56),
            "builder": "foreground",
            "source": f"{MODEL} + local-alpha-mask",
        },
    ]

    entries = []
    for job in jobs:
        if not job["raw"].exists():
            job["raw"].write_bytes(request_agnes(token, job["prompt"]))
        if job.get("builder") == "foreground":
            save_foreground_strip(job["raw"], job["final"], job["fit"], job.get("centering", (0.5, 0.76)))
        else:
            save_final(job["raw"], job["final"], job["fit"], job.get("centering", (0.5, 0.5)))
        entries.append(
            make_entry(
                job["name"],
                job["filename"],
                job["final"],
                job["prompt"],
                job.get("source", MODEL),
            )
        )

    update_manifest(entries, "ok")
    print(json.dumps({"generated": [str(job["final"]) for job in jobs], "source": MODEL}, ensure_ascii=False))


if __name__ == "__main__":
    try:
        main()
    except (RuntimeError, urllib.error.URLError, urllib.error.HTTPError, OSError) as exc:
        print(json.dumps({"error": str(exc)}, ensure_ascii=False))
        raise
