from __future__ import annotations

import json
import time
from pathlib import Path

from PIL import Image, ImageEnhance, ImageFilter, ImageOps


PROJECT = Path(__file__).resolve().parents[1]
OUT = PROJECT / "assets" / "generated" / "typing-defense-assets"
REFERENCE = PROJECT / "assets" / "generated" / "reference"
MANIFEST = OUT / "manifest.json"
DAY_SOURCE = OUT / "voxel_map_background_agnes.jpg"
DUSK_SOURCE = OUT / "voxel_map_background_dusk_agnes.jpg"
OVERCAST_SOURCE = OUT / "voxel_map_background_overcast_agnes.jpg"

WIDTH = 2048
HEIGHT = 256

PACKS = {
    "day": {
        "source": DAY_SOURCE,
        "layers": {
            "back": {"crop": (0.0, 0.16, 1.0, 0.35), "brightness": 0.92, "contrast": 0.95, "blur": 1.4, "opacity": 150},
            "mid": {"crop": (0.0, 0.24, 1.0, 0.44), "brightness": 0.82, "contrast": 1.04, "blur": 0.8, "opacity": 186},
            "front": {"crop": (0.0, 0.33, 1.0, 0.53), "brightness": 0.72, "contrast": 1.14, "blur": 0.3, "opacity": 222},
        },
    },
    "dusk": {
        "source": DUSK_SOURCE,
        "layers": {
            "back": {"crop": (0.0, 0.15, 1.0, 0.35), "brightness": 0.86, "contrast": 1.02, "blur": 1.4, "opacity": 150},
            "mid": {"crop": (0.0, 0.24, 1.0, 0.45), "brightness": 0.8, "contrast": 1.08, "blur": 0.9, "opacity": 194},
            "front": {"crop": (0.0, 0.33, 1.0, 0.54), "brightness": 0.74, "contrast": 1.14, "blur": 0.3, "opacity": 228},
        },
    },
    "overcast": {
        "source": OVERCAST_SOURCE,
        "layers": {
            "back": {"crop": (0.0, 0.15, 1.0, 0.35), "brightness": 0.88, "contrast": 0.98, "blur": 1.5, "opacity": 154, "overlay": (160, 188, 210, 18)},
            "mid": {"crop": (0.0, 0.24, 1.0, 0.45), "brightness": 0.82, "contrast": 1.06, "blur": 0.95, "opacity": 198, "overlay": (120, 148, 162, 18)},
            "front": {"crop": (0.0, 0.33, 1.0, 0.54), "brightness": 0.78, "contrast": 1.14, "blur": 0.32, "opacity": 230, "overlay": (88, 118, 126, 12)},
        },
    },
}


def load_manifest() -> dict:
    return json.loads(MANIFEST.read_text(encoding="utf-8"))


def save_manifest(manifest: dict) -> None:
    MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")


def crop_box(image: Image.Image, normalized: tuple[float, float, float, float]) -> tuple[int, int, int, int]:
    left = int(image.width * normalized[0])
    top = int(image.height * normalized[1])
    right = int(image.width * normalized[2])
    bottom = int(image.height * normalized[3])
    return (left, top, right, bottom)


def alpha_mask(height: int, strength: int) -> Image.Image:
    mask = Image.new("L", (WIDTH, height), 0)
    pixels = mask.load()
    for y in range(height):
        ratio = y / max(1, height - 1)
        band = min(1.0, max(0.0, (ratio - 0.06) / 0.3))
        fade_out = min(1.0, max(0.0, (1.0 - ratio) / 0.24))
        alpha = int(strength * min(band, fade_out))
        for x in range(WIDTH):
            pixels[x, y] = alpha
    return mask.filter(ImageFilter.GaussianBlur(radius=4))


def build_strip(pack_name: str, layer_name: str, spec: dict) -> Path:
    source = Image.open(PACKS[pack_name]["source"]).convert("RGBA")
    cropped = source.crop(crop_box(source, spec["crop"]))
    fitted = ImageOps.fit(cropped, (WIDTH, HEIGHT), method=Image.Resampling.LANCZOS, centering=(0.5, 0.5))
    fitted = ImageEnhance.Brightness(fitted).enhance(spec.get("brightness", 1.0))
    fitted = ImageEnhance.Contrast(fitted).enhance(spec.get("contrast", 1.0))
    if spec.get("blur", 0):
        fitted = fitted.filter(ImageFilter.GaussianBlur(radius=spec["blur"]))
    overlay = spec.get("overlay")
    if overlay:
        glaze = Image.new("RGBA", fitted.size, overlay)
        fitted = Image.alpha_composite(fitted, glaze)
    fitted.putalpha(alpha_mask(HEIGHT, spec.get("opacity", 180)))
    out_path = OUT / f"horizon_{pack_name}_{layer_name}_agnes.png"
    fitted.save(out_path)
    return out_path


def make_entry(name: str, path: Path, pack_name: str, layer_name: str) -> dict:
    image = Image.open(path)
    bbox = image.getchannel("A").getbbox() or (0, 0, image.width, image.height)
    return {
        "name": name,
        "file": f"assets/generated/typing-defense-assets/{path.name}",
        "size": [image.width, image.height],
        "bbox": list(bbox),
        "source": "agnes-image-2.1-flash + local-horizon-strip",
        "pack": pack_name,
        "layer": layer_name,
    }


def main() -> None:
    for required in [DAY_SOURCE, DUSK_SOURCE]:
        if not required.exists():
            raise FileNotFoundError(f"missing source background: {required}")

    manifest = load_manifest()
    generated_entries: list[dict] = []
    generated_names: set[str] = set()

    for pack_name, pack in PACKS.items():
        for layer_name, spec in pack["layers"].items():
            path = build_strip(pack_name, layer_name, spec)
            name = f"horizon_{pack_name}_{layer_name}_agnes"
            generated_entries.append(make_entry(name, path, pack_name, layer_name))
            generated_names.add(name)

    manifest["assets"] = [asset for asset in manifest["assets"] if asset.get("name") not in generated_names]
    manifest["assets"].extend(generated_entries)
    manifest["agnesHorizonStrips"] = {
        "sources": {
            "day": "assets/generated/typing-defense-assets/voxel_map_background_agnes.jpg",
            "dusk": "assets/generated/typing-defense-assets/voxel_map_background_dusk_agnes.jpg",
            "overcast": "assets/generated/typing-defense-assets/voxel_map_background_overcast_agnes.jpg",
        },
        "packs": list(PACKS.keys()),
        "layers": ["back", "mid", "front"],
        "lastRun": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
        "status": "ok",
    }
    save_manifest(manifest)
    print(json.dumps({"generated": [entry["file"] for entry in generated_entries]}, ensure_ascii=False))


if __name__ == "__main__":
    main()
