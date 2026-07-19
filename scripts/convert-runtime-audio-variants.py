"""Generate and validate compressed publish variants for runtime audio.

Source WAV files stay available for local development. Pages publishes the
adjacent OGG/Opus variants instead, which keeps the browser-facing artifact
small without changing the local high-quality source path.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

try:
    import soundfile as sf
except ImportError as error:  # pragma: no cover - environment guard
    raise SystemExit("soundfile is required: python -m pip install soundfile") from error


ROOT = Path(__file__).resolve().parents[1]
CONFIG_PATH = ROOT / "scripts" / "runtime-audio-variants.json"
RUNTIME_MANIFEST_DIR = ROOT / "scripts" / "runtime-asset-manifests"
CHUNK_FRAMES = 262_144
DURATION_TOLERANCE_SECONDS = 0.1


def load_config() -> dict:
    config = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    if config.get("version") != 1 or not config.get("sets"):
        raise ValueError("runtime-audio-variants.json must contain version 1 sets")
    return config


def load_manifest_audio_sets() -> dict:
    audio_sets = {}
    for manifest_path in sorted(RUNTIME_MANIFEST_DIR.glob("*.json")):
        try:
            manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            continue
        for audio_set in manifest.get("audioSets", []):
            if audio_set.get("id"):
                audio_sets[audio_set["id"]] = audio_set
    return audio_sets


def resolve_include_patterns(audio_set: dict, manifest_audio_sets: dict) -> list[str]:
    manifest_set = manifest_audio_sets.get(audio_set.get("manifestSet"))
    include_from_data = (manifest_set or {}).get("includeFromData") or audio_set.get("includeFromData")
    if include_from_data:
        data_paths = include_from_data if isinstance(include_from_data, list) else [include_from_data]
        source_dir = (manifest_set or audio_set)["sourceDir"].replace("\\", "/").rstrip("/") + "/"
        patterns = set()
        for relative_path in data_paths:
            module_path = ROOT / relative_path
            module = json.loads(module_path.read_text(encoding="utf-8"))
            for card in module.get("cards", []):
                values = [card.get("audio")]
                values.extend((card.get("narrationAudio") or {}).values())
                for value in values:
                    relative = str(value or "").replace("\\", "/")
                    if relative.startswith(source_dir):
                        patterns.add(relative[len(source_dir):])
        return sorted(patterns)
    return (manifest_set or {}).get("include") or audio_set.get("include") or []


def iter_entries(config: dict):
    seen: set[Path] = set()
    manifest_audio_sets = load_manifest_audio_sets()
    for audio_set in config["sets"]:
        source_dir = ROOT / audio_set["sourceDir"]
        if not source_dir.is_dir():
            raise FileNotFoundError(f"missing source directory: {audio_set['sourceDir']}")
        extension = audio_set.get("extension", ".ogg")
        if not extension.startswith("."):
            extension = f".{extension}"
        for pattern in resolve_include_patterns(audio_set, manifest_audio_sets):
            for source in sorted(source_dir.glob(pattern)):
                if not source.is_file() or source in seen:
                    continue
                seen.add(source)
                relative = source.relative_to(source_dir).as_posix()
                runtime_path = f"{audio_set['runtimePrefix'].rstrip('/')}/{relative}"
                variant = source.with_suffix(extension)
                yield audio_set, source, variant, runtime_path


def audio_info(path: Path):
    try:
        return sf.info(str(path))
    except (OSError, RuntimeError, ValueError):
        return None


def is_valid_variant(source: Path, variant: Path, audio_set: dict) -> bool:
    if not variant.is_file() or variant.stat().st_size < 256:
        return False
    source_info = audio_info(source)
    variant_info = audio_info(variant)
    if source_info is None or variant_info is None:
        return False
    if variant_info.format != audio_set.get("format", "OGG"):
        return False
    if variant_info.subtype != audio_set.get("subtype", "OPUS"):
        return False
    if variant_info.channels != source_info.channels:
        return False
    if abs(variant_info.duration - source_info.duration) > DURATION_TOLERANCE_SECONDS:
        return False
    return variant.stat().st_size < source.stat().st_size


def convert(source: Path, variant: Path, audio_set: dict, force: bool) -> bool:
    if (
        not force
        and variant.exists()
        and variant.stat().st_mtime_ns >= source.stat().st_mtime_ns
        and is_valid_variant(source, variant, audio_set)
    ):
        return False

    variant.parent.mkdir(parents=True, exist_ok=True)
    temporary = variant.with_name(f".{variant.name}.tmp")
    temporary.unlink(missing_ok=True)
    try:
        with sf.SoundFile(str(source), mode="r") as reader:
            with sf.SoundFile(
                str(temporary),
                mode="w",
                samplerate=reader.samplerate,
                channels=reader.channels,
                format=audio_set.get("format", "OGG"),
                subtype=audio_set.get("subtype", "OPUS"),
            ) as writer:
                while True:
                    frames = reader.read(
                        frames=CHUNK_FRAMES,
                        dtype="float32",
                        always_2d=True,
                    )
                    if len(frames) == 0:
                        break
                    writer.write(frames)
        os.replace(temporary, variant)
    except Exception:
        temporary.unlink(missing_ok=True)
        raise
    return True


def validate(config: dict) -> tuple[int, int, int]:
    checked = 0
    missing = 0
    larger = 0
    for audio_set, source, variant, _runtime_path in iter_entries(config):
        checked += 1
        if not variant.is_file() or not is_valid_variant(source, variant, audio_set):
            if not variant.is_file() or audio_info(variant) is None:
                print(f"MISSING_AUDIO_VARIANT {variant.relative_to(ROOT).as_posix()}")
                missing += 1
            elif variant.stat().st_size >= source.stat().st_size:
                print(
                    f"LARGER_THAN_SOURCE {variant.relative_to(ROOT).as_posix()} "
                    f"{variant.stat().st_size} >= {source.stat().st_size}"
                )
                larger += 1
            else:
                print(f"INVALID_AUDIO_VARIANT {variant.relative_to(ROOT).as_posix()}")
                missing += 1
    return checked, missing, larger


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--write", action="store_true", help="generate missing or stale variants")
    parser.add_argument("--force", action="store_true", help="regenerate all variants with --write")
    parser.add_argument("--check", action="store_true", help="validate all configured variants")
    args = parser.parse_args()
    if not args.write and not args.check:
        parser.error("choose --write or --check")

    config = load_config()
    generated = 0
    if args.write:
        for audio_set, source, variant, _runtime_path in iter_entries(config):
            if convert(source, variant, audio_set, args.force):
                generated += 1
        print(f"[runtime-audio-variants] generated={generated}")

    if args.check:
        checked, missing, larger = validate(config)
        print(f"[runtime-audio-variants] checked={checked} missing={missing} larger={larger}")
        if missing or larger:
            return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
