from __future__ import annotations

import json
import shutil
from collections import deque
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets" / "主角图" / "小男孩--主角多角度动态图.png"
OUT_DIR = ROOT / "assets" / "generated" / "hero-boy-assets"
MANIFEST = OUT_DIR / "manifest.json"

COLS = 6
ROWS = 4
DEFAULT_PADDING = 12

FRAME_MAP = {
    "boy_down_idle": {"row": 0, "col": 0, "seed": (0.50, 0.44)},
    "boy_down_walk_a": {"row": 0, "col": 2, "seed": (0.50, 0.44)},
    "boy_down_walk_b": {"alias_of": "boy_down_walk_a"},
    "boy_up_idle": {"row": 1, "col": 0, "seed": (0.50, 0.46)},
    "boy_up_walk_a": {"row": 1, "col": 2, "seed": (0.50, 0.46)},
    "boy_up_walk_b": {"alias_of": "boy_up_walk_a"},
    "boy_side_idle": {"row": 2, "col": 0, "seed": (0.42, 0.48)},
    "boy_side_walk_a": {"row": 2, "col": 2, "seed": (0.42, 0.48)},
    "boy_side_walk_b": {"row": 2, "col": 4, "seed": (0.42, 0.48)},
    "boy_right_idle": {"alias_of": "boy_right_walk_a"},
    "boy_right_walk_a": {"row": 3, "col": 2, "seed": (0.42, 0.48), "pad": 18},
    "boy_right_walk_b": {"alias_of": "boy_right_walk_a"},
    "boy_cast": {"alias_of": "boy_side_walk_b"},
    "boy_cast_right": {"alias_of": "boy_right_walk_a"},
    "boy_happy": {"alias_of": "boy_down_idle"},
}


def cell_bounds(index: int, total: int, extent: int) -> tuple[int, int]:
    start = round(index * extent / total)
    end = round((index + 1) * extent / total)
    return start, end


def is_background(pixel: tuple[int, int, int, int]) -> bool:
    r, g, b, a = pixel
    if a == 0:
      return True
    if min(r, g, b) < 228:
      return False
    if max(r, g, b) - min(r, g, b) > 24:
      return False
    return True


def knock_out_background(tile: Image.Image, seed: tuple[float, float], padding: int = DEFAULT_PADDING) -> Image.Image:
    img = tile.convert("RGBA")
    width, height = img.size
    pixels = img.load()
    keep = [[True] * width for _ in range(height)]
    seen: set[tuple[int, int]] = set()
    queue: deque[tuple[int, int]] = deque()

    for x in range(width):
        queue.append((x, 0))
        queue.append((x, height - 1))
    for y in range(height):
        queue.append((0, y))
        queue.append((width - 1, y))

    while queue:
        x, y = queue.popleft()
        if (x, y) in seen or not (0 <= x < width and 0 <= y < height):
            continue
        seen.add((x, y))
        if not is_background(pixels[x, y]):
            continue
        keep[y][x] = False
        queue.extend(((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)))

    for y in range(height):
        for x in range(width):
            if not keep[y][x]:
                pixels[x, y] = (0, 0, 0, 0)

    visited: set[tuple[int, int]] = set()
    largest_component: set[tuple[int, int]] = set()

    for y in range(height):
        for x in range(width):
            if (x, y) in visited or pixels[x, y][3] == 0:
                continue
            component: set[tuple[int, int]] = set()
            queue = deque([(x, y)])
            visited.add((x, y))
            while queue:
                cx, cy = queue.popleft()
                component.add((cx, cy))
                for nx, ny in ((cx - 1, cy), (cx + 1, cy), (cx, cy - 1), (cx, cy + 1)):
                    if not (0 <= nx < width and 0 <= ny < height):
                        continue
                    if (nx, ny) in visited or pixels[nx, ny][3] == 0:
                        continue
                    visited.add((nx, ny))
                    queue.append((nx, ny))
            if len(component) > len(largest_component):
                largest_component = component

    if largest_component:
        seed_x = width * seed[0]
        seed_y = height * seed[1]
        best_component = largest_component
        best_score = float("inf")
        for_component = []
        visited.clear()
        for y in range(height):
            for x in range(width):
                if (x, y) in visited or pixels[x, y][3] == 0:
                    continue
                component: set[tuple[int, int]] = set()
                queue = deque([(x, y)])
                visited.add((x, y))
                while queue:
                    cx, cy = queue.popleft()
                    component.add((cx, cy))
                    for nx, ny in ((cx - 1, cy), (cx + 1, cy), (cx, cy - 1), (cx, cy + 1)):
                        if not (0 <= nx < width and 0 <= ny < height):
                            continue
                        if (nx, ny) in visited or pixels[nx, ny][3] == 0:
                            continue
                        visited.add((nx, ny))
                        queue.append((nx, ny))
                for_component.append(component)

        for component in for_component:
            cx = sum(point[0] for point in component) / len(component)
            cy = sum(point[1] for point in component) / len(component)
            score = ((cx - seed_x) ** 2 + (cy - seed_y) ** 2) - len(component) * 0.04
            if score < best_score:
                best_score = score
                best_component = component

        for y in range(height):
            for x in range(width):
                if pixels[x, y][3] > 0 and (x, y) not in best_component:
                    pixels[x, y] = (0, 0, 0, 0)

    bbox = img.getbbox()
    if bbox is None:
        return img

    left = max(0, bbox[0] - padding)
    top = max(0, bbox[1] - padding)
    right = min(width, bbox[2] + padding)
    bottom = min(height, bbox[3] + padding)
    return img.crop((left, top, right, bottom))


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    sheet = Image.open(SOURCE).convert("RGBA")
    width, height = sheet.size
    assets: list[dict[str, object]] = []

    rendered: dict[str, Image.Image] = {}

    for name, spec in FRAME_MAP.items():
        if "alias_of" in spec:
            continue
        row = int(spec["row"])
        col = int(spec["col"])
        seed = tuple(spec["seed"])
        padding = int(spec.get("pad", DEFAULT_PADDING))
        left, right = cell_bounds(col, COLS, width)
        top, bottom = cell_bounds(row, ROWS, height)
        tile = sheet.crop((left, top, right, bottom))
        frame = knock_out_background(tile, seed, padding)
        out_path = OUT_DIR / f"{name}.png"
        frame.save(out_path)
        assets.append(
            {
                "name": name,
                "file": str(out_path.relative_to(ROOT)).replace("\\", "/"),
                "row": row,
                "col": col,
                "size": list(frame.size),
            }
        )
        rendered[name] = frame

    for name, spec in FRAME_MAP.items():
        if "alias_of" not in spec:
            continue
        source_name = str(spec["alias_of"])
        out_path = OUT_DIR / f"{name}.png"
        source_path = OUT_DIR / f"{source_name}.png"
        shutil.copyfile(source_path, out_path)
        frame = Image.open(out_path).convert("RGBA")
        assets.append(
            {
                "name": name,
                "file": str(out_path.relative_to(ROOT)).replace("\\", "/"),
                "aliasOf": source_name,
                "size": list(frame.size),
            }
        )
        rendered[name] = frame

    MANIFEST.write_text(
        json.dumps(
            {
                "source": str(SOURCE.relative_to(ROOT)).replace("\\", "/"),
                "cols": COLS,
                "rows": ROWS,
                "assets": assets,
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
