#!/usr/bin/env python3
"""Generate a reference-style pinyin snake mockup via Agnes."""
from __future__ import annotations

import base64
import json
import os
import urllib.error
import urllib.request
from pathlib import Path


BASE_URL = "https://apihub.agnes-ai.com/v1"
MODEL = "agnes-image-2.1-flash"
IMG_SIZE = "1536x1024"

PROMPT = (
    "Create a polished 16:9 children's web game mockup for a pinyin snake game inspired by a simple classroom snake game screen. "
    "Scene: a pale blue-white grid arena, a long rounded green snake made of soft circular body segments, cute white eyes on the head, "
    "small colorful round food dots scattered around the grid, and one target food with a floating bracket label area like a blank bracket plaque near it. "
    "Put only blank placeholder label shapes, no readable letters or numbers in the generated image because HTML will render the real pinyin. "
    "Minimal top-left stat area with blank space only, no text. "
    "Style: clean learning-machine screen, bright and simple, not dark, not cyberpunk, not crowded, readable for a 6-year-old child, "
    "soft 3D clay meets flat web game UI. Keep large empty grid space and clear target visibility. "
    "No watermark, no logo, no real text, no Chinese characters, no pinyin, no numbers."
)


def repo_root() -> Path:
    return Path(__file__).resolve().parents[3]


def prototype_root() -> Path:
    return Path(__file__).resolve().parents[1]


def load_token() -> str:
    token = os.environ.get("AGNES_TOKEN", "").strip()
    if token:
        return token
    env_path = repo_root() / ".env"
    if env_path.exists():
        for line in env_path.read_text(encoding="utf-8").splitlines():
            if line.startswith("AGNES_TOKEN="):
                return line.split("=", 1)[1].strip().strip('"').strip("'")
    raise RuntimeError("AGNES_TOKEN not found in environment or .env")


def sniff_ext(img_bytes: bytes) -> str:
    if img_bytes.startswith(b"\x89PNG\r\n\x1a\n"):
        return ".png"
    if img_bytes[:3] == b"\xff\xd8\xff":
        return ".jpg"
    if img_bytes[:4] == b"RIFF" and img_bytes[8:12] == b"WEBP":
        return ".webp"
    return ".png"


def main() -> int:
    token = load_token()
    req = urllib.request.Request(
        f"{BASE_URL}/images/generations",
        data=json.dumps({
            "model": MODEL,
            "prompt": PROMPT,
            "n": 1,
            "size": IMG_SIZE,
        }).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=180) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode(errors="replace")[:500]
        raise RuntimeError(f"Agnes HTTP {exc.code}: {detail}") from exc

    item = data["data"][0]
    if item.get("b64_json"):
        img_bytes = base64.b64decode(item["b64_json"])
    elif item.get("url"):
        with urllib.request.urlopen(item["url"], timeout=180) as resp:
            img_bytes = resp.read()
    else:
        raise RuntimeError(f"no image payload: {str(item)[:300]}")

    out_dir = prototype_root() / "assets" / "generated" / "reference"
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / f"pinyin-snake-reference-agnes{sniff_ext(img_bytes)}"
    out_path.write_bytes(img_bytes)
    result = {
        "model": MODEL,
        "size": IMG_SIZE,
        "prompt": PROMPT,
        "path": str(out_path),
        "bytes": len(img_bytes),
    }
    (out_dir / "pinyin-snake-reference-agnes.json").write_text(
        json.dumps(result, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(f"generated: {out_path} ({len(img_bytes)} bytes)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
