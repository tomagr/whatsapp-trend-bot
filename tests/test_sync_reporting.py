import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


class SyncReportingTest(unittest.TestCase):
    def setUp(self):
        self.home = Path(tempfile.mkdtemp())
        shutil.copytree(ROOT / "state", self.home / "state")
        self.run_dir = self.home / "runs" / "20990101-000000"
        self.run_dir.mkdir(parents=True)
        (self.run_dir / "manifest.json").write_text(json.dumps(
            {"groups": {k: {"status": "no-new-messages"} for k in ["overland", "sombreros", "members", "briefings", "moves"]}}))
        os.environ["TRENDBOT_HOME"] = str(self.home)
        import importlib, trendbot.store, trendbot.pipeline
        importlib.reload(trendbot.store)
        self.pipeline = importlib.reload(trendbot.pipeline)

    def tearDown(self):
        shutil.rmtree(self.home)
        os.environ.pop("TRENDBOT_HOME")

    def test_sync_timeout_is_recorded_as_a_failure(self):
        with self.assertRaises(RuntimeError):
            self.pipeline.sync(timeout=0.01)
        result = json.loads((self.run_dir / "sync.json").read_text())
        self.assertTrue(result["failed"])

    def test_missing_sync_result_counts_as_site_failure(self):
        s = self.pipeline.run_summary()
        self.assertEqual(s["site"]["ok"], False)

    def test_summary_exits_3_when_the_site_was_not_updated(self):
        res = subprocess.run([sys.executable, "-m", "trendbot", "summary", "--text"], cwd=ROOT,
                             env={**os.environ, "TRENDBOT_HOME": str(self.home)}, capture_output=True, text=True)
        self.assertEqual(res.returncode, 3, res.stdout + res.stderr)
        self.assertIn("No se pudo actualizar el sitio", res.stdout)


if __name__ == "__main__":
    unittest.main()
