from __future__ import annotations

import asyncio
import json
import math
import random
import sys
import wave
from pathlib import Path

import edge_tts


ROOT = Path(__file__).resolve().parents[1]
AUDIO_DIR = ROOT / "assets" / "generated" / "audio"
TTS_ROOT = ROOT.parent / "tts"

if str(TTS_ROOT) not in sys.path:
    sys.path.insert(0, str(TTS_ROOT))

from edge_tts_config import DEFAULT_PRESET, VOICE_PRESETS  # noqa: E402


ROUND_GOAL = 6
DEFAULT_MODE = "words"
SAMPLE_RATE = 22050
WORD_PRESET_KEY = "英文单词"
VOICE_ASSIGNMENTS = {
    "cues": "cnCue",
    "pinyin": "cnCue",
    "letters": "cnCue",
    "numbers": "cnCue",
    "words": "enWord",
}

VOICE_PRESET_EXPORTS = {
    "cnCue": {
        "label": DEFAULT_PRESET,
        **VOICE_PRESETS[DEFAULT_PRESET],
    },
    "enWord": {
        "label": WORD_PRESET_KEY,
        "voice": "en-US-AnaNeural",
        "rate": "-8%",
        "pitch": "+4Hz",
        "volume": "+0%",
        "desc": "英文单词使用 Cartoon 英文音色，和中文活泼老师保持儿童感一致",
    },
}


TASK_BANKS = {
    "pinyin": [
        {"target": "a", "text": "单韵母 a"},
        {"target": "o", "text": "单韵母 o"},
        {"target": "e", "text": "单韵母 e"},
        {"target": "ai", "text": "复韵母 ai"},
        {"target": "ao", "text": "复韵母 ao"},
        {"target": "ma", "text": "拼音 ma"},
        {"target": "ba", "text": "拼音 ba"},
        {"target": "pin", "text": "拼音 pin"},
        {"target": "shi", "text": "整体认读 shi"},
    ],
    "letters": [
        {"target": "b", "text": "找到字母 b"},
        {"target": "p", "text": "找到字母 p"},
        {"target": "m", "text": "找到字母 m"},
        {"target": "f", "text": "找到字母 f"},
        {"target": "d", "text": "找到字母 d"},
        {"target": "t", "text": "找到字母 t"},
        {"target": "n", "text": "找到字母 n"},
        {"target": "l", "text": "找到字母 l"},
    ],
    "words": [
        {"target": "cat", "text": "小猫 cat"},
        {"target": "dog", "text": "小狗 dog"},
        {"target": "fox", "text": "狐狸 fox"},
        {"target": "bat", "text": "蝙蝠 bat"},
        {"target": "bear", "text": "小熊 bear"},
        {"target": "frog", "text": "青蛙 frog"},
        {"target": "deer", "text": "小鹿 deer"},
        {"target": "panda", "text": "熊猫 panda"},
    ],
    "numbers": [
        {"target": "1", "text": "数字 1"},
        {"target": "2", "text": "数字 2"},
        {"target": "5", "text": "数字 5"},
        {"target": "7", "text": "数字 7"},
        {"target": "10", "text": "数字 10"},
        {"target": "12", "text": "数字 12"},
        {"target": "20", "text": "数字 20"},
    ],
}


CUES = {
    "start": "开始挑战，听清楚再敲键盘。",
    "win": "通关成功，真棒。",
    "lose": "休息一下，我们再来。",
}


def slug(value: str) -> str:
    chars = []
    for ch in value.lower():
        if ("a" <= ch <= "z") or ("0" <= ch <= "9"):
            chars.append(ch)
        else:
            chars.append("_")
    result = "".join(chars)
    while "__" in result:
        result = result.replace("__", "_")
    return result.strip("_")


async def synthesize_mp3(text: str, output_path: Path) -> None:
    await synthesize_mp3_with_preset(text, output_path, DEFAULT_PRESET)


async def synthesize_mp3_with_preset(text: str, output_path: Path, preset_name: str) -> None:
    preset = VOICE_PRESET_EXPORTS.get(preset_name) or VOICE_PRESETS.get(preset_name) or VOICE_PRESETS["活泼老师"]
    communicate = edge_tts.Communicate(
        text=text,
        voice=preset["voice"],
        rate=preset["rate"],
        pitch=preset["pitch"],
        volume=preset["volume"],
    )
    output_path.parent.mkdir(parents=True, exist_ok=True)
    await communicate.save(str(output_path))


