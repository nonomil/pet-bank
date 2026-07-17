"""Generate a raster image through the TokenX24 OpenAI-compatible image API."""

from __future__ import annotations

import argparse
import base64
import io
import json
import urllib.error
import urllib.request
from pathlib import Path


def read_key(path: Path) -> str:
    text = path.read_text(encoding="utf-8")
    patterns = (
        r'"OPENAI_API_KEY"\s*:\s*"([^"]+)"',
        r"OPENAI_API_KEY\s*=\s*[\"']([^\"']+)[\"']",
    )
    import re

    for pattern in patterns:
        match = re.search(pattern, text)
        if match:
            return match.group(1)
    raise RuntimeError(f"OPENAI_API_KEY not found in {path}")


def extract_bytes(value):
    if isinstance(value, dict):
        for key in ("b64_json", "image_base64"):
            candidate = value.get(key)
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


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--key-file", type=Path, default=Path("docs/生图/生图接口资源key/TOKEN24.md"))
    parser.add_argument("--endpoint", default="https://tokenx24.com/v1/images/generations")
    parser.add_argument("--model", default="gpt-image-2")
    parser.add_argument("--prompt-file", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--size", default="1536x1024")
    parser.add_argument("--quality", default="medium", choices=("low", "medium", "high", "auto"))
    args = parser.parse_args()

    payload = json.dumps({
        "model": args.model,
        "prompt": args.prompt_file.read_text(encoding="utf-8").strip(),
        "n": 1,
        "size": args.size,
        "quality": args.quality,
    }).encode("utf-8")
    request = urllib.request.Request(
        args.endpoint,
        data=payload,
        headers={
            "Authorization": f"Bearer {read_key(args.key_file)}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=300) as response:
            data = json.loads(response.read().decode("utf-8"))
    except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError, json.JSONDecodeError) as error:
        raise SystemExit(f"TokenX24 image generation failed: {error}") from error

    image = extract_bytes(data)
    if not image:
        raise SystemExit("TokenX24 image generation failed: response contains no image bytes")
    args.out.parent.mkdir(parents=True, exist_ok=True)
    if args.out.suffix.lower() == ".webp":
        try:
            from PIL import Image
        except ImportError as error:
            raise SystemExit("Writing WebP requires Pillow") from error
        with Image.open(io.BytesIO(image)) as source:
            source.convert("RGB").save(args.out, "WEBP", quality=84, method=6)
    else:
        args.out.write_bytes(image)
    print(f"SAVED={args.out} bytes={args.out.stat().st_size} model={args.model} size={args.size}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
