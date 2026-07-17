"""Split existing VoxCPM node audio into one playable file per story line."""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import soundfile as sf


ROOT = Path(__file__).resolve().parents[1]
PACK = ROOT / "data" / "story-packs" / "05-pixel-worlds-story"
LEVELS = PACK / "levels"
ASSET_ROOT = ROOT / "assets" / "story" / "pixel-worlds-v1" / "audio"


def readable_scenes(level: dict) -> list[dict]:
    scenes = []
    for scene in level.get("scenes", []):
        lines = []
        for line in scene.get("lines", []):
            text = str(line.get("text") or line.get("prompt") or "").strip()
            if text:
                lines.append(text)
        scenes.append({"sceneId": scene.get("sceneId", "scene"), "lines": lines})
    return scenes


def silence_centers(audio: np.ndarray, sample_rate: int) -> list[int]:
    mono = np.mean(np.abs(audio), axis=1) if audio.ndim > 1 else np.abs(audio)
    threshold = max(0.0015, float(np.percentile(mono, 20)) * 1.8)
    silent = mono <= threshold
    minimum = max(1, int(sample_rate * 0.12))
    centers = []
    index = 0
    while index < len(silent):
        if not silent[index]:
            index += 1
            continue
        end = index
        while end < len(silent) and silent[end]:
            end += 1
        if end - index >= minimum:
            centers.append((index + end) // 2)
        index = end
    return centers


def choose_boundaries(audio: np.ndarray, sample_rate: int, lines: list[str]) -> list[int]:
    total = len(audio)
    if len(lines) <= 1:
        return [0, total]
    pauses = silence_centers(audio, sample_rate)
    if len(pauses) < len(lines) - 1:
        pauses = [int(total * index / len(lines)) for index in range(1, len(lines))]
    weights = np.array([max(1, len(text)) for text in lines], dtype=float)
    targets = np.cumsum(weights)[:-1] / weights.sum() * total
    selected = []
    previous = 0
    remaining = len(lines) - 1
    minimum = max(1, int(sample_rate * 0.35))
    if total < minimum * len(lines):
        minimum = max(1, total // (len(lines) * 2))
    for target in targets:
        candidates = [point for point in pauses if point >= previous + minimum
                      and point <= total - minimum * remaining]
        if not candidates:
            lower = previous + minimum
            upper = total - minimum * remaining
            point = min(max(int(target), lower), upper)
        else:
            point = min(candidates, key=lambda item: abs(item - target))
            pauses = [item for item in pauses if item > point]
        selected.append(point)
        previous = point
        remaining -= 1
    return [0, *selected, total]


def main() -> int:
    manifest_path = PACK / "audio-manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    total_lines = 0
    for level_path in sorted(LEVELS.glob("*.json")):
        level = json.loads(level_path.read_text(encoding="utf-8"))
        chapter_id = level["levelId"]
        entry = manifest.get("entries", {}).get(chapter_id)
        if not entry or not entry.get("file"):
            raise RuntimeError(f"missing node audio entry: {chapter_id}")
        source_path = ROOT / Path(entry["file"])
        audio, sample_rate = sf.read(source_path)
        scene_groups = readable_scenes(level)
        flat_lines = [line for scene in scene_groups for line in scene["lines"]]
        boundaries = choose_boundaries(audio, sample_rate, flat_lines)
        flat_index = 0
        manifest_scenes = []
        for scene in scene_groups:
            line_entries = []
            for line_index, text in enumerate(scene["lines"]):
                start = boundaries[flat_index]
                end = boundaries[flat_index + 1]
                relative = Path(chapter_id) / "lines" / f"{scene['sceneId']}-{line_index:02d}.wav"
                target = ASSET_ROOT / relative
                target.parent.mkdir(parents=True, exist_ok=True)
                sf.write(target, audio[start:end], sample_rate)
                line_entries.append({
                    "file": "assets/story/pixel-worlds-v1/audio/" + relative.as_posix(),
                    "voice": entry.get("voice", "child"),
                    "engineRequested": entry.get("engineRequested", "voxcpm2"),
                    "engineActual": "voxcpm2-sliced",
                    "bytes": target.stat().st_size,
                    "text": text,
                })
                flat_index += 1
            manifest_scenes.append({"sceneId": scene["sceneId"], "lines": line_entries})
        entry["scenes"] = manifest_scenes
        entry["lineAudioEngine"] = "voxcpm2-sliced"
        total_lines += len(flat_lines)
        print(f"OK {chapter_id}: {len(flat_lines)} lines")
    manifest["lineAudioFormat"] = "wav"
    manifest["totalReadableLines"] = total_lines
    manifest["lineAudioStatus"] = "complete"
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"WROTE {manifest_path}: {total_lines} line audio files")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
