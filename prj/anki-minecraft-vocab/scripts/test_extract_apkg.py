import json
import sqlite3
import tempfile
import unittest
import zipfile
from pathlib import Path


class ExtractApkgTests(unittest.TestCase):
    def make_package(self, root: Path) -> Path:
        db_path = root / "collection.anki21"
        connection = sqlite3.connect(db_path)
        connection.executescript(
            """
            CREATE TABLE col (decks TEXT NOT NULL, models TEXT NOT NULL);
            CREATE TABLE notes (
                id INTEGER PRIMARY KEY,
                guid TEXT NOT NULL,
                mid INTEGER NOT NULL,
                mod INTEGER NOT NULL,
                usn INTEGER NOT NULL,
                tags TEXT NOT NULL,
                flds TEXT NOT NULL,
                sfld INTEGER NOT NULL,
                csum INTEGER NOT NULL,
                flags INTEGER NOT NULL,
                data TEXT NOT NULL
            );
            CREATE TABLE cards (
                id INTEGER PRIMARY KEY,
                nid INTEGER NOT NULL,
                did INTEGER NOT NULL,
                ord INTEGER NOT NULL,
                mod INTEGER NOT NULL,
                usn INTEGER NOT NULL,
                type INTEGER NOT NULL,
                queue INTEGER NOT NULL,
                due INTEGER NOT NULL,
                ivl INTEGER NOT NULL,
                factor INTEGER NOT NULL,
                reps INTEGER NOT NULL,
                lapses INTEGER NOT NULL,
                left INTEGER NOT NULL,
                odue INTEGER NOT NULL,
                odid INTEGER NOT NULL,
                flags INTEGER NOT NULL,
                data TEXT NOT NULL
            );
            """
        )
        decks = {
            "1": {"id": 1, "name": "Minecraft::Blocks::Stone", "desc": ""},
            "2": {"id": 2, "name": "Minecraft::Mobs", "desc": ""},
        }
        models = {
            "10": {
                "id": 10,
                "name": "Basic",
                "flds": [{"name": "Front"}, {"name": "Back"}, {"name": "Empty"}],
                "tmpls": [{"name": "Card 1", "qfmt": "{{Front}}", "afmt": "{{Back}}"}],
                "css": ".card { color: black; }",
            }
        }
        connection.execute("INSERT INTO col VALUES (?, ?)", (json.dumps(decks), json.dumps(models)))
        connection.execute(
            "INSERT INTO notes VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (100, "guid", 10, 0, 0, "tag-a tag-b", "stone" + chr(31) + "<b>石头</b><img src=\"stone.png\">" + chr(31), 0, 0, 0, ""),
        )
        card_values = (200, 100, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, "")
        connection.execute("INSERT INTO cards VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)", card_values)
        connection.commit()
        connection.close()

        package_path = root / "fixture.apkg"
        with zipfile.ZipFile(package_path, "w") as package:
            package.writestr("collection.anki2", b"legacy")
            package.write(db_path, "collection.anki21")
            package.writestr("media", json.dumps({"0": "stone.png"}))
            package.writestr("0", b"fake image")
        return package_path

    def test_extracts_modern_database_and_normalizes_card(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            package_path = self.make_package(root)
            output = root / "output"

            from extract_apkg import extract_package

            manifest = extract_package(package_path, output, copy_media=True)

            self.assertEqual(manifest["databaseEntry"], "collection.anki21")
            self.assertEqual(manifest["noteCount"], 1)
            self.assertEqual(manifest["cardCount"], 1)
            self.assertEqual(manifest["mediaCount"], 1)

            decks = json.loads((output / "data" / "decks.json").read_text(encoding="utf-8"))
            self.assertEqual(decks["flat"][0]["path"], ["Minecraft", "Blocks", "Stone"])
            self.assertEqual(decks["flat"][0]["cardCount"], 1)
            self.assertEqual(decks["tree"][0]["name"], "Minecraft")
            self.assertEqual(decks["tree"][0]["cardCount"], 1)
            self.assertEqual(decks["tree"][0]["children"][0]["name"], "Blocks")
            self.assertEqual(decks["tree"][0]["children"][0]["cardCount"], 1)

            cards = json.loads((output / "data" / "cards.json").read_text(encoding="utf-8"))
            card = cards[0]
            self.assertEqual(card["deckPath"], ["Minecraft", "Blocks", "Stone"])
            self.assertEqual(card["fields"]["Front"]["text"], "stone")
            self.assertEqual(card["fields"]["Back"]["text"], "石头")
            self.assertNotIn("Empty", card["fields"])
            self.assertEqual(card["media"][0]["path"], "assets/media/stone.png")
            self.assertNotIn("frontHtml", card)
            self.assertNotIn("backHtml", card)
            self.assertTrue((output / "assets" / "media" / "stone.png").exists())

    def test_rejects_media_path_traversal(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            package_path = self.make_package(root)
            rewritten = root / "unsafe.apkg"
            with zipfile.ZipFile(package_path) as source, zipfile.ZipFile(rewritten, "w") as target:
                for item in source.infolist():
                    content = source.read(item.filename)
                    if item.filename == "media":
                        content = json.dumps({"0": "../secret.png"}).encode("utf-8")
                    target.writestr(item, content)

            from extract_apkg import extract_package

            with self.assertRaises(ValueError):
                extract_package(rewritten, root / "output")


if __name__ == "__main__":
    unittest.main()
