"""Generate the fixed audio pack for the pixel dialogue story.

The local tts service chooses VoxCPM2 when engine=auto and falls back to
edge-tts when the model is unavailable. The manifest records the requested
engine and health snapshot so the result is auditable.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

import edge_tts


ROOT = Path(__file__).resolve().parents[1]
PACK = ROOT / "data" / "story-packs" / "04-pixel-dialogue-story"
DEFAULT_OUT = ROOT / "assets" / "story" / "pixel-dialogue" / "audio"
PRESET_TO_VOICE = {
    "kind_grandpa": "grandpa",
    "child": "child",
    "lively_teacher": "teacher",
    "gentle_mom": "mom",
}
EDGE_VOICES = {
    "grandpa": ("zh-CN-YunjianNeural", "-10%", "-2Hz"),
    "child": ("zh-CN-XiaoyiNeural", "-15%", "+8Hz"),
    "teacher": ("zh-CN-XiaoyiNeural", "+0%", "+6Hz"),
    "mom": ("zh-CN-XiaoxiaoNeural", "-18%", "+2Hz"),
}


def get_json(url: str, timeout: int) -> dict:
    with urlopen(Request(url, headers={"Accept": "application/json"}), timeout=timeout) as response:
        return json.loads(response.read().decode("utf-8"))


def request_audio(url: str, text: str, voice: str, engine: str, timeout: int) -> bytes:
    payload = json.dumps({"text": text, "voice": voice, "engine": engine}).encode("utf-8")
    request = Request(
        url.rstrip("/") + "/tts",
        data=payload,
        headers={"Content-Type": "application/json", "Accept": "audio/mpeg, audio/wav, application/json"},
        method="POST",
    )
    with urlopen(request, timeout=timeout) as response:
        body = response.read()
        content_type = response.headers.get("Content-Type", "")
    if "audio/" not in content_type:
        try:
            error = json.loads(body.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            error = {"error": body[:160].decode("utf-8", errors="replace")}
        raise RuntimeError(error.get("error", "TTS service returned no audio"))
    if len(body) < 256:
        raise RuntimeError("TTS response is too small to be a valid audio file")
    return body


def write_direct_edge(text: str, voice: str, target: Path) -> None:
    edge_voice, rate, pitch = EDGE_VOICES[voice]
    asyncio.run(edge_tts.Communicate(text, voice=edge_voice, rate=rate, pitch=pitch).save(str(target)))


def story_lines(manifest: dict):
    characters = manifest.get("characters", {})
    for chapter_id in manifest["chapters"]:
        chapter = json.loads((PACK / "chapters" / f"{chapter_id}.json").read_text(encoding="utf-8"))
        for scene in chapter.get("scenes", []):
            for line_index, line in enumerate(scene.get("lines", [])):
                text = (line.get("text") or line.get("prompt") or "").strip()
                if not text:
                    continue
                character = characters.get(line.get("character", ""), {})
                preset = character.get("voicePreset", "child")
                yield chapter_id, scene["sceneId"], line_index, text, PRESET_TO_VOICE.get(preset, "child")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--server-url", default="http://127.0.0.1:9885")
    parser.add_argument("--engine", choices=("auto", "voxcpm2", "edge", "direct-edge"), default="auto")
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT)
    parser.add_argument("--timeout", type=int, default=360)
    parser.add_argument("--pause-ms", type=int, default=100)
    parser.add_argument("--existing-engine", default="unknown", help="engine label for an already present file")
    args = parser.parse_args()

    manifest = json.loads((PACK / "manifest.json").read_text(encoding="utf-8"))
    if args.engine == "direct-edge":
        health = {"ok": True, "edge": True, "voxcpm2": False, "source": "local edge-tts"}
    else:
        health = get_json(args.server_url.rstrip("/") + "/health", args.timeout)
        if not health.get("ok"):
            raise RuntimeError(f"TTS service is not healthy: {health}")
    args.out.mkdir(parents=True, exist_ok=True)
    entries = {}
    failures = []
    total = 0
    for chapter_id, scene_id, line_index, text, voice in story_lines(manifest):
        total += 1
        key = f"{chapter_id}/{scene_id}/{line_index}"
        relative = Path(chapter_id) / f"{scene_id}-{line_index:02d}.mp3"
        target = args.out / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        was_existing = target.exists() and target.stat().st_size >= 256
        try:
            if not was_existing:
                if args.engine == "direct-edge":
                    write_direct_edge(text, voice, target)
                else:
                    target.write_bytes(request_audio(args.server_url, text, voice, args.engine, args.timeout))
            entries[key] = {
                "file": "assets/story/pixel-dialogue/audio/" + relative.as_posix(),
                "voice": voice,
                "engineRequested": args.engine,
                "engineActual": args.existing_engine if was_existing else args.engine,
                "bytes": target.stat().st_size,
                "text": text,
            }
            print(f"OK {key} {target.stat().st_size} bytes")
        except (HTTPError, URLError, RuntimeError, TimeoutError) as error:
            failures.append({"key": key, "error": str(error)})
            print(f"FAIL {key}: {error}")
        if args.pause_ms > 0:
            time.sleep(args.pause_ms / 1000)

    audio_manifest = {
        "schemaVersion": 1,
        "storyId": manifest["id"],
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "engineRequested": args.engine,
        "status": "complete" if not failures and len(entries) == total else "partial",
        "health": health,
        "totalLines": total,
        "generatedLines": len(entries),
        "failures": failures,
        "entries": entries,
    }
    (PACK / "audio-manifest.json").write_text(json.dumps(audio_manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"WROTE {PACK / 'audio-manifest.json'}: {len(entries)}/{total}")
    return 0 if not failures else 2


if __name__ == "__main__":
    raise SystemExit(main())
