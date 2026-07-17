"""Generate the complete 05-pixel-worlds-story audio pack with one VoxCPM2 model process.

This intentionally uses the dedicated VoxCPM2 Python environment directly instead of
calling the HTTP service once per line. Each map node keeps a complete story audio file
for compatibility and can additionally receive one audio file per readable line.
"""

from __future__ import annotations

import argparse
import json
import time
from datetime import datetime, timezone
from pathlib import Path

import soundfile as sf
from voxcpm import VoxCPM


ROOT = Path(__file__).resolve().parents[1]
PACK = ROOT / "data" / "story-packs" / "05-pixel-worlds-story"
DEFAULT_OUT = ROOT / "assets" / "story" / "pixel-worlds-v1" / "audio"
DEFAULT_MODEL = Path("D:/HuggingFaceCache/VoxCPM2")
PRESET_TO_DESCRIPTION = {
    "kind_grandpa": "(老年男性，声音慈祥缓慢，像爷爷讲故事)",
    "child": "(小女孩，六岁左右，活泼可爱)",
    "lively_teacher": "(年轻女性，声音清晰温柔，老师上课的语调)",
    "gentle_mom": "(年轻女性，声音温柔甜美，讲故事的语调)",
}


def story_nodes(manifest: dict):
    characters = manifest.get("characters", {})
    tracks = list(manifest.get("worlds", [])) + list(manifest.get("bonusTracks", []))
    nodes = [node for track in tracks for node in sorted(track.get("nodes", []), key=lambda item: item.get("order", 99))]
    for node in nodes:
        level_id = node["levelId"]
        level = json.loads((PACK / "levels" / f"{level_id}.json").read_text(encoding="utf-8"))
        spoken = []
        scenes = []
        voice = "child"
        for scene in level.get("scenes", []):
            scene_lines = []
            for line in scene.get("lines", []):
                text = (line.get("text") or line.get("prompt") or "").strip()
                if not text:
                    continue
                spoken.append(text)
                scene_lines.append({"text": text, "lineIndex": len(scene_lines)})
                if voice == "child":
                    character = characters.get(line.get("character", ""), {})
                    voice = character.get("voicePreset", "child")
            scenes.append({"sceneId": scene.get("sceneId", "scene"), "lines": scene_lines})
        yield {
            "key": level_id,
            "levelId": level_id,
            "text": "\n".join(spoken),
            "lineCount": len(spoken),
            "voice": voice,
            "scenes": scenes,
        }


