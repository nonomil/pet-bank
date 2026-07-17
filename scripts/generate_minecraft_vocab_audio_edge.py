"""Fill missing Minecraft vocabulary audio with Edge-TTS.

This is a resumable static-asset generator. It only handles cards whose
current audio path is missing and records the exact engine and voice in the
manifest and card data.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
VOCAB_PATH = ROOT / "data" / "learn" / "packs" / "english-mc-hybrid-2026" / "modules" / "minecraft-vocab.json"
MANIFEST_PATH = ROOT / "data" / "vocab" / "english-minecraft" / "audio-manifest.json"
AUDIO_DIR = ROOT / "assets" / "learn" / "english-vocab" / "minecraft-audio"
AUDIO_PREFIX = "assets/learn/english-vocab/minecraft-audio/"
VOICE = "en-US-AnaNeural"


def read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8-sig"))


def write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def slug(value: str) -> str:
    value = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return value[:48] or "word"


def local_path(relative: str) -> Path:
    return ROOT / Path(relative.replace("/", "/"))


def valid_audio(path: Path) -> bool:
    return path.exists() and path.stat().st_size > 1024


def missing_cards(vocab: dict[str, Any]) -> list[tuple[int, dict[str, Any]]]:
    result = []
    for index, card in enumerate(vocab.get("cards", [])):
        audio = str(card.get("audio") or "")
        if not audio or not valid_audio(local_path(audio)):
            result.append((index, card))
    return result


def target_for(index: int, word: str) -> tuple[str, Path]:
    filename = f"card-{index + 1:04d}-{slug(word)}.mp3"
    return AUDIO_PREFIX + filename, AUDIO_DIR / filename


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--limit", type=int, default=0)
    parser.add_argument("--concurrency", type=int, default=3)
    return parser.parse_args()


async def generate_one(index: int, card: dict[str, Any], semaphore: asyncio.Semaphore) -> dict[str, Any]:
    import edge_tts

    word = str(card.get("word") or "").strip()
    card_id = str(card.get("id") or f"card-{index + 1:04d}")
    relative, output = target_for(index, word)
    async with semaphore:
        if not valid_audio(output):
            output.parent.mkdir(parents=True, exist_ok=True)
            communicate = edge_tts.Communicate(word, VOICE, rate="-8%")
            await communicate.save(str(output))
    if not valid_audio(output):
        raise RuntimeError(f"generated audio is missing or too small: {output}")
    return {
        "cardId": card_id,
        "word": word,
        "file": relative,
        "engine": "edge-tts",
        "voice": VOICE,
        "text": word,
        "bytes": output.stat().st_size,
    }


async def run(args: argparse.Namespace) -> int:
    vocab = read_json(VOCAB_PATH)
    missing = missing_cards(vocab)
    plan = {
        "totalCards": len(vocab.get("cards", [])),
        "existingAudio": len(vocab.get("cards", [])) - len(missing),
        "missingAudio": len(missing),
        "voice": VOICE,
        "engine": "edge-tts",
        "cards": [{"index": index, "word": card.get("word", "")} for index, card in missing],
    }
    if args.dry_run or not args.apply:
        print(json.dumps(plan, ensure_ascii=False, indent=2))
        return 0
    if args.limit < 0 or args.concurrency < 1:
        raise SystemExit("--limit must be >= 0 and --concurrency must be >= 1")

    selected = missing[: args.limit] if args.limit else missing
    semaphore = asyncio.Semaphore(args.concurrency)
    tasks = [generate_one(index, card, semaphore) for index, card in selected]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    entries = []
    failures = []
    by_id = {str(entry.get("cardId")): entry for entry in entries}
    for (index, card), result in zip(selected, results):
        card_id = str(card.get("id") or f"card-{index + 1:04d}")
        if isinstance(result, Exception):
            failures.append({"cardId": card_id, "word": card.get("word", ""), "error": str(result)})
            continue
        card["audio"] = result["file"]
        card["audioSource"] = "edge-tts"
        card["audioVoice"] = VOICE
        card["audioType"] = "mp3"
        by_id[card_id] = result

    entries = sorted(by_id.values(), key=lambda entry: entry["cardId"])
    complete = not failures and len(entries) == len(missing)
    manifest = {
        "schemaVersion": 1,
        "vocabId": vocab.get("id", "minecraft-vocab"),
        "engine": "edge-tts",
        "voice": VOICE,
        "status": "complete" if complete else "partial",
        "generatedCount": len(entries),
        "targetMissingCount": len(missing),
        "totalCards": len(vocab.get("cards", [])),
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "failures": failures,
        "entries": entries,
    }
    write_json(MANIFEST_PATH, manifest)
    if complete:
        write_json(VOCAB_PATH, vocab)
    print(json.dumps({"status": manifest["status"], "generatedCount": len(entries), "failures": len(failures), "voice": VOICE}, ensure_ascii=False))
    return 0 if complete else 2


if __name__ == "__main__":
    raise SystemExit(asyncio.run(run(parse_args())))
