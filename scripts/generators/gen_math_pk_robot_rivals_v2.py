"""Generate Math PK robot rival sprites with Agnes.

Reads AGNES_TOKEN from the environment or repo .env. Outputs transparent PNG
and WebP files under assets/arena/math-rivals without storing secrets.
"""

from __future__ import annotations

import argparse
import base64
import json
import os
import time
import urllib.error
import urllib.request
from collections import deque
from datetime import datetime, timezone
from pathlib import Path

from PIL import Image


API_URL = "https://apihub.agnes-ai.com/v1/images/generations"
MODEL = "agnes-image-2.1-flash"

COMMON_STYLE = (
    "full-body cute cartoon robot rival sprite for a children's math battle game, "
    "soft 3D toy-like illustration, rounded friendly silhouette, expressive face, "
    "centered character, generous padding, front three-quarter view, polished game asset, "
    "No scene, no floor, no shadow, no readable text, no letters, no numbers, "
    "no math symbols, no logo, no watermark, not scary, not realistic, "
    "not a recolor of the same robot"
)

CHROMA_STYLE = (
    "on a perfectly flat solid {key_color} chroma-key background for background removal. "
    "The background must be one uniform color with no shadows, gradients, texture, "
    "checkerboard pattern, floor plane, or lighting variation. "
    "Do not use {avoid_color} anywhere in the robot. "
)

TRUE_ALPHA_STYLE = (
    "transparent background PNG with real alpha channel. The background must be fully transparent, "
    "not white, not black, not colored, no checkerboard pattern, no fake transparency, no shadows. "
)

ROBOTS = [
    {
        "id": "easy20",
        "file": "robot-easy20-v5",
        "key_color": "",
        "avoid_color": "",
        "prompt": (
            "Beginner practice robot named Roundy: small round body like a soft capsule, "
            "single antenna with a glowing bead, mitten hands, short chunky feet, "
            "gentle mint green and warm cream accents, simple friendly smile, "
            "toy training-bot personality. "
            + COMMON_STYLE
        ),
    },
    {
        "id": "easy100",
        "file": "robot-easy100-v5",
        "key_color": "",
        "avoid_color": "",
        "prompt": (
            "Color-key calculator robot: square rounded calculator-like torso with blank colorful buttons, "
            "large headphone-like side disks, tiny hovering helper tabs, sturdy boots, "
            "sky blue, coral, and soft yellow accents, energetic but friendly. "
            + COMMON_STYLE
        ),
    },
    {
        "id": "medium_mul",
        "file": "robot-mul-v5",
        "key_color": "",
        "avoid_color": "",
        "prompt": (
            "Star array robot: slim explorer robot with a star-shaped chest core, orbiting blank dot tiles, "
            "small jetpack fins, confident pose, deep teal, sky blue, and starlight gold accents, "
            "multiplication-pattern vibe without any visible symbols. "
            + COMMON_STYLE
        ),
    },
    {
        "id": "medium_mix",
        "file": "robot-mix-v5",
        "key_color": "",
        "avoid_color": "",
        "prompt": (
            "Professor puzzle robot: clever round professor robot with oversized translucent goggles, "
            "floating blank puzzle plates, articulated arms, small lab-coat-like shell panels, "
            "soft navy, cyan, mint, and ivory palette, curious mentor-rival personality. "
            + COMMON_STYLE
        ),
    },
    {
        "id": "hard",
        "file": "robot-hard-v5",
        "key_color": "",
        "avoid_color": "",
        "prompt": (
            "Champion math battle robot: taller premium arcade champion robot, crown-like antenna fins, "
            "sleek armor plates, glowing chest gem, confident victory stance, "
            "royal blue, pearl white, and restrained gold accents, impressive but still cute and child-safe. "
            + COMMON_STYLE
        ),
    },
]


def repo_root() -> Path:
    return Path(__file__).resolve().parents[2]


def load_dotenv(root: Path) -> None:
    env_path = root / ".env"
    if not env_path.exists():
        return
    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value