def read_existing(manifest_path: Path) -> dict:
    if not manifest_path.exists():
        return {}
    try:
        data = json.loads(manifest_path.read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else {}
    except (OSError, json.JSONDecodeError):
        return {}


def write_manifest(path: Path, entries: dict, total_nodes: int, total_readable_lines: int, failures: list[dict], status: str, engine_actual: str):
    path.write_text(json.dumps({
        "schemaVersion": 1,
        "storyId": "pixel-worlds-story",
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "engineRequested": "voxcpm2",
        "engineActual": engine_actual,
        "audioFormat": "wav",
        "status": status,
        "totalNodes": total_nodes,
        "generatedNodes": len(entries),
        "totalReadableLines": total_readable_lines,
        "failures": failures,
        "entries": entries,
    }, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--model-path", type=Path, default=DEFAULT_MODEL)
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT)
    parser.add_argument("--inference-timesteps", type=int, default=4)
    parser.add_argument("--max-nodes", type=int, default=0, help="only generate the first N nodes; useful for a smoke run")
    parser.add_argument("--only", nargs="+", help="only process the listed level IDs; useful for a focused content revision")
    parser.add_argument("--line-level", action="store_true", help="also generate one VoxCPM2 WAV per readable story line")
    args = parser.parse_args()

    manifest = json.loads((PACK / "manifest.json").read_text(encoding="utf-8"))
    nodes = list(story_nodes(manifest))
    if args.only:
        selected = set(args.only)
        nodes = [node for node in nodes if node["levelId"] in selected]
    if args.max_nodes:
        nodes = nodes[:args.max_nodes]
    all_nodes = list(story_nodes(manifest))
    total = len(all_nodes)
    total_readable_lines = sum(node["lineCount"] for node in all_nodes)
    manifest_path = PACK / "audio-manifest.json"
    previous = read_existing(manifest_path)
    valid_keys = {node["key"] for node in all_nodes}
    entries = {key: value for key, value in (previous.get("entries") or {}).items() if key in valid_keys}
    failures = []

    args.out.mkdir(parents=True, exist_ok=True)
    if not args.model_path.exists():
        raise RuntimeError(f"VoxCPM2 model path does not exist: {args.model_path}")

    print(f"loading VoxCPM2 from {args.model_path} ...", flush=True)
    started = time.time()
    model = VoxCPM.from_pretrained(str(args.model_path), load_denoiser=False)
    sample_rate = model.tts_model.sample_rate
    print(f"model loaded in {time.time() - started:.1f}s, sample_rate={sample_rate}, nodes={total}", flush=True)

    for index, node in enumerate(nodes, start=1):
        relative = Path(node["levelId"]) / f"{node['levelId']}.wav"
        target = args.out / relative
        existing = entries.get(node["key"])
        node_audio_ready = (
            existing
            and existing.get("text") == node["text"]
            and existing.get("engineActual") == "voxcpm2"
            and target.exists()
            and target.stat().st_size >= 256
        )
        if node_audio_ready and not args.line_level:
            print(f"SKIP {index}/{len(nodes)} {node['key']}", flush=True)
            continue

        try:
            target.parent.mkdir(parents=True, exist_ok=True)
            description = PRESET_TO_DESCRIPTION.get(node["voice"], PRESET_TO_DESCRIPTION["child"])
            if not node_audio_ready:
                audio = model.generate(
                    text=description + node["text"],
                    cfg_value=2.0,
                    inference_timesteps=args.inference_timesteps,
                )
                sf.write(str(target), audio, sample_rate)
            entry = {
                "file": "assets/story/pixel-worlds-v1/audio/" + relative.as_posix(),
                "voice": node["voice"],
                "engineRequested": "voxcpm2",
                "engineActual": "voxcpm2",
                "bytes": target.stat().st_size,
                "text": node["text"],
                "lineCount": node["lineCount"],
            }
            if args.line_level:
                line_groups = []
                for scene in node["scenes"]:
                    line_entries = []
                    for line in scene["lines"]:
                        line_index = line["lineIndex"]
                        line_relative = Path(node["levelId"]) / "lines" / f"{scene['sceneId']}-{line_index:02d}.wav"
                        line_target = args.out / line_relative
                        line_target.parent.mkdir(parents=True, exist_ok=True)
                        existing_line = line_target.exists() and line_target.stat().st_size >= 256
                        if not existing_line:
                            audio = model.generate(
                                text=description + line["text"],
                                cfg_value=2.0,
                                inference_timesteps=args.inference_timesteps,
                            )
                            sf.write(str(line_target), audio, sample_rate)
                        line_entries.append({
                            "file": "assets/story/pixel-worlds-v1/audio/" + line_relative.as_posix(),
                            "voice": node["voice"],
                            "engineRequested": "voxcpm2",
                            "engineActual": "voxcpm2",
                            "bytes": line_target.stat().st_size,
                            "text": line["text"],
                        })
                    line_groups.append({"sceneId": scene["sceneId"], "lines": line_entries})
                entry["scenes"] = line_groups
            entries[node["key"]] = entry
            write_manifest(manifest_path, entries, total, total_readable_lines, failures, "partial", "voxcpm2")
            print(f"OK {index}/{len(nodes)} {node['key']} {target.stat().st_size} bytes", flush=True)
        except Exception as error:  # keep the batch resumable after an individual failure
            failures.append({"key": node["key"], "error": str(error)})
            print(f"FAIL {index}/{len(nodes)} {node['key']}: {error}", flush=True)

    complete = not failures and len(entries) == total
    write_manifest(manifest_path, entries, total, total_readable_lines, failures, "complete" if complete else "partial", "voxcpm2")
    print(f"WROTE {manifest_path}: {len(entries)}/{total}", flush=True)
    return 0 if complete else 2


if __name__ == "__main__":
    raise SystemExit(main())
