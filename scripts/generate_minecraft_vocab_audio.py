"""Generate missing Minecraft vocabulary audio with the local VoxCPM2 model.

This script deliberately has no fallback TTS engine. It is used for producing
static learning assets, so every successful entry must be auditable as
VoxCPM2-generated WAV audio.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import wave
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
VOCAB_PATH = ROOT / "data" / "learn" / "packs" / "english-mc-hybrid-2026" / "modules" / "minecraft-vocab.json"
MANIFEST_PATH = ROOT / "data" / "vocab" / "english-minecraft" / "audio-manifest.json"
AUDIO_DIR = ROOT / "assets" / "learn" / "english-vocab" / "minecraft-audio"
AUDIO_PREFIX = "assets/learn/english-vocab/minecraft-audio/"
DEFAULT_MODEL_PATH = "D:/HuggingFaceCache/VoxCPM2"
DEFAULT_INFERENCE_TIMESTEPS = 10
VOICE_INSTRUCTION = "(clear English pronunciation, neutral pace) "


def read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8-sig"))


def write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def slug(value: str) -> str:
    value = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return value[:48] or "word"


def asset_path(relative: str) -> Path:
    return ROOT / Path(relative.replace("/", "/"))


def valid_wav(path: Path) -> tuple[int, int]:
    if not path.exists() or path.stat().st_size <= 1024:
        return 0, 0
    try:
        with wave.open(str(path), "rb") as reader:
            sample_rate = reader.getframerate()
            frames = reader.getnframes()
            return sample_rate, frames
    except (EOFError, wave.Error):
        return 0, 0


def cards_and_missing() -> tuple[dict[str, Any], list[tuple[int, dict[str, Any]]]]:
    vocab = read_json(VOCAB_PATH)
    missing: list[tuple[int, dict[str, Any]]] = []
    for index, card in enumerate(vocab.get("cards", [])):
        audio = str(card.get("audio") or "")
        if not audio or not (ROOT / Path(audio)).exists():
            missing.append((index, card))
    return vocab, missing


def target_for(index: int, word: str) -> tuple[str, Path]:
    filename = f"card-{index + 1:04d}-{slug(word)}.wav"
    return AUDIO_PREFIX + filename, AUDIO_DIR / filename


def manifest_entry(index: int, card: dict[str, Any], relative: str, path: Path, sample_rate: int, frames: int) -> dict[str, Any]:
    return {
        "cardId": str(card.get("id") or f"card-{index + 1:04d}"),
        "word": str(card.get("word") or "").strip(),
        "file": relative,
        "engine": "voxcpm2",
        "text": str(card.get("word") or "").strip(),
        "sampleRate": sample_rate,
        "durationMs": round(frames * 1000 / sample_rate, 2) if sample_rate else 0,
        "bytes": path.stat().st_size,
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true", help="generate audio and update the vocabulary JSON")
    parser.add_argument("--dry-run", action="store_true", help="print the missing-card plan without loading VoxCPM2")
    parser.add_argument("--limit", type=int, default=0, help="process at most N missing cards; useful for a smoke run")
    parser.add_argument("--model-path", default=DEFAULT_MODEL_PATH)
    parser.add_argument("--inference-timesteps", type=int, default=DEFAULT_INFERENCE_TIMESTEPS)
    return parser.parse_args()


def generate_audio(model: Any, text: str, output: Path, inference_timesteps: int) -> tuple[int, int]:
    import soundfile as sf

    output.parent.mkdir(parents=True, exist_ok=True)
    wav = model.generate(
        text=VOICE_INSTRUCTION + text,
        cfg_value=2.0,
        inference_timesteps=inference_timesteps,
    )
    sample_rate = int(model.tts_model.sample_rate)
    sf.write(str(output), wav, sample_rate, format="WAV", subtype="PCM_16")
    actual_rate, frames = valid_wav(output)
    if not actual_rate or not frames:
        raise RuntimeError(f"invalid WAV output: {output}")
    return actual_rate, frames


def model_load_options(model_path: str) -> dict[str, Any]:
    return {
        "hf_model_id": model_path,
        "load_denoiser": False,
        "optimize": False,
        "device": "cuda",
    }


def load_model(model_path: str) -> Any:
    try:
        from voxcpm import VoxCPM
    except ImportError as error:
        raise RuntimeError("voxcpm is not installed in the active Python environment") from error
    return VoxCPM.from_pretrained(**model_load_options(model_path))


def main() -> int:
    args = parse_args()
    vocab, missing = cards_and_missing()
    plan = {
        "totalCards": len(vocab.get("cards", [])),
        "existingAudio": len(vocab.get("cards", [])) - len(missing),
        "missingAudio": len(missing),
        "cards": [
            {"index": index, "cardId": card.get("id", ""), "word": card.get("word", "")}
            for index, card in missing
        ],
    }
    if args.dry_run or not args.apply:
        print(json.dumps(plan, ensure_ascii=False, indent=2))
        return 0
    if args.limit < 0:
        raise SystemExit("--limit must be >= 0")
    if not missing:
        print(json.dumps({**plan, "status": "already-complete"}, ensure_ascii=False, indent=2))
        return 0

    selected = missing[: args.limit] if args.limit else missing
    previous = read_json(MANIFEST_PATH) if MANIFEST_PATH.exists() else {}
    entries_by_id = {str(item.get("cardId")): item for item in previous.get("entries", [])}
    failures: list[dict[str, str]] = []
    model = None

    for index, card in selected:
        word = str(card.get("word") or "").strip()
        card_id = str(card.get("id") or f"card-{index + 1:04d}")
        relative, output = target_for(index, word)
        try:
            sample_rate, frames = valid_wav(output)
            if not sample_rate or not frames:
                if model is None:
                    print(f"Loading VoxCPM2 from {args.model_path}", flush=True)
                    model = load_model(args.model_path)
                sample_rate, frames = generate_audio(model, word, output, args.inference_timesteps)
            entries_by_id[card_id] = manifest_entry(index, card, relative, output, sample_rate, frames)
            card["audio"] = relative
            card["audioSource"] = "voxcpm2"
            card["audioType"] = "wav"
            print(f"OK {index + 1}/{len(missing)} {word} {frames} frames", flush=True)
        except Exception as error:  # keep the batch resumable and auditable
            failures.append({"cardId": card_id, "word": word, "error": str(error)})
            print(f"FAIL {card_id} {word}: {error}", file=sys.stderr, flush=True)

    entries = sorted(entries_by_id.values(), key=lambda item: item["cardId"])
    complete = not failures and len(entries) == len(missing)
    manifest = {
        "schemaVersion": 1,
        "vocabId": vocab.get("id", "minecraft-vocab"),
        "engine": "voxcpm2",
        "voiceInstruction": VOICE_INSTRUCTION.strip(),
        "status": "complete" if complete else "partial",
        "generatedCount": len(entries),
        "targetMissingCount": len(missing),
        "totalCards": len(vocab.get("cards", [])),
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "modelPath": args.model_path,
        "inferenceTimesteps": args.inference_timesteps,
        "failures": failures,
        "entries": entries,
    }
    write_json(MANIFEST_PATH, manifest)
    if complete:
        write_json(VOCAB_PATH, vocab)
    print(json.dumps({"status": manifest["status"], "generatedCount": len(entries), "failures": len(failures)}, ensure_ascii=False))
    return 0 if complete else 2


if __name__ == "__main__":
    raise SystemExit(main())
