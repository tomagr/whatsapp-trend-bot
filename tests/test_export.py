import json
import os
import shutil
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


class ExportTest(unittest.TestCase):
    def setUp(self):
        self.home = Path(tempfile.mkdtemp())
        shutil.copytree(ROOT / "state", self.home / "state")
        (self.home / "state" / "groups-added.json").unlink(missing_ok=True)  # only the built-in groups here
        os.environ["TRENDBOT_HOME"] = str(self.home)
        import importlib, trendbot.store, trendbot.pipeline
        importlib.reload(trendbot.store)
        self.pipeline = importlib.reload(trendbot.pipeline)

    def tearDown(self):
        shutil.rmtree(self.home)
        os.environ.pop("TRENDBOT_HOME")

    def test_writes_a_snapshot_per_group(self):
        out = self.pipeline.export()
        self.assertEqual(set(out), {"overland", "sombreros", "members", "briefings", "moves"})
        snap = json.loads((self.home / "state" / "overland" / "site.json").read_text())
        self.assertEqual(snap["group"]["key"], "overland")
        self.assertEqual(snap["group"]["vendorMode"], "sentiment")
        self.assertEqual(snap["group"]["lang"], "es")
        self.assertRegex(snap["group"]["messagesThrough"], r"^\d{4}-\d{2}-\d{2}$")
        self.assertEqual(len(snap["vendors"]), out["overland"]["vendors"])
        first = next(iter(snap["opportunities"].values()))
        self.assertIn("rank", first)
        self.assertIn("title", first)
        self.assertNotIn("meta", json.dumps(list(snap["vendors"])))

    def test_no_pending_folder_is_created(self):
        for d in (self.home / "state").glob("*/pending"):  # left by runs before the site existed
            shutil.rmtree(d)
        self.pipeline.export()
        self.assertFalse((self.home / "state" / "overland" / "pending").exists())


if __name__ == "__main__":
    unittest.main()
