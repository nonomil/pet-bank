"""Generate resumable bilingual narration clips for Minecraft vocabulary cards.

The existing card audio remains the word-level fallback. This generator adds
phrase, sentence, and Chinese translation clips without changing the original
Anki/Edge-TTS word files. Edge-TTS is the practical full-pool engine; VoxCPM2
is available with ``--engine voxcpm2`` for local high-quality regeneration.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import re
import time
import sys
import wave
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
VOCAB_PATH = ROOT / "data" / "learn" / "packs" / "english-mc-hybrid-2026" / "modules" / "minecraft-vocab.json"
MANIFEST_PATH = ROOT / "data" / "vocab" / "english-minecraft" / "narration-manifest.json"
AUDIO_DIR = ROOT / "assets" / "learn" / "english-vocab" / "minecraft-narration"
AUDIO_PREFIX = "assets/learn/english-vocab/minecraft-narration/"
DEFAULT_MODEL_PATH = "D:/HuggingFaceCache/VoxCPM2"
ENGLISH_VOICE = "en-US-AnaNeural"
CHINESE_VOICE = "zh-CN-XiaoxiaoNeural"

FIELDS = (
    ("phrase", "phrase", ENGLISH_VOICE, "-8%"),
    ("sentence", "sentence", ENGLISH_VOICE, "-8%"),
    ("translation", "translation", CHINESE_VOICE, "-5%"),
    ("phraseTranslation", "phraseTranslation", CHINESE_VOICE, "-5%"),
    ("sentenceTranslation", "sentenceTranslation", CHINESE_VOICE, "-5%"),
)
ALL_KEYS = ("word", *(item[0] for item in FIELDS))


def read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8-sig"))


def write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = json.dumps(value, ensure_ascii=False, indent=2) + "\n"
    temp_path = path.with_name(f".{path.name}.{os.getpid()}.tmp")
    for attempt in range(3):
        try:
            temp_path.write_text(payload, encoding="utf-8")
            os.replace(temp_path, path)
            return
        except OSError:
            if temp_path.exists():
                temp_path.unlink()
            if attempt == 2:
                raise
            time.sleep(0.25 * (attempt + 1))


def slug(value: str) -> str:
    value = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return value[:48] or "word"


def local_path(relative: str) -> Path:
    return ROOT / Path(relative.replace("/", "/"))


def valid_audio(path: Path) -> bool:
    if not path.exists() or path.stat().st_size <= 1024:
        return False
    if path.suffix.lower() != ".wav":
        return True
    try:
        with wave.open(str(path), "rb") as reader:
            return reader.getnframes() > 0 and reader.getframerate() > 0
    except (EOFError, wave.Error):
        return False


def card_text(card: dict[str, Any], key: str) -> str:
    aliases = {
        "sentence": ("sentence", "example"),
        "sentenceTranslation": ("sentenceTranslation", "exampleTranslation", "exampleZh"),
    }
    for field in aliases.get(key, (key,)):
        value = str(card.get(field) or "").strip()
        if value:
            return value
    return ""


def target_for(index: int, word: str, key: str, extension: str) -> tuple[str, Path]:
    filename = f"card-{index + 1:04d}-{slug(word)}-{slug(key)}.{extension}"
    return AUDIO_PREFIX + filename, AUDIO_DIR / filename


def load_previous_entries() -> dict[str, dict[str, Any]]:
    if not MANIFEST_PATH.exists():
        return {}
    previous = read_json(MANIFEST_PATH)
    return {str(entry.get("cardId")): entry for entry in previous.get("entries", []) if entry.get("cardId")}


def make_entry(index: int, card: dict[str, Any], files: dict[str, str], engines: dict[str, str], voices: dict[str, str]) -> dict[str, Any]:
    return {
        "cardId": str(card.get("id") or f"card-{index + 1:04d}"),
        "word": str(card.get("word") or "").strip(),
        "texts": {key: str(card.get("word") or "").strip() if key == "word" else card_text(card, key) for key in ALL_KEYS},
        "files": files,
        "engines": engines,
        "voices": voices,
    }


def entry_is_complete(entry: dict[str, Any], card: dict[str, Any] | None = None) -> bool:
    files = entry.get("files") or {}
    if not all(key in files and valid_audio(local_path(str(files[key]))) for key in ALL_KEYS):
        return False
    if card is None:
        return True
    expected_texts = {
        key: str(card.get("word") or "").strip() if key == "word" else card_text(card, key)
        for key in ALL_KEYS
    }
    actual_texts = entry.get("texts") or {}
    return all(str(actual_texts.get(key) or "").strip() == value for key, value in expected_texts.items())


def manifest_status(complete_count: int, total_cards: int, failures: list[dict[str, str]], phase: str = "idle") -> str:
    if phase == "in-progress":
        return "in-progress"
    return "complete" if complete_count == total_cards and not failures else "partial"


def current_entry(index: int, card: dict[str, Any], previous: dict[str, Any] | None) -> dict[str, Any] | None:
    files = dict((previous or {}).get("files") or {})
    engines = dict((previous or {}).get("engines") or {})
    voices = dict((previous or {}).get("voices") or {})
    word_audio = str((card.get("narrationAudio") or {}).get("word") or card.get("audio") or "").strip()
    if word_audio and valid_audio(local_path(word_audio)):
        files["word"] = word_audio
        engines.setdefault("word", str(card.get("audioSource") or "existing"))
        voices.setdefault("word", str(card.get("audioVoice") or ""))
    entry = make_entry(index, card, files, engines, voices)
    return entry if entry_is_complete(entry, card) else None


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true", help="generate clips and update JSON files")
    parser.add_argument("--dry-run", action="store_true", help="print the generation plan without loading a TTS engine")
    parser.add_argument("--engine", choices=("edge-tts", "voxcpm2"), default="edge-tts")
    parser.add_argument("--limit", type=int, default=0, help="process at most N cards")
    parser.add_argument("--start", type=int, default=0, help="zero-based card index to start from")
    parser.add_argument("--concurrency", type=int, default=6, help="Edge-TTS concurrency")
    parser.add_argument("--batch-size", type=int, default=24, help="number of cards scheduled together for Edge-TTS")
    parser.add_argument("--model-path", default=DEFAULT_MODEL_PATH)
    parser.add_argument("--inference-timesteps", type=int, default=10)
    parser.add_argument("--replace-word", action="store_true", help="also regenerate the existing word clip")
    parser.add_argument("--refresh-text", action="store_true", help="regenerate phrase/sentence/translation clips even when files already exist")
    parser.add_argument("--refresh-sentence", action="store_true", help="regenerate sentence and Chinese sentence clips even when files already exist")
    return parser.parse_args()


async def generate_edge(text: str, voice: str, rate: str, output: Path, semaphore: asyncio.Semaphore) -> None:
    import edge_tts

    async with semaphore:
        if valid_audio(output):
            return
        output.parent.mkdir(parents=True, exist_ok=True)
        await edge_tts.Communicate(text, voice, rate=rate).save(str(output))
    if not valid_audio(output):
        raise RuntimeError(f"generated audio is missing or too small: {output}")


def load_voxcpm2(model_path: str) -> Any:
    try:
        from voxcpm import VoxCPM
    except ImportError as error:
        raise RuntimeError("voxcpm is not installed in the active Python environment") from error
    return VoxCPM.from_pretrained(
        hf_model_id=model_path,
        load_denoiser=False,
        optimize=False,
        device="cuda",
    )


def generate_voxcpm2(model: Any, text: str, output: Path, timesteps: int, chinese: bool) -> None:
    import soundfile as sf

    instruction = "(clear natural pronunciation, neutral pace) "
    if chinese:
        instruction = "(clear Mandarin pronunciation, neutral pace) "
    output.parent.mkdir(parents=True, exist_ok=True)
    wav = model.generate(text=instruction + text, cfg_value=2.0, inference_timesteps=timesteps)
    sf.write(str(output), wav, int(model.tts_model.sample_rate), format="WAV", subtype="PCM_16")
    if not valid_audio(output):
        raise RuntimeError(f"generated audio is invalid: {output}")


async def run(args: argparse.Namespace) -> int:
    if args.limit < 0 or args.start < 0 or args.concurrency < 1 or args.batch_size < 1:
        raise SystemExit("--limit/--start must be >= 0; --concurrency/--batch-size must be >= 1")
    vocab = read_json(VOCAB_PATH)
    cards = list(vocab.get("cards", []))
    previous = load_previous_entries()
    complete_before = sum(1 for index, card in enumerate(cards) if current_entry(index, card, previous.get(str(card.get("id")))) is not None)
    selected = cards[args.start:]
    if args.limit:
        selected = selected[: args.limit]
    plan = {
        "totalCards": len(cards),
        "clipsPerCard": len(ALL_KEYS),
        "completeCardsBefore": complete_before,
        "selectedCards": len(selected),
        "engine": args.engine,
        "reuseExistingWordAudio": not args.replace_word,
    }
    if args.dry_run or not args.apply:
        print(json.dumps(plan, ensure_ascii=False, indent=2))
        return 0

    failures: list[dict[str, str]] = []
    entries_by_id = dict(previous)
    cards_by_id = {str(card.get("id") or f"card-{index + 1:04d}"): card for index, card in enumerate(cards)}
    model = None
    semaphore = asyncio.Semaphore(args.concurrency)

    async def save_progress(phase: str = "idle") -> None:
        entries = sorted(entries_by_id.values(), key=lambda item: str(item.get("cardId")))
        complete_count = sum(
            1 for card_id, card in cards_by_id.items()
            if entry_is_complete(entries_by_id.get(card_id) or {}, card)
        )
        manifest = {
            "schemaVersion": 1,
            "vocabId": vocab.get("id", "minecraft-vocab"),
            "status": manifest_status(complete_count, len(cards), failures, phase),
            "engine": args.engine,
            "clipsPerCard": len(ALL_KEYS),
            "totalCards": len(cards),
            "generatedCount": complete_count,
            "generatedClipCount": complete_count * len(ALL_KEYS),
            "generatedAt": datetime.now(timezone.utc).isoformat(),
            "failures": failures,
            "entries": entries,
        }
        write_json(MANIFEST_PATH, manifest)

    def refresh_entry_texts(entry: dict[str, Any], card: dict[str, Any]) -> dict[str, Any]:
        entry["word"] = str(card.get("word") or "").strip()
        entry["texts"] = {
            key: str(card.get("word") or "").strip() if key == "word" else card_text(card, key)
            for key in ALL_KEYS
        }
        return entry

    def prepare_context(index: int, card: dict[str, Any]) -> dict[str, Any]:
        card_id = str(card.get("id") or f"card-{index + 1:04d}")
        files = dict((entries_by_id.get(card_id) or {}).get("files") or {})
        engines = dict((entries_by_id.get(card_id) or {}).get("engines") or {})
        voices = dict((entries_by_id.get(card_id) or {}).get("voices") or {})
        existing_word = str((card.get("narrationAudio") or {}).get("word") or card.get("audio") or "").strip()
        if existing_word and valid_audio(local_path(existing_word)) and not args.replace_word:
            files["word"] = existing_word
            engines["word"] = str(card.get("audioSource") or "existing")
            voices["word"] = str(card.get("audioVoice") or "")
        return {
            "index": index,
            "card": card,
            "cardId": card_id,
            "word": str(card.get("word") or "").strip(),
            "files": files,
            "engines": engines,
            "voices": voices,
        }

    async def process_edge_batch(pairs: list[tuple[int, dict[str, Any]]]) -> None:
        contexts = [prepare_context(index, card) for index, card in pairs]
        tasks = []
        for context in contexts:
            for key, field, voice, rate in FIELDS:
                text_value = card_text(context["card"], field)
                if not text_value:
                    failures.append({"cardId": context["cardId"], "key": key, "error": f"missing text field: {field}"})
                    continue
                relative, output = target_for(context["index"], context["word"], key, "mp3")
                refresh_current = (
                    (args.refresh_text and key != "word")
                    or (args.refresh_sentence and key in {"sentence", "sentenceTranslation"})
                )
                if refresh_current and output.exists():
                    output.unlink()
                tasks.append((context, key, relative, output, generate_edge(text_value, voice, rate, output, semaphore)))
        results = await asyncio.gather(*(task[4] for task in tasks), return_exceptions=True)
        for task, result in zip(tasks, results):
            context, key, relative, output, _ = task
            if isinstance(result, Exception):
                failures.append({"cardId": context["cardId"], "key": key, "error": str(result)})
            elif valid_audio(output):
                context["files"][key] = relative
                context["engines"][key] = "edge-tts"
                context["voices"][key] = next(item[2] for item in FIELDS if item[0] == key)
        for context in contexts:
            entry = make_entry(context["index"], context["card"], context["files"], context["engines"], context["voices"])
            entry = refresh_entry_texts(entry, context["card"])
            entries_by_id[context["cardId"]] = entry
            if entry_is_complete(entry, context["card"]):
                context["card"]["narrationAudio"] = context["files"]
                context["card"]["narrationAudioSource"] = args.engine
                print(f"OK {context['index'] + 1}/{len(cards)} {context['word']}", flush=True)
            else:
                print(f"PARTIAL {context['index'] + 1}/{len(cards)} {context['word']}", flush=True)

    await save_progress("in-progress")

    if args.engine == "edge-tts":
        for batch_start in range(0, len(selected), args.batch_size):
            batch = list(enumerate(selected[batch_start:batch_start + args.batch_size], start=args.start + batch_start))
            await process_edge_batch(batch)
            await save_progress("in-progress")
            write_json(VOCAB_PATH, vocab)
    else:
        for offset, card in enumerate(selected, start=args.start):
            context = prepare_context(offset, card)
            for key, field, voice, rate in FIELDS:
                text_value = card_text(card, field)
                if not text_value:
                    failures.append({"cardId": context["cardId"], "key": key, "error": f"missing text field: {field}"})
                    continue
                relative, output = target_for(offset, context["word"], key, "wav")
                if args.refresh_text and key != "word" and output.exists():
                    output.unlink()
                if model is None:
                    print(f"Loading VoxCPM2 from {args.model_path}", flush=True)
                    model = load_voxcpm2(args.model_path)
                try:
                    generate_voxcpm2(model, text_value, output, args.inference_timesteps, voice == CHINESE_VOICE)
                    context["files"][key] = relative
                    context["engines"][key] = "voxcpm2"
                    context["voices"][key] = voice
                except Exception as error:
                    failures.append({"cardId": context["cardId"], "key": key, "error": str(error)})
            entry = make_entry(offset, card, context["files"], context["engines"], context["voices"])
            entry = refresh_entry_texts(entry, card)
            entries_by_id[context["cardId"]] = entry
            if entry_is_complete(entry, card):
                card["narrationAudio"] = context["files"]
                card["narrationAudioSource"] = args.engine
                print(f"OK {offset + 1}/{len(cards)} {context['word']}", flush=True)
            else:
                print(f"PARTIAL {offset + 1}/{len(cards)} {context['word']}", flush=True)
            if (offset - args.start + 1) % 16 == 0 or offset == args.start + len(selected) - 1:
                await save_progress("in-progress")
                write_json(VOCAB_PATH, vocab)

    for index, card in enumerate(cards):
        card_id = str(card.get("id") or f"card-{index + 1:04d}")
        existing = entries_by_id.get(card_id)
        if not existing:
            continue
        refreshed = refresh_entry_texts(dict(existing), card)
        entries_by_id[card_id] = refreshed
        if entry_is_complete(refreshed, card):
            card["narrationAudio"] = refreshed["files"]
            card["narrationAudioSource"] = refreshed.get("engines", {}).get("sentence", args.engine)

    await save_progress()
    write_json(VOCAB_PATH, vocab)
    complete_count = sum(
        1 for card_id, card in cards_by_id.items()
        if entry_is_complete(entries_by_id.get(card_id) or {}, card)
    )
    status = manifest_status(complete_count, len(cards), failures)
    print(json.dumps({"status": status, "completeCards": complete_count, "totalCards": len(cards), "failures": len(failures)}, ensure_ascii=False))
    return 0 if status == "complete" else 2


if __name__ == "__main__":
    raise SystemExit(asyncio.run(run(parse_args())))
