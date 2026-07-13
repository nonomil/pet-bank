"""Generate one raster asset through the project Agnes image endpoint.

The key is read locally and never written to responses, manifests, or logs.
The endpoint is OpenAI-compatible but does not accept response_format.
"""

from __future__ import annotations

import argparse
import base64
import json
import time
import urllib.error
import urllib.request
from pathlib import Path


def read_key(path: Path) -> str:
    for line in path.read_text(encoding="utf-8").splitlines():
        value = line.strip().strip("\"'")
        if len(value) >= 32 and " " not in value and not value.startswith("#") and "://" not in value and "/" not in value:
            return value
    raise RuntimeError(f"No Agnes key found in {path}")


def extract_bytes(value):
    if isinstance(value, dict):
        for key in ("b64_json", "image_base64", "result"):
            candidate = value.get(key)
            if isinstance(candidate, str) and len(candidate) > 1000:
                if candidate.startswith("data:") and "," in candidate:
                    candidate = candidate.split(",", 1)[1]
                return base64.b64decode(candidate)
        if isinstance(value.get("url"), str):
            with urllib.request.urlopen(value["url"], timeout=180) as response:
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


def generate(args: argparse.Namespace) -> int:
    prompt = args.prompt_file.read_text(encoding="utf-8").strip()
    key = read_key(args.key_file)
    payload = json.dumps({"model": args.model, "prompt": prompt, "n": 1, "size": args.size}).encode("utf-8")
    args.out.parent.mkdir(parents=True, exist_ok=True)
    last_error = None
    for attempt in range(1, args.retries + 1):
        request = urllib.request.Request(
            args.endpoint,
            data=payload,
            headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(request, timeout=args.timeout) as response:
                raw = response.read()
            data = json.loads(raw.decode("utf-8"))
            image = extract_bytes(data)
            if not image:
                raise RuntimeError("response contains no image bytes")
            args.out.write_bytes(image)
            print(f"SAVED={args.out} bytes={len(image)} model={args.model} attempt={attempt}")
            return 0
        except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError, RuntimeError, json.JSONDecodeError) as error:
            last_error = str(error)
            print(f"attempt={attempt} failed: {last_error[:240]}")
            if attempt < args.retries:
                time.sleep(min(args.retry_delay * attempt, 60))
    raise SystemExit(f"Agnes generation failed after {args.retries} attempts: {last_error}")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--key-file", type=Path, default=Path("docs/生图/生图接口资源key/Agnes生图key.md"))
    parser.add_argument("--endpoint", default="https://apihub.agnes-ai.com/v1/images/generations")
    parser.add_argument("--model", default="agnes-image-2.1-flash")
    parser.add_argument("--prompt-file", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--size", default="1024x1024")
    parser.add_argument("--retries", type=int, default=3)
    parser.add_argument("--retry-delay", type=int, default=8)
    parser.add_argument("--timeout", type=int, default=240)
    return generate(parser.parse_args())


if __name__ == "__main__":
    raise SystemExit(main())
