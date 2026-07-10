from __future__ import annotations

import json
from pathlib import Path

import cv2
import numpy as np
from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets" / "generated" / "reference" / "pinyin-snake-assets-sheet.png"
OUT_DIR = ROOT / "assets" / "generated" / "pinyin-snake-assets"
MANIFEST = OUT_DIR / "manifest.json"

NAMES = [
    "board_10x10",
    "snake_head_right",
    "pinyin_prompt_top",
    "controller_panel",
    "snake_body_horizontal",
    "snake_body_vertical",
    "snake_tail",
    "snake_corner",
    "food_tile_1",
    "food_tile_2",
    "food_tile_3",
    "food_tile_4",
    "score_trophy_badge",
    "pinyin_prompt_compact",
    "round_icon_button_1",
    "round_icon_button_2",
    "round_icon_button_3",
]


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    source = Image.open(SOURCE).convert("RGBA")
    rgba = np.array(source)
    alpha = rgba[:, :, 3]

    mask = (alpha > 24).astype("uint8")
    count, labels, stats, _ = cv2.connectedComponentsWithStats(mask, 8)

    components: list[tuple[int, int, int, int, int, int]] = []
    for label in range(1, count):
        x, y, w, h, area = [int(v) for v in stats[label]]
        if area < 900:
            continue
        components.append((label, x, y, w, h, area))

    components.sort(key=lambda item: (item[2], item[1]))
    if len(components) != len(NAMES):
        raise SystemExit(f"expected {len(NAMES)} components, found {len(components)}")

    manifest = {
        "source": str(SOURCE.relative_to(ROOT)).replace("\\", "/"),
        "alphaThreshold": 24,
        "assets": [],
    }

    for name, (label, x, y, w, h, area) in zip(NAMES, components):
        pad = 12
        x0 = max(0, x - pad)
        y0 = max(0, y - pad)
        x1 = min(source.width, x + w + pad)
        y1 = min(source.height, y + h + pad)

        crop = rgba[y0:y1, x0:x1].copy()
        component_mask = labels[y0:y1, x0:x1] == label
        crop[:, :, 3] = np.where(component_mask, crop[:, :, 3], 0).astype(np.uint8)
        crop[:, :, 3] = np.where(crop[:, :, 3] > 24, crop[:, :, 3], 0).astype(np.uint8)

        out_path = OUT_DIR / f"{name}.png"
        Image.fromarray(crop).save(out_path)

        manifest["assets"].append(
            {
                "name": name,
                "file": str(out_path.relative_to(ROOT)).replace("\\", "/"),
                "bbox": [x, y, w, h],
                "crop": [x0, y0, x1 - x0, y1 - y0],
                "opaquePixels": area,
            }
        )

    MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"split {len(components)} assets -> {OUT_DIR}")


if __name__ == "__main__":
    main()
