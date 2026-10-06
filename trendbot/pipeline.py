"""Weekly pipeline steps. Each step reads/writes files so a failed step can be re-run on its own."""
import json
import re
import shutil
import subprocess
from datetime import datetime
from pathlib import Path

import extract_group as wa

from . import model
from .store import RUNS, ROOT, STATE, group_dir, groups, load, save

TAIL_LINES = 20
SKIP = re.compile(r"-- system event --|: <(image|sticker|gif|video|deleted|audio|type_\d+)>$")
PROMPT = ROOT / "prompts" / "analyze.md"


def _now():
    return datetime.now().astimezone().isoformat(timespec="seconds")


def _cursor_epoch(cursor):
    return datetime.fromisoformat(cursor["last_ts"]).timestamp() if cursor.get("last_ts") else 0


def _is_new(m, cursor, since):
    """After the cursor; messages in the cursor's last second count unless their id was already analysed."""
    if "last_ids" not in cursor:  # cursor from the old desktop database: fractional timestamp, no ids
        return m["ts"] > since
    return m["ts"] > since or (m["ts"] == since and m["id"] not in cursor["last_ids"])


def _latest_run():
    runs = sorted(p for p in RUNS.glob("*") if p.is_dir())
    return runs[-1] if runs else None


# ---- 1. prepare: read only messages sent after the cursor ----

KEEP_RUNS = 4


def _save_photo(gdir, chat):
    """Keep the group picture WhatsApp Web returned; leave the stored one when it could not be read."""
    if "photo" not in chat:
        return
    if chat["photo"]:
        save(gdir / "photo.json", {"mime": chat["photo"]["mime"], "data": chat["photo"]["data"]})
    else:  # the group has no picture (any more)
        (gdir / "photo.json").unlink(missing_ok=True)


def prepare():
    for old in sorted(p for p in RUNS.glob("*") if p.is_dir())[:-(KEEP_RUNS - 1) or None]:
        shutil.rmtree(old, ignore_errors=True)  # runs only hold model I/O; state/ is the record
    run = RUNS / datetime.now().strftime("%Y%m%d-%H%M%S")
    manifest = {"created_at": _now(), "groups": {}}
    cursors = {cfg["key"]: load(group_dir(cfg["key"]) / "cursor.json", {}) for cfg in groups()}
    try:
        fetched = wa.fetch([(cfg["name"], int(_cursor_epoch(cursors[cfg["key"]]))) for cfg in groups()])
    except Exception as e:  # WhatsApp Web not linked or not loading: every group fails, cursors stay put
        manifest["wa_error"] = str(e)[:500]
        fetched = {cfg["name"]: e for cfg in groups()}
    for cfg in groups():
        key, gdir, cursor = cfg["key"], group_dir(cfg["key"]), cursors[cfg["key"]]
        result = fetched.get(cfg["name"], RuntimeError("not returned by WhatsApp Web"))
        if isinstance(result, Exception):
            manifest["groups"][key] = {"status": "fetch-failed", "error": str(result)[:500]}
            continue
        _save_photo(gdir, result[0])  # also when there are no new messages
        since = _cursor_epoch(cursor)
        msgs = [m for m in result[1] if _is_new(m, cursor, since)]
        if not msgs:
            manifest["groups"][key] = {"status": "no-new-messages"}
            continue
        lines = [l for l in (wa.to_text_line(m) for m in msgs) if not SKIP.search(l)]
        last = max(m["ts"] for m in msgs)
        out = run / key
        out.mkdir(parents=True)
        (out / "delta.txt").write_text("\n".join(lines) + "\n", encoding="utf-8")
        vendors = load(gdir / "vendors.json", {})
        clusters = load(gdir / "opportunities.json", {})
        save(out / "input.json", {
            "group": cfg["name"], "lang": cfg["lang"], "context": cfg["context"],
            "vendor_mode": cfg["vendor_mode"], "vendor_types": cfg.get("vendor_types", []),
            "existing_vendors": [{"id": i, "name": v["doc"]["name"], "category": v["doc"]["category"]} for i, v in vendors.items()],
            "existing_opportunities": [{"key": k, "title": c["title"], "summary": c.get("summary", "")} for k, c in clusters.items()],
        })
        latest_ts = datetime.fromtimestamp(last).astimezone().isoformat()
        manifest["groups"][key] = {"status": "prepared", "new_rows": len(msgs), "lines": len(lines),
                                    "latest_date": latest_ts[:10], "latest_ts": latest_ts,
                                    "last_ids": [m["id"] for m in msgs if m["ts"] == last]}
    save(run / "manifest.json", manifest)
    return run, manifest


# ---- 2. analyze: one headless Claude Code call per group, new messages only ----

def _extract_json(text):
    start, end = text.find("{"), text.rfind("}")
    if start < 0 or end < 0:
        raise ValueError("no JSON object in model output")
    return json.loads(text[start:end + 1])


