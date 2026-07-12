"""Generate the space-growth detective story art with the repo's Agnes contract."""

from __future__ import annotations

import argparse
import base64
import json
import re
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
KEY_FILE = ROOT / "docs" / "资源" / "生图" / "Agnes生图key.md"
API_URL = "https://apihub.agnes-ai.com/v1/images/generations"
MODEL = "agnes-image-2.1-flash"


def read_key() -> str:
    text = KEY_FILE.read_text(encoding="utf-8")
    match = re.search(r"sk-[A-Za-z0-9_-]+", text)
    if not match:
        raise RuntimeError(f"Agnes key not found in {KEY_FILE}")
    return match.group(0)


def request_image(prompt: str, size: str, timeout: int) -> bytes:
    payload = json.dumps({"model": MODEL, "prompt": prompt, "n": 1, "size": size}).encode("utf-8")
    request = urllib.request.Request(
        API_URL,
        data=payload,
        headers={"Authorization": f"Bearer {read_key()}", "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            body = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")[:800]
        raise RuntimeError(f"Agnes HTTP {error.code}: {detail}") from error

    data = body.get("data") or []
    if not data:
        raise RuntimeError(f"Agnes returned no image data: {json.dumps(body, ensure_ascii=False)[:800]}")
    first = data[0]
    if first.get("b64_json"):
        return base64.b64decode(first["b64_json"])
    if first.get("url"):
        with urllib.request.urlopen(first["url"], timeout=timeout) as response:
            return response.read()
    raise RuntimeError("Agnes image response has neither url nor b64_json")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--prompt-file", required=True)
    parser.add_argument("--out", required=True)
    parser.add_argument("--prefix", required=True)
    parser.add_argument("--size", default="1024x1024")
    parser.add_argument("--timeout", type=int, default=180)
    args = parser.parse_args()

    prompt_path = Path(args.prompt_file)
    output_dir = Path(args.out)
    output_dir.mkdir(parents=True, exist_ok=True)
    output_path = output_dir / f"{args.prefix}.png"
    image_bytes = request_image(prompt_path.read_text(encoding="utf-8"), args.size, args.timeout)
    output_path.write_bytes(image_bytes)
    metadata = {
        "model": MODEL,
        "size": args.size,
        "promptFile": str(prompt_path),
        "path": str(output_path),
        "bytes": len(image_bytes),
        "generatedAt": datetime.now(timezone.utc).isoformat(),
    }
    (output_dir / f"{args.prefix}.json").write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(metadata, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
