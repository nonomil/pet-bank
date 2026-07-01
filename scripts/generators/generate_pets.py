#!/usr/bin/env python3
"""Generate 8 PVZ/Minecraft style pet images via Agnes AI."""
import os
import json
import urllib.request
import urllib.error
import time
import base64

API_KEY = "sk-dbN...VkcC"  # from /home/deploy/.hermes/config.yaml
BASE_URL = "https://apihub.agnes-ai.com/v1"
MODEL = "agnes-image-2.1-flash"
OUT_DIR = "/tmp/pet-bank/assets/pets"

PETS = [
    ("dog.png", "brown Shiba Inu, Minecraft blocky voxel style, wearing small red scarf"),
    ("cat.png", "orange tabby cat, PVZ Plants vs Zombies cartoon style, big round eyes"),
    ("rabbit.png", "white bunny rabbit, PVZ Plants vs Zombies cartoon style, long ears standing up"),
    ("turtle.png", "green turtle, Minecraft blocky voxel style, carrying shell on back"),
    ("hamster.png", "golden hamster, PVZ Plants vs Zombies cartoon style, round chubby cheeks"),
    ("parrot.png", "colorful rainbow parrot, PVZ Plants vs Zombies cartoon style, perched on tree branch"),
    ("fish.png", "red and gold koi goldfish, cute cartoon style, swimming in water"),
    ("hedgehog.png", "brown hedgehog, Minecraft blocky voxel style, with spikes on back"),
]

PROMPT_TEMPLATE = (
    "Pixel art pet character in Plants vs Zombies meets Minecraft style, {desc}, "
    "chibi cute, transparent background, game sprite, 256x256 pixels, vibrant colors, "
    "simple clean design, centered composition"
)


def gen_one(name: str, desc: str) -> dict:
    prompt = PROMPT_TEMPLATE.format(desc=desc)
    url = f"{BASE_URL}/images/generations"
    body = json.dumps({
        "model": MODEL,
        "prompt": prompt,
        "n": 1,
        "size": "256x256",
        "response_format": "b64_json",
    }).encode()

    req = urllib.request.Request(
        url,
        data=body,
        headers={
            "Authorization": f"Bearer {API_KEY}",
            "Content-Type": "application/json",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            data = json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        err = e.read().decode(errors="replace")
        return {"ok": False, "name": name, "error": f"HTTP {e.code}: {err[:500]}"}
    except Exception as e:
        return {"ok": False, "name": name, "error": str(e)}

    # Extract b64
    try:
        item = data["data"][0]
        if "b64_json" in item:
            img_bytes = base64.b64decode(item["b64_json"])
        elif "url" in item:
            with urllib.request.urlopen(item["url"], timeout=60) as r:
                img_bytes = r.read()
        else:
            return {"ok": False, "name": name, "error": f"no image data: {str(item)[:200]}"}
    except Exception as e:
        return {"ok": False, "name": name, "error": f"parse: {e} - raw: {str(data)[:300]}"}

    out_path = os.path.join(OUT_DIR, name)
    with open(out_path, "wb") as f:
        f.write(img_bytes)
    return {
        "ok": True,
        "name": name,
        "path": out_path,
        "size_bytes": len(img_bytes),
        "size_kb": round(len(img_bytes) / 1024, 1),
    }


def main():
    results = []
    for name, desc in PETS:
        out_path = os.path.join(OUT_DIR, name)
        # Skip if existing valid file > 1KB
        if os.path.exists(out_path) and os.path.getsize(out_path) > 1024:
            sz = os.path.getsize(out_path)
            results.append({"ok": True, "name": name, "path": out_path,
                            "size_kb": round(sz/1024, 1), "skipped": True})
            print(f"  [skip] {name} already exists ({round(sz/1024,1)}KB)")
            continue

        print(f"  [gen ] {name}: {desc[:60]}...")
        r = gen_one(name, desc)
        results.append(r)
        if r["ok"]:
            print(f"         -> {r['path']} ({r['size_kb']}KB)")
        else:
            print(f"         FAILED: {r['error'][:200]}")
        time.sleep(0.5)

    # Summary
    print("\n=== Summary ===")
    ok = sum(1 for r in results if r["ok"])
    print(f"OK: {ok}/{len(results)}")
    for r in results:
        status = "OK" if r["ok"] else "FAIL"
        extra = f"({r['size_kb']}KB)" if r["ok"] else f"({r.get('error','')[:100]})"
        print(f"  [{status}] {r['name']:14s} {extra}")

    return 0 if ok == len(results) else 1


if __name__ == "__main__":
    raise SystemExit(main())