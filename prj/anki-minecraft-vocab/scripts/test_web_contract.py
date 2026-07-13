import unittest
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


class WebContractTests(unittest.TestCase):
    def test_static_app_has_required_surfaces(self):
        html = (ROOT / "index.html").read_text(encoding="utf-8")
        app = (ROOT / "app.js").read_text(encoding="utf-8")
        styles = (ROOT / "styles.css").read_text(encoding="utf-8")

        for marker in ("data-directory", "data-search", "data-card-list", "data-card-detail"):
            self.assertIn(marker, html)
        for marker in ("data/manifest.json", "data/decks.json", "data/cards.json", "renderDirectory", "toggleAnswer"):
            self.assertIn(marker, app)
        self.assertIn("state.selectedPath = state.tree[0]?.path || []", app)
        self.assertIn("prefers-reduced-motion", styles)
        self.assertIn("@media", styles)

    def test_output_data_exists_and_is_json(self):
        for relative in ("data/manifest.json", "data/decks.json", "data/cards.json"):
            path = ROOT / relative
            self.assertTrue(path.exists(), relative)
            self.assertGreater(path.stat().st_size, 0, relative)

    def test_generated_inventory_matches_source_snapshot(self):
        manifest = json.loads((ROOT / "data" / "manifest.json").read_text(encoding="utf-8"))
        decks = json.loads((ROOT / "data" / "decks.json").read_text(encoding="utf-8"))
        cards = json.loads((ROOT / "data" / "cards.json").read_text(encoding="utf-8"))

        self.assertEqual(manifest["databaseEntry"], "collection.anki21")
        self.assertEqual(manifest["schemaVersion"], 2)
        self.assertEqual(manifest["noteCount"], 11241)
        self.assertEqual(manifest["cardCount"], 11241)
        self.assertEqual(manifest["deckCount"], 231)
        self.assertEqual(manifest["mediaCount"], 4956)
        self.assertEqual(manifest["curatedMediaCount"], 4956)
        self.assertEqual(manifest["sourceMediaCount"], 6847)
        self.assertEqual(manifest["encryptedFieldCount"], 0)
        self.assertEqual(manifest["sourceEncryptedFieldCount"], 119880)
        self.assertEqual(len(cards), manifest["cardCount"])
        self.assertEqual(len(decks["flat"]), manifest["deckCount"])
        self.assertEqual(decks["tree"][0]["cardCount"], 11241)
        self.assertEqual(decks["tree"][0]["children"][0]["cardCount"], 7578)
        self.assertEqual(decks["tree"][0]["children"][1]["cardCount"], 3663)

        for card in cards:
            content = card["content"]
            for field in ("word", "chinese", "phrase", "phraseTranslation", "sentence", "sentenceTranslation"):
                self.assertTrue(content[field], f"missing content.{field} for {card['id']}")
                self.assertNotRegex(content[field], r"[≯≮#]")
                self.assertNotIn("Minecraft词条", content[field])
            self.assertEqual(content["schemaVersion"], 1)
            self.assertFalse(any(field.get("encrypted") for field in card["fields"].values()))
            for media in card["media"]:
                if media["kind"] == "image":
                    self.assertNotIn("哈基米薯仔.png", media["name"])
                    self.assertNotRegex(media["name"], r"^(?:show(?:-|\.)|[0-9a-f]{24,})")


if __name__ == "__main__":
    unittest.main()
