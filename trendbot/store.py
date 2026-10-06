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
ADDED = STATE / "groups-added.json"
REMOVED = STATE / "groups-removed.json"  # keys removed in /admin, built-in ones included
# Untracked {group_key: [names]} of children to scrub; kept out of git because the list itself is personal data.
PRIVATE_NAMES = ROOT / "privacy.local.json"


REQUIRED = ("key", "name", "lang", "vendor_mode", "context")


def groups():
    cfgs = json.loads(CONFIG.read_text(encoding="utf-8"))
    # Groups added from the site's /admin: the poller (web/scripts/poll-runs.mts) mirrors them here from the database.
    # They follow the built-in ones and can never replace one.
    known = {c["key"] for c in cfgs}
    for c in load(ADDED, []):
        if all(c.get(k) for k in REQUIRED) and c["key"] not in known:
            cfgs.append(c); known.add(c["key"])
    removed = set(load(REMOVED, []))
    cfgs = [c for c in cfgs if c["key"] not in removed]
    # Fail closed: without the names file the scrubber would silently publish those names.
    if any(c.get("privacy", {}).get("scrub_child_names") for c in cfgs) and not PRIVATE_NAMES.exists():
        raise FileNotFoundError(f"{PRIVATE_NAMES.name} is missing; copy it from the main machine before running the pipeline")
    extra = load(PRIVATE_NAMES, {})
    for c in cfgs:
        if extra.get(c["key"]):
            c.setdefault("privacy", {})["extra_names"] = extra[c["key"]]
    # TRENDBOT_ONLY=key[,key] runs every step for those groups only (an "Update" on one group in /admin).
    only = {k.strip() for k in os.environ.get("TRENDBOT_ONLY", "").split(",") if k.strip()}
    if only:
        unknown = only - {c["key"] for c in cfgs}
        if unknown:
            raise ValueError(f"TRENDBOT_ONLY names unknown groups: {', '.join(sorted(unknown))}")
        cfgs = [c for c in cfgs if c["key"] in only]
    return cfgs


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
