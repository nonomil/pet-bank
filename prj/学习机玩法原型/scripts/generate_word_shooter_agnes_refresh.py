#!/usr/bin/env python3
"""Generate the approved word-shooter level references and asset sheet with Agnes."""

from __future__ import annotations

import base64
import argparse
import json
import time
import urllib.error
import urllib.request
from pathlib import Path


API_URL = "https://apihub.agnes-ai.com/v1/images/generations"
MODEL = "agnes-image-2.1-flash"
ROOT = Path(__file__).resolve().parents[3]
PROMPT_ROOT = ROOT / "prj" / "学习机玩法原型" / "assets" / "generated" / "reference" / "word-shooter-levels-gpt-20260711"
OUTPUT_ROOT = PROMPT_ROOT / "agnes-20260712"
KEY_FILE = ROOT / "docs" / "GPT生图" / "Agnes生图key.md"

JOBS = [
    ("dawn-training-ground", "01-dawn-training-ground.prompt.txt", "1536x1024"),
    ("candy-nebula", "02-candy-nebula.prompt.txt", "1536x1024"),
    ("volcanic-meteor-belt", "03-volcanic-meteor-belt.prompt.txt", "1536x1024"),
    ("explosion-elements", "explosion-elements.prompt.txt", "1024x1024"),
]

CLEAN_JOBS = [
    ("dawn-training-ground-clean", "01-dawn-training-ground-clean.prompt.txt", "1536x1024"),
    ("candy-nebula-clean", "02-candy-nebula-clean.prompt.txt", "1536x1024"),
    ("volcanic-meteor-belt-clean", "03-volcanic-meteor-belt-clean.prompt.txt", "1536x1024"),
]

PROBE_JOBS = [
    ("agnes-probe", "agnes-probe.prompt.txt", "1024x1024"),
]


def read_token() -> str:
    for line in KEY_FILE.read_text(encoding="utf-8").splitlines():
        value = line.strip()
        if value.startswith("sk-"):
            return value
    raise RuntimeError(f"No Agnes token found in {KEY_FILE}")


def request_image(token: str, prompt: str, size: str, response_path: Path) -> bytes:
    payload = {"model": MODEL, "prompt": prompt, "n": 1, "size": size}
    request = urllib.request.Request(
        API_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=300) as response:
            body = response.read().decode("utf-8")
    except urllib.error.HTTPError as error:
        body = error.read().decode("utf-8", errors="replace")
        response_path.with_suffix(f".http{error.code}.txt").write_text(body, encoding="utf-8")
        raise RuntimeError(f"Agnes HTTP {error.code}: {body[:500]}") from error
    response_path.write_text(body, encoding="utf-8")
    data = json.loads(body)
    if data.get("error"):
        raise RuntimeError(f"Agnes API error: {str(data['error'])[:500]}")
    item = (data.get("data") or [{}])[0]
    if item.get("b64_json"):
        return base64.b64decode(item["b64_json"])
    if item.get("url"):
        with urllib.request.urlopen(item["url"], timeout=300) as response:
            return response.read()
    raise RuntimeError("Agnes returned neither b64_json nor url")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--only", nargs="*", help="Generate only named jobs.")
    args = parser.parse_args()
    OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)
    token = read_token()
    jobs = JOBS + CLEAN_JOBS + PROBE_JOBS
    if args.only:
        jobs = [job for job in jobs if job[0] in args.only]
    if not jobs:
        raise SystemExit("No matching Agnes jobs")
    results = []
    for index, (name, prompt_name, size) in enumerate(jobs, start=1):
        prompt_path = PROMPT_ROOT / prompt_name
        out_dir = OUTPUT_ROOT / name
        out_dir.mkdir(parents=True, exist_ok=True)
        prompt = prompt_path.read_text(encoding="utf-8")
        (out_dir / f"{name}.prompt.txt").write_text(prompt, encoding="utf-8")
        response_path = out_dir / f"{name}.response.json"
        image_path = out_dir / f"{name}.png"
        try:
            image_path.write_bytes(request_image(token, prompt, size, response_path))
            result = {"name": name, "status": "generated", "file": str(image_path), "size": size}
            print(f"generated {name}: {image_path}")
        except Exception as error:
            result = {"name": name, "status": "failed", "size": size, "error": str(error)[:500]}
            print(f"failed {name}: {result['error']}")
        results.append(result)
        if index < len(jobs):
            time.sleep(2)
    (OUTPUT_ROOT / "generation-result.json").write_text(
        json.dumps({"model": MODEL, "source": "Agnes", "results": results}, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    return 0 if all(item["status"] == "generated" for item in results) else 1


if __name__ == "__main__":
    raise SystemExit(main())
