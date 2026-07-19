"""Crop Grok 2x2 expedition story sheets into publishable 3:2 scene images."""

from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "learn" / "english-vocab" / "generated" / "minecraft-expedition"

SOURCES = {
    "camp-to-mine": ROOT / "tmp" / "grok-minecraft-expedition-story" / "camp-to-mine" / "camp-to-mine-sheet.png",
    "nether-to-end": ROOT / "tmp" / "grok-minecraft-expedition-story" / "nether-to-end" / "nether-to-end-sheet.png",
}

# The generated sheets are 2x2 landscape panels. Keep their 3:2 composition.
PANELS = {
    "story-camp.png": ("camp-to-mine", 0),
    "story-grassland.png": ("camp-to-mine", 1),
    "story-village.png": ("camp-to-mine", 2),
    "story-deep-mine.png": ("camp-to-mine", 3),
    "story-nether.png": ("nether-to-end", 0),
    "story-nether-crossing.png": ("nether-to-end", 1),
    "story-end.png": ("nether-to-end", 2),
    "story-dragon.png": ("nether-to-end", 3),
}


def crop_sheet(source: Path, panel: int, output: Path) -> None:
    with Image.open(source) as image:
        image = image.convert("RGB")
        half_width = image.width // 2
        half_height = image.height // 2
        row, column = divmod(panel, 2)
        box = (
            column * half_width,
            row * half_height,
            (column + 1) * half_width,
            (row + 1) * half_height,
        )
        cropped = image.crop(box).resize((1536, 1024), Image.Resampling.LANCZOS)
        output.parent.mkdir(parents=True, exist_ok=True)
        cropped.save(output, "PNG", optimize=True)


def main() -> int:
    for filename, (source_key, panel) in PANELS.items():
        source = SOURCES[source_key]
        if not source.exists():
            raise FileNotFoundError(source)
        crop_sheet(source, panel, OUT / filename)
    print(f"cropped {len(PANELS)} Grok expedition story scenes")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
