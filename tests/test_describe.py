import json
import os
import shutil
import tempfile
import unittest
from pathlib import Path
from unittest import mock

ROOT = Path(__file__).resolve().parent.parent


class DescribeTest(unittest.TestCase):
    """Groups added from /admin get their page description from Claude (trendbot describe)."""

    def setUp(self):
        self.home = Path(tempfile.mkdtemp())
        (self.home / "state" / "campers").mkdir(parents=True)
        (self.home / "state" / "groups-added.json").write_text(json.dumps([{
            "key": "campers", "name": "Campers", "lang": "es", "vendor_mode": "sentiment",
            "context": "Viajeros en motorhome", "added": True}]))
        os.environ["TRENDBOT_HOME"] = str(self.home)
        os.environ["TRENDBOT_ONLY"] = "campers"
        import importlib, trendbot.store, trendbot.pipeline
        importlib.reload(trendbot.store)
        self.pipeline = importlib.reload(trendbot.pipeline)
        self.calls = []

    def tearDown(self):
        shutil.rmtree(self.home)
        os.environ.pop("TRENDBOT_HOME"); os.environ.pop("TRENDBOT_ONLY")

    def vendors(self, n):
        docs = {f"v{i}": {"doc": {"name": f"Taller {i}", "category": "Mecánica" if i % 2 else "Campings"}} for i in range(n)}
        (self.home / "state" / "campers" / "vendors.json").write_text(json.dumps(docs))

    def fake_claude(self, prompt):
        self.calls.append(prompt)
        return "  Talleres y campings que recomiendan los viajeros del grupo.\n"

    def describe(self):
        with mock.patch.object(self.pipeline, "_ask_claude", self.fake_claude):
            return self.pipeline.describe()

    def test_writes_a_description_once_there_are_vendors(self):
        self.describe()
        self.assertEqual(self.calls, [])  # nothing to describe yet
        self.vendors(4)
        self.describe()
        self.assertEqual(len(self.calls), 1)
        self.assertIn("Mecánica", self.calls[0])
        self.assertIn("Spanish", self.calls[0])
        self.pipeline.export()
        snap = json.loads((self.home / "state" / "campers" / "site.json").read_text())
        self.assertEqual(snap["group"]["description"], "Talleres y campings que recomiendan los viajeros del grupo.")

    def test_rewritten_only_when_the_vendor_list_doubles(self):
        self.vendors(4); self.describe()
        self.vendors(7); self.describe()
        self.assertEqual(len(self.calls), 1)
        self.vendors(8); self.describe()
        self.assertEqual(len(self.calls), 2)

    def test_built_in_groups_keep_their_hand_written_copy(self):
        os.environ["TRENDBOT_ONLY"] = "overland"
        self.describe()
        self.assertEqual(self.calls, [])

    def test_a_failed_call_leaves_no_description(self):
        self.vendors(3)
        with mock.patch.object(self.pipeline, "_ask_claude", side_effect=RuntimeError("down")):
            self.pipeline.describe()
        self.assertFalse((self.home / "state" / "campers" / "description.json").exists())


if __name__ == "__main__":
    unittest.main()
