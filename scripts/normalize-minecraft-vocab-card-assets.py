from __future__ import annotations

import argparse
import json
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
MEDIA_ROOT = ROOT / 'assets' / 'learn' / 'english-vocab' / 'minecraft-cards'
MANIFEST_PATH = MEDIA_ROOT / 'manifest.json'
TARGET_SIZE = 512
MAX_CONTENT = 404


def normalize_image(path: Path) -> str:
    source = Image.open(path).convert('RGBA')
    alpha = source.getchannel('A')
    alpha_bbox = alpha.getbbox()
    fully_opaque = alpha.getextrema() == (255, 255)
    if alpha_bbox and not fully_opaque:
        cropped = source.crop(alpha_bbox)
        scale = min(MAX_CONTENT / cropped.width, MAX_CONTENT / cropped.height)
        size = (max(1, round(cropped.width * scale)), max(1, round(cropped.height * scale)))
        content = cropped.resize(size, Image.Resampling.NEAREST)
        mode = 'normalized-transparent'
    else:
        scale = min(MAX_CONTENT / source.width, MAX_CONTENT / source.height)
        size = (max(1, round(source.width * scale)), max(1, round(source.height * scale)))
        content = source.resize(size, Image.Resampling.NEAREST)
        mode = 'normalized-scene'
    canvas = Image.new('RGBA', (TARGET_SIZE, TARGET_SIZE), (0, 0, 0, 0))
    canvas.alpha_composite(content, ((TARGET_SIZE - content.width) // 2, (TARGET_SIZE - content.height) // 2))
    canvas.save(path, 'PNG', optimize=True)
    return mode


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args()
    manifest = json.loads(MANIFEST_PATH.read_text(encoding='utf-8'))
    modes = {}
    for item in manifest.get('assets', []):
        path = ROOT / item['path']
        if not path.exists():
            raise SystemExit(f'missing asset: {path}')
        if args.apply:
            mode = normalize_image(path)
        else:
            with Image.open(path) as image:
                alpha = image.convert('RGBA').getchannel('A')
                mode = 'normalized-transparent' if alpha.getbbox() and alpha.getextrema() != (255, 255) else 'normalized-scene'
        modes[mode] = modes.get(mode, 0) + 1
        item['dimensions'] = [TARGET_SIZE, TARGET_SIZE]
        item['presentation'] = mode
    manifest['presentationVersion'] = 1
    manifest['presentation'] = '512px square canvas; transparent sprites are cropped and scaled with nearest-neighbor; scenes are letterboxed.'
    if args.apply:
        MANIFEST_PATH.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({'mode': 'apply' if args.apply else 'dry-run', 'assets': len(manifest.get('assets', [])), 'modes': modes}, ensure_ascii=False, indent=2))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
