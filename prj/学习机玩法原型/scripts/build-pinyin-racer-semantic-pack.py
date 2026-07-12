from __future__ import annotations

import json
import shutil
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
PREPARED = ROOT / "assets" / "generated" / "pinyin-racer-prepared-assets"
OUTPUT = ROOT / "assets" / "generated" / "pinyin-racer-semantic-assets"


SELECTIONS = {
    "level-01": {
        "meadow_track_straight": "part-01_181x294.png",
        "meadow_track_s_bend_a": "part-02_205x333.png",
        "meadow_track_s_bend_b": "part-03_228x347.png",
        "meadow_track_s_bend_c": "part-04_195x350.png",
        "meadow_blue_car": "part-07_232x200.png",
        "meadow_checkpoint_arch": "part-13_324x208.png",
        "meadow_arrow_blue": "part-14_91x63.png",
        "meadow_arrow_yellow": "part-24_91x63.png",
        "meadow_arrow_red": "part-26_91x63.png",
        "meadow_round_sign": "part-16_107x198.png",
        "meadow_flower_bed": "part-32_189x137.png",
    },
    "level-02": {
        "cloud_track_straight": "part-01_253x353.png",
        "cloud_fork_track": "part-03_432x370.png",
        "cloud_track_curve": "part-05_368x332.png",
        "cloud_blue_arch": "part-07_259x228.png",
        "cloud_red_arch": "part-08_328x187.png",
        "cloud_blue_car": "part-10_202x164.png",
        "cloud_arrow_blue": "part-28_66x49.png",
        "cloud_arrow_yellow": "part-29_63x47.png",
        "cloud_arrow_red": "part-31_62x46.png",
        "cloud_floating_island": "part-25_182x239.png",
    },
    "level-03": {
        "forest_track_overview": "part-01_1427x468.png",
        "forest_track_scene": "part-07_987x560.png",
        "forest_bridge_arch": "part-08_319x228.png",
        "forest_sign_white": "part-10_168x149.png",
        "forest_sign_green": "part-12_164x136.png",
        "forest_sign_orange": "part-13_125x123.png",
        "forest_tree": "part-16_204x277.png",
        "forest_wood_bridge": "part-18_94x157.png",
        "forest_water_pad": "part-20_160x95.png",
    },
    "level-04": {
        "candy_track_ramp": "part-01_519x419.png",
        "candy_track_bridge": "part-03_275x349.png",
        "candy_finish_gate": "part-05_544x312.png",
        "candy_blue_car": "part-06_238x184.png",
        "candy_barrier_red": "part-07_219x94.png",
        "candy_barrier_yellow": "part-08_198x103.png",
        "candy_balloon_pink": "part-15_130x174.png",
        "candy_balloon_purple": "part-16_96x135.png",
        "candy_balloon_blue": "part-17_100x141.png",
        "candy_floating_island": "part-25_172x188.png",
        "candy_waterfall": "part-26_186x180.png",
    },
}


def edge_alpha_max(image: Image.Image) -> int:
    alpha = image.getchannel("A")
    edge = []
    edge.extend(alpha.crop((0, 0, image.width, 1)).getdata())
    edge.extend(alpha.crop((0, image.height - 1, image.width, image.height)).getdata())
    edge.extend(alpha.crop((0, 0, 1, image.height)).getdata())
    edge.extend(alpha.crop((image.width - 1, 0, image.width, image.height)).getdata())
    return max(edge, default=0)


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    manifest = {
        "sourceDir": "assets/拼音赛车",
        "preparedLibrary": "assets/generated/pinyin-racer-prepared-assets/catalog.json",
        "semanticStatus": "curated reusable components; source explosion parts remain in prepared library",
        "levels": [],
    }
    for level, selections in SELECTIONS.items():
        level_source = PREPARED / level / "split"
        level_output = OUTPUT / level
        level_output.mkdir(parents=True, exist_ok=True)
        entries = []
        for semantic_name, source_name in selections.items():
            source = level_source / source_name
            assert source.exists(), f"missing prepared split: {source}"
            destination = level_output / f"{semantic_name}.png"
            shutil.copy2(source, destination)
            with Image.open(destination) as image:
                rgba = image.convert("RGBA")
                assert edge_alpha_max(rgba) == 0, f"non-transparent edge: {destination}"
                entries.append({
                    "name": semantic_name,
                    "file": str(destination.relative_to(ROOT)).replace("\\", "/"),
                    "sourceSplit": str(source.relative_to(ROOT)).replace("\\", "/"),
                    "size": [rgba.width, rgba.height],
                    "mode": "RGBA",
                    "edgeAlphaMax": 0,
                })
        (level_output / "manifest.json").write_text(json.dumps({"level": level, "assets": entries}, ensure_ascii=False, indent=2), encoding="utf-8")
        manifest["levels"].append({"level": level, "assetCount": len(entries), "manifest": str((level_output / "manifest.json").relative_to(ROOT)).replace("\\", "/")})

    level05_manifest = OUTPUT / "level-05" / "manifest.json"
    level05 = json.loads(level05_manifest.read_text(encoding="utf-8"))
    manifest["levels"].append({"level": "level-05", "assetCount": len(level05["assets"]), "manifest": str(level05_manifest.relative_to(ROOT)).replace("\\", "/"), "source": level05["source"]})
    manifest["totalCuratedAssets"] = sum(item["assetCount"] for item in manifest["levels"])
    (OUTPUT / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"built {manifest['totalCuratedAssets']} curated semantic assets")


if __name__ == "__main__":
    main()
