#!/usr/bin/env python3
"""Extract a modern Anki deck package into browser-friendly JSON and media."""

from __future__ import annotations

import argparse
import html
import json
import re
import shutil
import sqlite3
import sys
import tempfile
import zipfile
from collections import OrderedDict, defaultdict
from html.parser import HTMLParser
from pathlib import Path, PurePosixPath
from typing import Any, Iterable


FIELD_SEPARATOR = chr(31)
ENCRYPTED_FIELD_RE = re.compile(r"^≯#.*#≮$", re.DOTALL)
MEDIA_TOKEN_RE = re.compile(r"\[sound:([^\]]+)\]|(?:src|href)=[\"']([^\"']+)[\"']", re.IGNORECASE)


class _TextParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []

    def handle_data(self, data: str) -> None:
        self.parts.append(data)

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag in {"br", "p", "div", "li", "tr"}:
            self.parts.append("\n")

    def handle_endtag(self, tag: str) -> None:
        if tag in {"p", "div", "li", "tr"}:
            self.parts.append("\n")


def html_to_text(value: str) -> str:
    parser = _TextParser()
    parser.feed(value or "")
    parser.close()
    lines = [" ".join(line.split()) for line in "".join(parser.parts).splitlines()]
    return "\n".join(line for line in lines if line).strip()


def safe_media_name(value: str) -> str:
    normalized = value.replace("\\", "/")
    path = PurePosixPath(normalized)
    if path.is_absolute() or ".." in path.parts or not path.parts:
        raise ValueError(f"Unsafe media path: {value}")
    return "/".join(path.parts)


def media_references(value: str, media_by_name: dict[str, str]) -> list[dict[str, str]]:
    references: list[dict[str, str]] = []
    seen: set[str] = set()
    for match in MEDIA_TOKEN_RE.finditer(value or ""):
        filename = match.group(1) or match.group(2)
        if not filename or filename.startswith(("http://", "https://", "data:")):
            continue
        filename = html.unescape(filename)
        safe_name = safe_media_name(filename)
        if safe_name in seen:
            continue
        seen.add(safe_name)
        zip_entry = media_by_name.get(filename) or media_by_name.get(safe_name)
        references.append(
            {
                "name": safe_name,
                "path": f"assets/media/{safe_name}",
                "kind": "audio" if filename.lower().endswith((".mp3", ".wav", ".ogg", ".m4a")) else "image",
                "available": bool(zip_entry),
            }
        )
    return references


def field_record(raw_value: str, media_by_name: dict[str, str]) -> dict[str, Any]:
    value = raw_value or ""
    return {
        "raw": value,
        "text": html_to_text(value),
        "encrypted": bool(ENCRYPTED_FIELD_RE.fullmatch(value.strip())),
        "media": media_references(value, media_by_name),
    }


def render_template(template: str, fields: dict[str, dict[str, Any]], front_side: str = "") -> str:
    rendered = template or ""

    def conditional(match: re.Match[str]) -> str:
        name = match.group(1).strip()
        return match.group(2) if fields.get(name, {}).get("raw") else ""

    rendered = re.sub(r"{{#([^}]+)}}(.*?){{/\1}}", conditional, rendered, flags=re.DOTALL)
    rendered = rendered.replace("{{FrontSide}}", front_side)

    def replacement(match: re.Match[str]) -> str:
        name = match.group(1).strip().removeprefix("text:").removeprefix("type:")
        return fields.get(name, {}).get("raw", "")

    return re.sub(r"{{([^{}]+)}}", replacement, rendered)


def _deck_path(name: str) -> list[str]:
    return [part for part in name.split("::") if part]


def _build_tree(flat_decks: list[dict[str, Any]]) -> list[dict[str, Any]]:
    roots: list[dict[str, Any]] = []
    by_path: dict[tuple[str, ...], dict[str, Any]] = {}
    for deck in flat_decks:
        parent: list[dict[str, Any]] = roots
        for index, part in enumerate(deck["path"]):
            path_key = tuple(deck["path"][: index + 1])
            node = by_path.get(path_key)
            if node is None:
                node = {
                    "name": part,
                    "path": list(path_key),
                    "cardCount": 0,
                    "ownCardCount": 0,
                    "children": [],
                }
                by_path[path_key] = node
                parent.append(node)
            parent = node["children"]
        leaf = by_path[tuple(deck["path"])]
        leaf["deckId"] = deck["id"]
        leaf["ownCardCount"] = deck["cardCount"]
        leaf["noteCount"] = deck["noteCount"]

    def finalize(node: dict[str, Any]) -> tuple[int, int]:
        child_counts = [finalize(child) for child in node["children"]]
        child_cards = sum(item[0] for item in child_counts)
        child_notes = sum(item[1] for item in child_counts)
        node["cardCount"] = node.pop("ownCardCount", 0) + child_cards
        node["noteCount"] = node.get("noteCount", 0) + child_notes
        return node["cardCount"], node["noteCount"]

    for root in roots:
        finalize(root)
    return roots


def _write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")


def _copy_media(package: zipfile.ZipFile, media_map: dict[str, str], output_dir: Path) -> None:
    media_dir = output_dir / "assets" / "media"
    for zip_entry, filename in media_map.items():
        safe_name = safe_media_name(filename)
        destination = media_dir / Path(*PurePosixPath(safe_name).parts)
        destination.parent.mkdir(parents=True, exist_ok=True)
        with destination.open("wb") as handle:
            handle.write(package.read(zip_entry))


