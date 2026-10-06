import json
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest import mock

import extract_group
from trendbot import pipeline

PHOTO = {"mime": "image/jpeg", "data": "/9j/AA=="}


class FetchPhotoTest(unittest.TestCase):
    def fetch(self, group):
        out = json.dumps({"groups": {"G": group}})
        done = subprocess.CompletedProcess([], 0, stdout=out, stderr="")
        with mock.patch.object(extract_group, "_run", return_value=done):
            return extract_group.fetch([("G", 0)])["G"]

    def test_photo_rides_on_the_chat(self):
        chat, msgs = self.fetch({"chat": {"id": "1@g.us", "name": "G"}, "messages": [], "photo": PHOTO})
        self.assertEqual(chat["photo"], PHOTO)
        self.assertEqual(msgs, [])

    def test_no_picture_is_none(self):
        chat, _ = self.fetch({"chat": {"id": "1@g.us", "name": "G"}, "messages": [], "photo": None})
        self.assertIn("photo", chat)
        self.assertIsNone(chat["photo"])

    def test_unread_picture_leaves_the_key_out(self):
        chat, _ = self.fetch({"chat": {"id": "1@g.us", "name": "G"}, "messages": []})
        self.assertNotIn("photo", chat)


class SavePhotoTest(unittest.TestCase):
    def setUp(self):
        self.dir = Path(tempfile.mkdtemp())

    def tearDown(self):
        shutil.rmtree(self.dir)

    def stored(self):
        p = self.dir / "photo.json"
        return json.loads(p.read_text()) if p.exists() else None

    def test_saves_and_replaces(self):
        pipeline._save_photo(self.dir, {"photo": PHOTO})
        self.assertEqual(self.stored(), PHOTO)
        pipeline._save_photo(self.dir, {"photo": {"mime": "image/png", "data": "iVBO"}})
        self.assertEqual(self.stored(), {"mime": "image/png", "data": "iVBO"})

    def test_unread_keeps_the_last_one(self):
        pipeline._save_photo(self.dir, {"photo": PHOTO})
        pipeline._save_photo(self.dir, {})
        self.assertEqual(self.stored(), PHOTO)

    def test_removed_picture_is_deleted(self):
        pipeline._save_photo(self.dir, {"photo": PHOTO})
        pipeline._save_photo(self.dir, {"photo": None})
        self.assertIsNone(self.stored())


if __name__ == "__main__":
    unittest.main()