def write_pcm_wav(path: Path, samples: list[float]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(path), "wb") as wav_file:
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2)
        wav_file.setframerate(SAMPLE_RATE)
        frames = bytearray()
        for sample in samples:
            clamped = max(-1.0, min(1.0, sample))
            value = int(clamped * 32767)
            frames += value.to_bytes(2, byteorder="little", signed=True)
        wav_file.writeframes(frames)


def generate_countdown_samples() -> list[float]:
    total = int(SAMPLE_RATE * 0.32)
    samples: list[float] = []
    freqs = [900, 1080, 1260]
    segment = total // len(freqs)
    for index, freq in enumerate(freqs):
        for i in range(segment):
            t = (index * segment + i) / SAMPLE_RATE
            local = i / max(1, segment - 1)
            env = (1 - local) ** 1.8
            sample = math.sin(2 * math.pi * freq * t) * 0.33 * env
            samples.append(sample)
    return samples


def generate_explosion_samples() -> list[float]:
    total = int(SAMPLE_RATE * 0.9)
    samples: list[float] = []
    for i in range(total):
        t = i / SAMPLE_RATE
        env = (1 - (i / max(1, total - 1))) ** 2.2
        noise = (random.random() * 2 - 1) * 0.42 * env
        boom = math.sin(2 * math.pi * (92 - 60 * min(1, t / 0.9)) * t) * 0.28 * env
        crack = math.sin(2 * math.pi * 420 * t) * 0.09 * env * (1 - min(1, t / 0.22))
        samples.append(noise + boom + crack)
    return samples


async def generate_all_mp3() -> dict[str, dict[str, str]]:
    cues_manifest: dict[str, str] = {}
    tasks_manifest: dict[str, str] = {}

    for key, text in CUES.items():
        filename = f"cue_{key}.mp3"
        await synthesize_mp3_with_preset(text, AUDIO_DIR / filename, DEFAULT_PRESET)
        cues_manifest[key] = f"../assets/generated/audio/{filename}"

    for mode_key, tasks in TASK_BANKS.items():
        assignment_key = VOICE_ASSIGNMENTS.get(mode_key, "cnCue")
        preset_name = VOICE_PRESET_EXPORTS[assignment_key]["label"]
        for task in tasks:
            filename = f"task_{mode_key}_{slug(task['target'])}.mp3"
            await synthesize_mp3_with_preset(task["text"], AUDIO_DIR / filename, preset_name)
            tasks_manifest[f"{mode_key}:{task['target']}"] = f"../assets/generated/audio/{filename}"

    return {"cues": cues_manifest, "tasks": tasks_manifest}


def generate_sfx_manifest() -> dict[str, str]:
    letter_name = "sfx_letter.wav"
    countdown_name = "sfx_countdown.wav"
    explosion_name = "sfx_explosion.wav"
    write_pcm_wav(AUDIO_DIR / letter_name, [
        math.sin(2 * math.pi * 760 * (i / SAMPLE_RATE)) * 0.24 * ((1 - i / max(1, int(SAMPLE_RATE * 0.12) - 1)) ** 1.6)
        for i in range(int(SAMPLE_RATE * 0.12))
    ])
    write_pcm_wav(AUDIO_DIR / countdown_name, generate_countdown_samples())
    write_pcm_wav(AUDIO_DIR / explosion_name, generate_explosion_samples())
    return {
        "letter": f"../assets/generated/audio/{letter_name}",
        "countdown": f"../assets/generated/audio/{countdown_name}",
        "explosion": f"../assets/generated/audio/{explosion_name}",
    }


async def main() -> None:
    AUDIO_DIR.mkdir(parents=True, exist_ok=True)
    voice_manifest = await generate_all_mp3()
    sfx_manifest = generate_sfx_manifest()

    manifest = {
        "defaultMode": DEFAULT_MODE,
        "roundGoal": ROUND_GOAL,
        "voicePreset": DEFAULT_PRESET,
        "voicePresets": VOICE_PRESET_EXPORTS,
        "voiceAssignments": VOICE_ASSIGNMENTS,
        "cues": voice_manifest["cues"],
        "tasks": voice_manifest["tasks"],
        "sfx": sfx_manifest,
    }
    (AUDIO_DIR / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(f"audio assets generated: {AUDIO_DIR}")


if __name__ == "__main__":
    asyncio.run(main())