def extract_package(package_path: Path | str, output_dir: Path | str, copy_media: bool = False) -> dict[str, Any]:
    package_path = Path(package_path)
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(package_path) as package:
        database_entry = "collection.anki21" if "collection.anki21" in package.namelist() else "collection.anki2"
        if database_entry not in package.namelist():
            raise ValueError("APKG does not contain collection.anki21 or collection.anki2")
        try:
            media_map = {str(key): str(value) for key, value in json.loads(package.read("media").decode("utf-8")).items()}
        except KeyError:
            media_map = {}
        media_by_name = {safe_media_name(name): key for key, name in media_map.items()}
        with tempfile.TemporaryDirectory(prefix="anki-vocab-") as temp_dir:
            db_path = Path(temp_dir) / database_entry
            db_path.write_bytes(package.read(database_entry))
            connection = sqlite3.connect(db_path)
            decks_raw, models_raw = connection.execute("SELECT decks, models FROM col").fetchone()
            decks = json.loads(decks_raw)
            models = json.loads(models_raw)
            cards_by_note: defaultdict[int, list[sqlite3.Row]] = defaultdict(list)
            connection.row_factory = sqlite3.Row
            for row in connection.execute("SELECT * FROM cards ORDER BY id"):
                cards_by_note[int(row["nid"])].append(row)
            card_counts = {int(row["did"]): int(row["count"]) for row in connection.execute("SELECT did, count(*) AS count FROM cards GROUP BY did")}
            note_counts = {int(row["did"]): int(row["count"]) for row in connection.execute("SELECT did, count(DISTINCT nid) AS count FROM cards GROUP BY did")}
            flat_decks: list[dict[str, Any]] = []
            for deck_id, deck in decks.items():
                deck_id_int = int(deck_id)
                if deck.get("name") == "Default":
                    continue
                flat_decks.append(
                    {
                        "id": deck_id_int,
                        "name": deck["name"].split("::")[-1],
                        "path": _deck_path(deck["name"]),
                        "cardCount": card_counts.get(deck_id_int, 0),
                        "noteCount": note_counts.get(deck_id_int, 0),
                    }
                )
            flat_decks.sort(key=lambda item: item["path"])
            cards: list[dict[str, Any]] = []
            for note_row in connection.execute("SELECT * FROM notes ORDER BY id"):
                note_id = int(note_row["id"])
                model = models.get(str(note_row["mid"]), {})
                field_values = note_row["flds"].split(FIELD_SEPARATOR)
                fields: OrderedDict[str, dict[str, Any]] = OrderedDict()
                for index, field in enumerate(model.get("flds", [])):
                    fields[field["name"]] = field_record(field_values[index] if index < len(field_values) else "", media_by_name)
                    if not fields[field["name"]]["raw"]:
                        del fields[field["name"]]
                for card_row in cards_by_note.get(note_id, []):
                    deck = decks.get(str(card_row["did"]), {"name": "Default"})
                    deck_path = _deck_path(deck["name"])
                    templates = model.get("tmpls", [])
                    template = next((item for item in templates if item.get("ord") == card_row["ord"]), templates[0] if templates else {})
                    all_media: list[dict[str, str]] = []
                    for value in fields.values():
                        for reference in value["media"]:
                            if reference["name"] not in {item["name"] for item in all_media}:
                                all_media.append(reference)
                    cards.append(
                        {
                            "id": int(card_row["id"]),
                            "noteId": note_id,
                            "deckId": int(card_row["did"]),
                            "deckName": deck_path[-1] if deck_path else "Default",
                            "deckPath": deck_path,
                            "modelName": model.get("name", "Unknown"),
                            "templateName": template.get("name", "Card"),
                            "tags": (note_row["tags"] or "").split(),
                            "sortField": note_row["sfld"],
                            "fields": fields,
                            "media": all_media,
                        }
                    )
            connection.close()
        if copy_media:
            _copy_media(package, media_map, output_dir)
    cards.sort(key=lambda item: (item["deckPath"], str(item["sortField"]), item["id"]))
    tree = _build_tree(flat_decks)
    manifest = {
        "schemaVersion": 1,
        "sourceFile": package_path.name,
        "databaseEntry": database_entry,
        "noteCount": len({card["noteId"] for card in cards}),
        "cardCount": len(cards),
        "mediaCount": len(media_map),
        "deckCount": len(flat_decks),
        "encryptedFieldCount": sum(1 for card in cards for field in card["fields"].values() if field["encrypted"]),
        "generatedAt": __import__("datetime").datetime.now().isoformat(timespec="seconds"),
    }
    _write_json(output_dir / "data" / "manifest.json", manifest)
    _write_json(output_dir / "data" / "decks.json", {"tree": tree, "flat": flat_decks})
    _write_json(output_dir / "data" / "cards.json", cards)
    return manifest


def main() -> None:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="backslashreplace")
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--out-dir", required=True, type=Path)
    parser.add_argument("--copy-media", action="store_true")
    args = parser.parse_args()
    manifest = extract_package(args.input, args.out_dir, copy_media=args.copy_media)
    print(json.dumps(manifest, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
