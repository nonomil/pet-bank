from pathlib import Path
import subprocess


def test_pages_artifact_excludes_source_only_and_voice_assets(tmp_path):
    out_dir = tmp_path / "_site"
    result = subprocess.run(
        ["node", "scripts/assemble-pages-artifact.mjs", str(out_dir)],
        check=False,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    assert result.returncode == 0, result.stderr

    assert (out_dir / "index.html").is_file()
    assert (out_dir / "admin.html").is_file()
    assert (out_dir / "css/vendor/tailwind-lite.css").is_file()
    assert (out_dir / "assets/home-bg/map-board.webp").is_file()
    assert (out_dir / ".nojekyll").is_file()

    assert not (out_dir / "assets/voice").exists()
    assert not (out_dir / "assets/pets/originals").exists()
    assert not (out_dir / "assets/pets/poses-originals").exists()
    assert not (out_dir / "assets/pets-originals").exists()
    assert not (out_dir / "assets/references").exists()
    assert not (out_dir / "data/source-snapshots").exists()
    assert not list((out_dir / "data").rglob("*.bak"))
