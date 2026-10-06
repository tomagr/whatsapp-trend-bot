import base64
import json
import os
import shutil
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
JPEG = b"\xff\xd8\xff\xe0fake-jpeg"


class GroupPhotoTest(unittest.TestCase):
    def setUp(self):
        self.home = Path(tempfile.mkdtemp())
        shutil.copytree(ROOT / "state", self.home / "state")
        for f in (self.home / "state").glob("*/photo*"):
            f.unlink()
        os.environ["TRENDBOT_HOME"] = str(self.home)
        import importlib, trendbot.store, trendbot.pipeline
        importlib.reload(trendbot.store)
        self.pipeline = importlib.reload(trendbot.pipeline)
        self.cfg = {c["key"]: c for c in trendbot.store.groups()}

    def tearDown(self):
        shutil.rmtree(self.home)
        os.environ.pop("TRENDBOT_HOME")

    def snap(self, key):
        self.pipeline.export()
        return json.loads((self.home / "state" / key / "site.json").read_text())["group"]

    def chat(self, photo):
        return {"id": "x@g.us", "name": "x", "photo": photo}

    def test_downloaded_photo_is_saved_and_exported(self):
        self.pipeline.save_photo(self.cfg["overland"], self.chat({"type": "image/jpeg", "data": base64.b64encode(JPEG).decode()}))
        self.assertEqual((self.home / "state" / "overland" / "photo.jpg").read_bytes(), JPEG)
        photo = self.snap("overland")["photo"]
        self.assertEqual(photo["file"], "photo.jpg")
        self.assertEqual(photo["type"], "image/jpeg")
        self.assertEqual(len(photo["sha256"]), 64)

    def test_a_failed_download_keeps_the_previous_photo(self):
        self.pipeline.save_photo(self.cfg["overland"], self.chat({"type": "image/jpeg", "data": base64.b64encode(JPEG).decode()}))
        self.pipeline.save_photo(self.cfg["overland"], {"id": "x@g.us", "name": "x"})  # no "photo" key: not read
        self.assertIsNotNone(self.snap("overland")["photo"])

    def test_a_group_without_photo_clears_it(self):
        self.pipeline.save_photo(self.cfg["overland"], self.chat({"type": "image/jpeg", "data": base64.b64encode(JPEG).decode()}))
        self.pipeline.save_photo(self.cfg["overland"], self.chat(None))
        self.assertIsNone(self.snap("overland")["photo"])
        self.assertFalse((self.home / "state" / "overland" / "photo.jpg").exists())

    def test_groups_that_scrub_child_names_never_publish_their_photo(self):
        self.pipeline.save_photo(self.cfg["sombreros"], self.chat({"type": "image/jpeg", "data": base64.b64encode(JPEG).decode()}))
        self.assertFalse(list((self.home / "state" / "sombreros").glob("photo*")))
        self.assertIsNone(self.snap("sombreros")["photo"])

    def test_unexpected_types_are_ignored(self):
        self.pipeline.save_photo(self.cfg["overland"], self.chat({"type": "text/html", "data": base64.b64encode(b"<x>").decode()}))
        self.assertIsNone(self.snap("overland")["photo"])


if __name__ == "__main__":
    unittest.main()
