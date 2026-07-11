import subprocess
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
RUNNER = BASE_DIR.parent / "prototype-voice-workflow" / "generate_prototype_voice_assets.py"


def main() -> None:
    command = [sys.executable, str(RUNNER), "--source", "word-memory-topdown"]
    raise SystemExit(subprocess.call(command, cwd=str(BASE_DIR)))


if __name__ == "__main__":
    main()