def build_prompt(robot: dict) -> str:
    if robot.get("key_color"):
        return (
            robot["prompt"]
            + CHROMA_STYLE.format(key_color=robot["key_color"], avoid_color=robot["avoid_color"])
        )
    return robot["prompt"] + TRUE_ALPHA_STYLE


def request_json(token: str, prompt: str) -> dict:
    payload = {
        "model": MODEL,
        "prompt": prompt,
        "n": 1,
        "size": "1024x1024",
    }
    data = json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(
        API_URL,
        data=data,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    last_error = ""
    for attempt in range(4):
        try:
            with urllib.request.urlopen(request, timeout=180) as response:
                return json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace")[:500]
            last_error = f"Agnes HTTP {exc.code}: {detail}"
            if exc.code not in {429, 500, 502, 503, 504}:
                raise RuntimeError(last_error) from exc
        except urllib.error.URLError as exc:
            last_error = f"Agnes URL error: {exc}"
        time.sleep(4 + attempt * 4)
    raise RuntimeError(last_error or "Agnes request failed")


def download(url: str) -> bytes:
    with urllib.request.urlopen(url, timeout=180) as response:
        return response.read()


def image_bytes_from_response(response: dict, robot_id: str) -> bytes:
    data = response.get("data") or []
    if not data:
        raise RuntimeError(f"Agnes returned no image data for {robot_id}: {str(response)[:500]}")
    first = data[0]
    if first.get("url"):
        return download(first["url"])
    if first.get("b64_json"):
        return base64.b64decode(first["b64_json"])
    raise RuntimeError(f"Agnes image data for {robot_id} has no url or b64_json")


def is_checkerboard_pixel(pixel: tuple[int, int, int, int]) -> bool:
    r, g, b, a = pixel
    if a < 16:
        return True
    spread = max(r, g, b) - min(r, g, b)
    brightness = (r + g + b) / 3
    return spread <= 36 and 80 <= brightness <= 255


def parse_hex_color(value: str) -> tuple[int, int, int]:
    value = value.strip().lstrip("#")
    return int(value[0:2], 16), int(value[2:4], 16), int(value[4:6], 16)


def is_chroma_key_pixel(pixel: tuple[int, int, int, int], key_rgb: tuple[int, int, int]) -> bool:
    r, g, b, a = pixel
    if a < 16:
        return True
    kr, kg, kb = key_rgb
    distance = abs(r - kr) + abs(g - kg) + abs(b - kb)
    if distance <= 150:
        return True
    if key_rgb == (255, 0, 255):
        return r >= 155 and b >= 145 and g <= 140 and abs(r - b) <= 105
    if key_rgb == (0, 255, 0):
        return g >= 150 and r <= 145 and b <= 145
    if key_rgb == (0, 0, 255):
        return b >= 150 and r <= 145 and g <= 145
    return False


def remove_connected_background(image: Image.Image, key_color: str = "") -> Image.Image:
    rgba = image.convert("RGBA")
    width, height = rgba.size
    key_rgb = parse_hex_color(key_color) if key_color else (255, 0, 255)
    pixels = rgba.load()
    visited = bytearray(width * height)
    queue: deque[tuple[int, int]] = deque()

    def mark_if_bg(x: int, y: int) -> None:
        index = y * width + x
        if visited[index]:
            return
        visited[index] = 1
        if is_chroma_key_pixel(pixels[x, y], key_rgb) or is_checkerboard_pixel(pixels[x, y]):
            queue.append((x, y))

    for x in range(width):
        mark_if_bg(x, 0)
        mark_if_bg(x, height - 1)
    for y in range(height):
        mark_if_bg(0, y)
        mark_if_bg(width - 1, y)

    background = bytearray(width * height)
    while queue:
        x, y = queue.popleft()
        index = y * width + x
        background[index] = 1
        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if nx < 0 or ny < 0 or nx >= width or ny >= height:
                continue
            nindex = ny * width + nx
            if visited[nindex]:
                continue
            visited[nindex] = 1
            if is_chroma_key_pixel(pixels[nx, ny], key_rgb) or is_checkerboard_pixel(pixels[nx, ny]):
                queue.append((nx, ny))

    out = rgba.copy()
    out_pixels = out.load()
    for y in range(height):
        for x in range(width):
            if background[y * width + x] or is_chroma_key_pixel(out_pixels[x, y], key_rgb):
                r, g, b, _ = out_pixels[x, y]
                out_pixels[x, y] = (r, g, b, 0)
    return out


def normalize_asset(raw_path: Path, png_path: Path, webp_path: Path, key_color: str) -> dict:
    with Image.open(raw_path) as source:
        image = remove_connected_background(source, key_color)
        alpha = image.getchannel("A")
        bbox = alpha.getbbox()
        if bbox:
            image = image.crop(bbox)
        canvas_size = 768
        image.thumbnail((660, 660), Image.Resampling.LANCZOS)
        canvas = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))
        x = (canvas_size - image.width) // 2
        y = (canvas_size - image.height) // 2
        canvas.alpha_composite(image, (x, y))
        canvas.save(png_path)
        canvas.save(webp_path, quality=94, method=6)

    with Image.open(png_path) as final:
        final_rgba = final.convert("RGBA")
        alpha = final_rgba.getchannel("A")
        corners = [
            alpha.getpixel((0, 0)),
            alpha.getpixel((final_rgba.width - 1, 0)),
            alpha.getpixel((0, final_rgba.height - 1)),
            alpha.getpixel((final_rgba.width - 1, final_rgba.height - 1)),
        ]
        opaque_pixels = sum(1 for value in alpha.getdata() if value > 16)
        coverage = opaque_pixels / (final_rgba.width * final_rgba.height)
        root = repo_root()
        return {
            "png": str(png_path.relative_to(root).as_posix()),
            "webp": str(webp_path.relative_to(root).as_posix()),
            "width": final_rgba.width,
            "height": final_rgba.height,
            "cornerAlphaMax": max(corners),
            "opaqueCoverage": round(coverage, 4),
            "pngBytes": png_path.stat().st_size,
            "webpBytes": webp_path.stat().st_size,
        }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--force", action="store_true")
    parser.add_argument("--delay", type=float, default=2.0)
    args = parser.parse_args()

    root = repo_root()
    load_dotenv(root)
    token = os.environ.get("AGNES_TOKEN", "").strip()
    if not token:
        raise SystemExit("AGNES_TOKEN is missing. Set it in .env or the environment.")

    out_dir = root / "assets" / "arena" / "math-rivals"
    raw_dir = root / "prj" / "gpt-image-workflow" / "output" / "math-pk-robots-v2-raw"
    out_dir.mkdir(parents=True, exist_ok=True)
    raw_dir.mkdir(parents=True, exist_ok=True)

    records = []
    for index, robot in enumerate(ROBOTS):
        raw_path = raw_dir / f"{robot['file']}-raw.png"
        png_path = out_dir / f"{robot['file']}.png"
        webp_path = out_dir / f"{robot['file']}.webp"
        if png_path.exists() and webp_path.exists() and not args.force:
            status = "skipped-existing"
        else:
            response = request_json(token, build_prompt(robot))
            raw_path.write_bytes(image_bytes_from_response(response, robot["id"]))
            status = "generated"

        asset = normalize_asset(raw_path if raw_path.exists() else png_path, png_path, webp_path, robot["key_color"])
        records.append({
            "id": robot["id"],
            "file": robot["file"],
            "status": status,
            **asset,
        })
        print(f"{status}: {robot['file']} -> {asset['webp']} ({asset['webpBytes']} bytes)")
        if index < len(ROBOTS) - 1:
            time.sleep(args.delay)

    manifest = {
        "model": MODEL,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "assets": records,
    }
    manifest_path = out_dir / "robot-rivals-v2-manifest.json"
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"manifest: {manifest_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