def _validate(a):
    assert isinstance(a.get("vendors", []), list) and isinstance(a.get("signals", []), list)
    assert isinstance(a.get("new_opportunities", []), list)
    for v in a.get("vendors", []):
        assert v.get("vendor"), "vendor without name"
    for s in a.get("signals", []):
        assert s.get("need") and s.get("date") and s.get("opportunity"), "incomplete signal"
    return a


def analyze(run=None, model_name="sonnet", timeout=900):
    run = Path(run) if run else _latest_run()
    manifest = load(run / "manifest.json", {})
    template = PROMPT.read_text(encoding="utf-8")
    for cfg in groups():
        info = manifest["groups"].get(cfg["key"], {})
        if info.get("status") != "prepared":
            continue
        out = run / cfg["key"]
        tail = (group_dir(cfg["key"]) / "tail.txt")
        prompt = (template
                  .replace("{{INPUT_JSON}}", (out / "input.json").read_text(encoding="utf-8"))
                  .replace("{{CONTEXT_LINES}}", tail.read_text(encoding="utf-8") if tail.exists() else "(none)")
                  .replace("{{NEW_MESSAGES}}", (out / "delta.txt").read_text(encoding="utf-8")))
        try:
            res = subprocess.run(["claude", "-p", "--model", model_name, "--output-format", "json",
                                  "--setting-sources", "user",  # skip this project's SessionStart hook
                                  # Chat text is untrusted: no built-in tools and no MCP servers, so it can only produce text.
                                  "--tools", "", "--strict-mcp-config"],
                                 input=prompt, capture_output=True, text=True, timeout=timeout, cwd=out)
            if res.returncode != 0:
                raise RuntimeError(res.stderr.strip()[-500:] or "claude exited with an error")
            envelope = json.loads(res.stdout)
            analysis = _validate(_extract_json(envelope.get("result", "")))
            save(out / "analysis.json", analysis)
            info.update(status="analyzed", vendors=len(analysis["vendors"]), signals=len(analysis["signals"]))
        except Exception as e:  # leave the group "prepared"; the cursor does not move, next run retries
            info.update(status="analysis-failed", error=str(e)[:500])
        save(run / "manifest.json", manifest)
    return manifest


# ---- 3. merge: fold the analysis into state, advance the cursor, drop raw text ----

def merge(run=None):
    run = Path(run) if run else _latest_run()
    manifest = load(run / "manifest.json", {})
    for cfg in groups():
        key = cfg["key"]
        info = manifest["groups"].get(key, {})
        if info.get("status") != "analyzed":
            continue
        gdir, out = group_dir(key), run / key
        a = load(out / "analysis.json", {})
        vendors = load(gdir / "vendors.json", {})
        signals = load(gdir / "signals.json", [])
        clusters = load(gdir / "opportunities.json", {})
        scrub = model.Scrubber(cfg.get("privacy", {}), [s["asker"] for s in signals] +
                               [s.get("asker", "") for s in a.get("signals", [])])
        for m in a.get("vendors", []):
            model.merge_vendor(vendors, m, cfg, scrub)
        for o in a.get("new_opportunities", []):
            if o.get("key") and o["key"] not in clusters and o.get("title"):
                clusters[o["key"]] = {k: o.get(k, "") for k in ("title", "summary", "offer", "alternatives")}
        added = 0
        for s in a.get("signals", []):
            if s["opportunity"] not in clusters:
                continue  # unassigned needs are not displayed, so they are not stored
            signals.append({"need": s["need"], "date": s["date"], "asker": s.get("asker", ""),
                            "answered": s.get("answered", "partial"), "quote": scrub(s.get("quote", ""))[:200],
                            "opp": s["opportunity"]})
            added += 1
        save(gdir / "vendors.json", vendors)
        save(gdir / "signals.json", signals)
        save(gdir / "opportunities.json", clusters)
        lines = (out / "delta.txt").read_text(encoding="utf-8").splitlines()
        (gdir / "tail.txt").write_text("\n".join(lines[-TAIL_LINES:]) + "\n", encoding="utf-8")
        save(gdir / "cursor.json", {"last_ts": info["latest_ts"], "last_ids": info["last_ids"], "updated_at": _now()})
        meta = load(gdir / "meta.json", {})
        meta["messagesThrough"] = max(meta.get("messagesThrough", ""), info["latest_date"])
        save(gdir / "meta.json", meta)
        (out / "delta.txt").unlink()
        info.update(status="merged", signals_kept=added)
        save(run / "manifest.json", manifest)
    return manifest


# ---- 4. export: one full snapshot per group for the site ----

