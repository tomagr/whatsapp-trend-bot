import json
import os
import shutil
import tempfile
import unittest
from pathlib import Path
from unittest import mock


class InferContextTest(unittest.TestCase):
    """A group added without "What is the group about?" gets that from Claude on its first analysis."""

    def setUp(self):
        self.home = Path(tempfile.mkdtemp())
        (self.home / "state" / "campers").mkdir(parents=True)
        (self.home / "state" / "groups-added.json").write_text(json.dumps([{
            "key": "campers", "name": "Campers", "lang": "es", "vendor_mode": "sentiment", "context": "", "added": True}]))
        os.environ["TRENDBOT_HOME"] = str(self.home)
        os.environ["TRENDBOT_ONLY"] = "campers"
        import importlib, trendbot.store, trendbot.pipeline
        importlib.reload(trendbot.store)
        self.pipeline = importlib.reload(trendbot.pipeline)
        self.run = self.home / "runs" / "r1" / "campers"
        self.run.mkdir(parents=True)
        (self.run / "delta.txt").write_text("[2026-10-01 10:00:00] Ana: alguien conoce un taller para la casilla?\n" * 3)
        (self.run / "input.json").write_text(json.dumps({"group": "Campers", "context": ""}))
        (self.home / "runs" / "r1" / "manifest.json").write_text(json.dumps({"groups": {"campers": {"status": "prepared"}}}))
        self.calls = []

    def tearDown(self):
        shutil.rmtree(self.home)
        os.environ.pop("TRENDBOT_HOME"); os.environ.pop("TRENDBOT_ONLY")

    def fake_claude(self, prompt, **kw):
        self.calls.append(prompt)
        return ' "Argentine motorhome travellers sharing workshops, campsites and gear." '

    def test_infers_saves_and_feeds_the_analysis(self):
        fake_run = mock.Mock(return_value=mock.Mock(returncode=0, stdout=json.dumps({"result": '{"vendors": [], "signals": [], "new_opportunities": []}'})))
        with mock.patch.object(self.pipeline, "_ask_claude", self.fake_claude), mock.patch.object(self.pipeline.subprocess, "run", fake_run):
            manifest = self.pipeline.analyze(self.home / "runs" / "r1")
        self.assertEqual(len(self.calls), 1)
        self.assertIn("taller para la casilla", self.calls[0])
        text = "Argentine motorhome travellers sharing workshops, campsites and gear."
        self.assertEqual(json.loads((self.home / "state" / "campers" / "context.json").read_text())["text"], text)
        self.assertEqual(json.loads((self.run / "input.json").read_text())["context"], text)
        self.assertIn(text, fake_run.call_args.kwargs["input"])  # the analysis prompt carries it
        self.assertEqual(manifest["groups"]["campers"]["status"], "analyzed")
        # From now on the config has it, and the site gets it through the snapshot.
        cfg = self.pipeline.groups()[0]
        self.assertEqual(cfg["context"], text)
        self.pipeline.export()
        self.assertEqual(json.loads((self.home / "state" / "campers" / "site.json").read_text())["group"]["context"], text)

    def test_a_failed_call_leaves_the_context_empty_and_the_analysis_runs(self):
        fake_run = mock.Mock(return_value=mock.Mock(returncode=0, stdout=json.dumps({"result": '{"vendors": [], "signals": [], "new_opportunities": []}'})))
        with mock.patch.object(self.pipeline, "_ask_claude", side_effect=RuntimeError("down")), mock.patch.object(self.pipeline.subprocess, "run", fake_run):
            manifest = self.pipeline.analyze(self.home / "runs" / "r1")
        self.assertFalse((self.home / "state" / "campers" / "context.json").exists())
        self.assertEqual(manifest["groups"]["campers"]["status"], "analyzed")
        self.pipeline.export()
        self.assertNotIn("context", json.loads((self.home / "state" / "campers" / "site.json").read_text())["group"])

    def test_a_written_context_is_never_replaced(self):
        (self.home / "state" / "groups-added.json").write_text(json.dumps([{
            "key": "campers", "name": "Campers", "lang": "es", "vendor_mode": "sentiment", "context": "Viajeros", "added": True}]))
        fake_run = mock.Mock(return_value=mock.Mock(returncode=0, stdout=json.dumps({"result": '{"vendors": [], "signals": [], "new_opportunities": []}'})))
        with mock.patch.object(self.pipeline, "_ask_claude", self.fake_claude), mock.patch.object(self.pipeline.subprocess, "run", fake_run):
            self.pipeline.analyze(self.home / "runs" / "r1")
        self.assertEqual(self.calls, [])


if __name__ == "__main__":
    unittest.main()
