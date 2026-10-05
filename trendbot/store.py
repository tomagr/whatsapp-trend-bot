"""Paths and JSON persistence for the per-group state.

state/<key>/
  cursor.json         {"last_ts": iso, "last_ids": [ids], "updated_at": iso}   newest message already analysed
  tail.txt            last few analysed lines, given to the model as read-only context
  vendors.json        {id: {"doc": <published vendor doc>, "aliases": [names]}}
  signals.json        [compact demand signals, each with the opportunity key it belongs to]
  opportunities.json  {key: cluster definition (title, summary, offer, alternatives, gap?)}
  site.json           full snapshot for the site (written by `export`, read by web/scripts/sync.mts)
runs/<run_id>/        transient inputs/outputs of one weekly run (raw message text is deleted after merge)
"""
import hashlib
import json
import os
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
# TRENDBOT_HOME points state/ and runs/ elsewhere (used for dry runs on a copy)
HOME = Path(os.environ.get("TRENDBOT_HOME", ROOT))
STATE = HOME / "state"
RUNS = HOME / "runs"
CONFIG = ROOT / "groups.json"


def groups():
    return json.loads(CONFIG.read_text(encoding="utf-8"))


def group_dir(key):
    d = STATE / key
    d.mkdir(parents=True, exist_ok=True)
    return d


def load(path, default):
    path = Path(path)
    if not path.exists():
        return default
    return json.loads(path.read_text(encoding="utf-8"))


def save(path, data):
    """Atomic write so an interrupted run never leaves half a state file."""
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=path.parent, prefix=".tmp-")
    with os.fdopen(fd, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=1)
    os.replace(tmp, path)


def doc_hash(doc):
    return hashlib.sha1(json.dumps(doc, ensure_ascii=False, sort_keys=True).encode()).hexdigest()