def build_docs(cfg):
    gdir = group_dir(cfg["key"])
    vendors = load(gdir / "vendors.json", {})
    signals = load(gdir / "signals.json", [])
    clusters = load(gdir / "opportunities.json", {})
    scrub = model.Scrubber(cfg.get("privacy", {}), [s["asker"] for s in signals])
    docs = {f"vendors/{i}": v["doc"] for i, v in vendors.items()}
    docs.update({f"opportunities/{i}": d for i, d in model.opportunity_docs(clusters, signals, cfg["lang"], scrub).items()})
    meta = load(gdir / "meta.json", None)
    if meta:  # shown in each page header: last weekly check and newest message analysed
        docs["meta/status"] = meta
    return docs


def export():
    """Write state/<key>/site.json; web/scripts/sync.mts copies it into Postgres."""
    out = {}
    for cfg in groups():
        docs = build_docs(cfg)
        meta = docs.pop("meta/status", None) or {}
        snap = {
            "group": {"key": cfg["key"], "name": cfg["name"], "lang": cfg["lang"], "vendorMode": cfg["vendor_mode"],
                      "checkedAt": meta.get("checkedAt"), "messagesThrough": meta.get("messagesThrough"),
                      "photo": load(group_dir(cfg["key"]) / "photo.json", None)},
            "vendors": {p.split("/", 1)[1]: d for p, d in docs.items() if p.startswith("vendors/")},
            "opportunities": {p.split("/", 1)[1]: d for p, d in docs.items() if p.startswith("opportunities/")},
        }
        save(group_dir(cfg["key"]) / "site.json", snap)
        out[cfg["key"]] = {"vendors": len(snap["vendors"]), "opportunities": len(snap["opportunities"])}
    return out


# ---- 5. sync: copy the snapshots into the site's database ----

WEB = ROOT / "web"


def sync(timeout=300):
    """Copy the snapshots into the site's database. Always records the outcome in the run's sync.json."""
    node = shutil.which("node") or "/opt/homebrew/bin/node"
    try:
        res = subprocess.run([node, "--import", "tsx", "scripts/sync.mts", "--state", str(STATE)],
                             cwd=WEB, capture_output=True, text=True, timeout=timeout)
    except Exception as e:  # e.g. timeout: still leave a record so the summary reports the failure
        result = {"results": [], "failed": [{"key": "*", "error": str(e)[:500]}]}
        latest = _latest_run()
        if latest:
            save(latest / "sync.json", result)
        raise RuntimeError(f"sync did not finish: {e}") from e
    print(res.stdout, end="")
    line = next((l for l in res.stdout.splitlines() if l.startswith("SYNC_JSON ")), None)
    result = (json.loads(line[len("SYNC_JSON "):]) if line
              else {"results": [], "failed": [{"key": "*", "error": res.stderr.strip()[-500:]}]})
    latest = _latest_run()
    if latest:
        save(latest / "sync.json", result)
    if res.returncode != 0:
        raise RuntimeError("; ".join(f"{f['key']}: {f['error']}" for f in result["failed"]) or "sync failed")
    return result


def mark_checked(run=None):
    """Record the date of a completed weekly check for every group that did not fail."""
    run = Path(run) if run else _latest_run()
    manifest = load(run / "manifest.json", {"groups": {}})
    today = datetime.now().strftime("%Y-%m-%d")
    for cfg in groups():
        if manifest["groups"].get(cfg["key"], {}).get("status") in ("merged", "no-new-messages"):
            gdir = group_dir(cfg["key"])
            meta = load(gdir / "meta.json", {})
            meta["checkedAt"] = today
            save(gdir / "meta.json", meta)


def run_summary(run=None):
    """One line per group for the notification and the log."""
    run = Path(run) if run else _latest_run()
    manifest = load(run / "manifest.json", {"groups": {}})
    site = load(run / "sync.json", None)
    parts, failed = [], []
    for cfg in groups():
        g = manifest["groups"].get(cfg["key"], {})
        st = g.get("status", "not-run")
        if st == "merged":
            parts.append(f"{cfg['key']}: {g.get('lines', 0)} msgs, {g.get('vendors', 0)} vendors, {g.get('signals_kept', 0)} requests")
        elif st == "no-new-messages":
            parts.append(f"{cfg['key']}: no new messages")
        else:
            failed.append(cfg["key"])
    warning = ("No se pudo leer WhatsApp Web: corré `python3 -m trendbot login` y escaneá el QR con el celular"
               if manifest.get("wa_error") else None)
    if site is None:  # the run ended before the sync recorded anything: the site was not updated
        site = {"results": [], "failed": [{"key": "*", "error": "sync did not run"}]}
    return {"lines": parts, "failed": failed, "warning": warning,
            "site": {"ok": not site["failed"],
                                               "vendors": sum(r["upserted"] for r in site["results"]),
                                               "opportunities": sum(r["opportunities"] for r in site["results"])}}
