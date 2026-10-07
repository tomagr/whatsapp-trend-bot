import json
import os
import shutil
import tempfile
import unittest
from pathlib import Path


class AddedGroupsTest(unittest.TestCase):
    """Groups added from /admin reach the pipeline through state/groups-added.json (written by the poller)."""

    def setUp(self):
        self.home = Path(tempfile.mkdtemp())
        (self.home / "state").mkdir()
        os.environ["TRENDBOT_HOME"] = str(self.home)
        import importlib, trendbot.store
        self.store = importlib.reload(trendbot.store)

    def tearDown(self):
        shutil.rmtree(self.home)
        os.environ.pop("TRENDBOT_HOME")
        os.environ.pop("TRENDBOT_ONLY", None)

    def write(self, groups):
        (self.home / "state" / "groups-added.json").write_text(json.dumps(groups))

    def test_added_groups_follow_the_built_in_ones(self):
        self.write([{"key": "campers", "name": "Campers", "lang": "es", "vendor_mode": "sentiment", "context": "c",
                     "privacy": {"scrub_child_names": False}}])
        keys = [c["key"] for c in self.store.groups()]
        self.assertEqual(keys[:5], ["overland", "sombreros", "members", "briefings", "moves"])
        self.assertEqual(keys[5:], ["campers"])

    def test_an_added_group_never_overrides_a_built_in_one(self):
        self.write([{"key": "overland", "name": "Other", "lang": "en", "vendor_mode": "type", "context": "c"}])
        cfg = [c for c in self.store.groups() if c["key"] == "overland"]
        self.assertEqual(len(cfg), 1)
        self.assertEqual(cfg[0]["name"], "Argentina Overland Trucks")

    def test_incomplete_entries_are_skipped(self):
        self.write([{"key": "x", "name": "X"}, {"key": "ok", "name": "OK", "lang": "en", "vendor_mode": "type", "context": "c"}])
        self.assertIn("ok", [c["key"] for c in self.store.groups()])
        self.assertNotIn("x", [c["key"] for c in self.store.groups()])

    def test_context_is_optional_and_comes_from_what_claude_inferred(self):
        self.write([{"key": "campers", "name": "Campers", "lang": "es", "vendor_mode": "sentiment"}])
        cfg = next(c for c in self.store.groups() if c["key"] == "campers")
        self.assertEqual((cfg["context"], cfg["context_inferred"]), ("", False))
        (self.home / "state" / "campers").mkdir()
        (self.home / "state" / "campers" / "context.json").write_text(json.dumps({"text": "Viajeros en motorhome"}))
        cfg = next(c for c in self.store.groups() if c["key"] == "campers")
        self.assertEqual((cfg["context"], cfg["context_inferred"]), ("Viajeros en motorhome", True))

    def test_only_can_pick_an_added_group(self):
        self.write([{"key": "campers", "name": "Campers", "lang": "es", "vendor_mode": "sentiment", "context": "c"}])
        os.environ["TRENDBOT_ONLY"] = "campers"
        self.assertEqual([c["key"] for c in self.store.groups()], ["campers"])


class RemovedGroupsTest(AddedGroupsTest):
    def test_removed_groups_are_skipped_built_in_or_added(self):
        self.write([{"key": "campers", "name": "Campers", "lang": "es", "vendor_mode": "sentiment", "context": "c"}])
        (self.home / "state" / "groups-removed.json").write_text(json.dumps(["overland", "campers"]))
        keys = [c["key"] for c in self.store.groups()]
        self.assertNotIn("overland", keys)
        self.assertNotIn("campers", keys)
        self.assertIn("members", keys)


if __name__ == "__main__":
    unittest.main()
