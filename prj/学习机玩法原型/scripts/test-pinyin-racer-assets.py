from pathlib import Path
import json
from PIL import Image


def edge_alpha_max(image):
    alpha = image.getchannel("A")
    edge = []
    edge.extend(alpha.crop((0, 0, image.width, 1)).getdata())
    edge.extend(alpha.crop((0, image.height - 1, image.width, image.height)).getdata())
    edge.extend(alpha.crop((0, 0, 1, image.height)).getdata())
    edge.extend(alpha.crop((image.width - 1, 0, image.width, image.height)).getdata())
    return max(edge, default=0)

ROOT = Path(__file__).resolve().parents[1]
ASSET_DIR = ROOT / "assets" / "generated" / "pinyin-racer-assets"
MANIFEST = ASSET_DIR / "manifest.json"

required = {
    "car_pose_idle",
    "car_pose_accelerate",
    "car_pose_drift_left",
    "car_pose_drift_right",
    "car_pose_finish",
    "checkpoint_arch",
    "speed_trail_long",
    "nitro_burst",
}
retheme_required = {
    "initial_sound_gate",
    "fork_gate_pair",
    "tone_hanging_sign",
    "picture_supply_kiosk",
    "listening_tunnel_gate",
    "finish_sprint_arch",
}
semantic_required = {
    "initial_sound_gate",
    "fork_gate_pair",
    "tone_hanging_sign",
    "picture_supply_kiosk",
    "listening_tunnel_gate",
    "finish_sprint_arch",
}
manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
entries = {item["name"]: item for item in manifest["assets"]}
missing = required - entries.keys()
assert not missing, f"missing manifest assets: {sorted(missing)}"

for name in sorted(required):
    file_path = ROOT / entries[name]["file"]
    assert file_path.exists(), f"missing asset file: {file_path}"
    with Image.open(file_path) as image:
        rgba = image.convert("RGBA")
        assert rgba.width > 0 and rgba.height > 0, f"empty asset: {name}"
        alpha = rgba.getchannel("A")
        edge_pixels = []
        edge_pixels.extend(alpha.crop((0, 0, rgba.width, 1)).getdata())
        edge_pixels.extend(alpha.crop((0, rgba.height - 1, rgba.width, rgba.height)).getdata())
        edge_pixels.extend(alpha.crop((0, 0, 1, rgba.height)).getdata())
        edge_pixels.extend(alpha.crop((rgba.width - 1, 0, rgba.width, rgba.height)).getdata())
        assert max(edge_pixels, default=0) == 0, f"non-transparent edge in {name}"
        assert entries[name]["mode"] == "RGBA", f"manifest mode mismatch in {name}"

print(f"PASS - {len(required)} pinyin racer assets are RGBA with transparent edges")

retheme_dir = ROOT / "assets" / "generated" / "pinyin-racer-retheme-assets"
retheme_manifest = json.loads((retheme_dir / "manifest.json").read_text(encoding="utf-8"))
retheme_entries = {item["name"]: item for item in retheme_manifest["assets"]}
assert retheme_required == retheme_entries.keys(), "retheme manifest should contain exactly six semantic facilities"
for name in sorted(retheme_required):
    file_path = ROOT / retheme_entries[name]["file"]
    assert file_path.exists(), f"missing retheme asset file: {file_path}"
    with Image.open(file_path) as image:
        rgba = image.convert("RGBA")
        assert rgba.width > 0 and rgba.height > 0, f"empty retheme asset: {name}"
        alpha = rgba.getchannel("A")
        edge_pixels = []
        edge_pixels.extend(alpha.crop((0, 0, rgba.width, 1)).getdata())
        edge_pixels.extend(alpha.crop((0, rgba.height - 1, rgba.width, rgba.height)).getdata())
        edge_pixels.extend(alpha.crop((0, 0, 1, rgba.height)).getdata())
        edge_pixels.extend(alpha.crop((rgba.width - 1, 0, rgba.width, rgba.height)).getdata())
        assert max(edge_pixels, default=0) == 0, f"non-transparent retheme edge in {name}"

print(f"PASS - {len(retheme_required)} retheme facilities are RGBA with transparent edges")

semantic_dir = ROOT / "assets" / "generated" / "pinyin-racer-semantic-assets" / "level-05"
semantic_manifest = json.loads((semantic_dir / "manifest.json").read_text(encoding="utf-8"))
semantic_entries = {item["name"]: item for item in semantic_manifest["assets"]}
assert semantic_required == semantic_entries.keys(), "level-05 semantic manifest should contain exactly six facilities"
for name in sorted(semantic_required):
    file_path = ROOT / semantic_entries[name]["file"]
    assert file_path.exists(), f"missing semantic asset file: {file_path}"
    with Image.open(file_path) as image:
        rgba = image.convert("RGBA")
        assert rgba.width > 0 and rgba.height > 0, f"empty semantic asset: {name}"
        alpha = rgba.getchannel("A")
        edge_pixels = []
        edge_pixels.extend(alpha.crop((0, 0, rgba.width, 1)).getdata())
        edge_pixels.extend(alpha.crop((0, rgba.height - 1, rgba.width, rgba.height)).getdata())
        edge_pixels.extend(alpha.crop((0, 0, 1, rgba.height)).getdata())
        edge_pixels.extend(alpha.crop((rgba.width - 1, 0, rgba.width, rgba.height)).getdata())
        assert max(edge_pixels, default=0) == 0, f"non-transparent semantic edge in {name}"
        assert semantic_entries[name]["mode"] == "RGBA", f"semantic manifest mode mismatch in {name}"

print(f"PASS - {len(semantic_required)} source explosion facilities are RGBA with transparent edges")

semantic_pack_dir = ROOT / "assets" / "generated" / "pinyin-racer-semantic-assets"
semantic_pack = json.loads((semantic_pack_dir / "manifest.json").read_text(encoding="utf-8"))
assert semantic_pack["totalCuratedAssets"] == 47, "semantic pack should contain the curated 47 reusable racer components"
for level in semantic_pack["levels"]:
    level_manifest = ROOT / level["manifest"]
    assert level_manifest.exists(), f"missing semantic level manifest: {level_manifest}"
    level_data = json.loads(level_manifest.read_text(encoding="utf-8"))
    assert len(level_data["assets"]) == level["assetCount"], f"semantic level count mismatch: {level['level']}"
    for item in level_data["assets"]:
        file_path = ROOT / item["file"]
        assert file_path.exists(), f"missing curated semantic asset file: {file_path}"
        with Image.open(file_path) as image:
            rgba = image.convert("RGBA")
            assert rgba.width > 0 and rgba.height > 0, f"empty curated semantic asset: {item['name']}"
            assert edge_alpha_max(rgba) == 0, f"non-transparent curated semantic edge: {item['name']}"

print(f"PASS - {semantic_pack['totalCuratedAssets']} curated source components are catalogued and reusable")
