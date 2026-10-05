#!/usr/bin/env python3
"""Extract messages from WhatsApp groups through WhatsApp Web (wa/export.mjs, headless Chrome).

WhatsApp Web must be linked once: `python3 -m trendbot login` opens a window to scan the QR with the phone.
Only what WhatsApp Web can load from the phone is available (archived chats included).

Usage:
    python3 extract_group.py                                  # defaults to "Argentina Overland Trucks"
    python3 extract_group.py --group "Some Other Group" --out-dir exports --since 2026-09-01
"""

import argparse
import json
import re
import shutil
import subprocess
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent
EXPORTER = ROOT / "wa" / "export.mjs"
SESSION_DIR = ROOT / ".wa-session"

# WhatsApp Web message types -> the names the rest of the pipeline uses
MESSAGE_TYPES = {
    "chat": "text",
    "image": "image",
    "album": "image",
    "video": "video",
    "audio": "audio",
    "ptt": "audio",
    "vcard": "contact",
    "multi_vcard": "contact",
    "location": "location",
    "document": "document",
    "sticker": "sticker",
    "revoked": "deleted",
    "poll_creation": "poll",
    "scheduled_event_creation": "event",
}
SYSTEM_TYPES = {"notification", "notification_template", "gp2", "group_notification", "e2e_notification",
                "call_log", "protocol", "broadcast_notification", "ciphertext", "debug", "reaction",
                "message_history_notice", "pinned_message",
                "unknown"}  # media WhatsApp Web cannot decode; no text to analyse


def _node():
    return shutil.which("node") or "/opt/homebrew/bin/node"


def _run(cmd, payload=None, timeout=1800):
    # cwd=wa/ so puppeteer reads wa/.puppeteerrc.cjs (its Chrome lives in wa/.cache, not ~/.cache)
    return subprocess.run([_node(), str(EXPORTER), cmd], input=json.dumps(payload) if payload else "",
                          capture_output=True, text=True, timeout=timeout, cwd=EXPORTER.parent)


def check(timeout=240):
    """'ok', 'not-linked' (needs a QR scan), or raises with the exporter's error."""
    res = _run("check", timeout=timeout)
    if res.returncode in (0, 3):
        return res.stdout.strip()
    raise RuntimeError(res.stderr.strip()[-500:] or "WhatsApp Web check failed")


def login():
    """Open a visible WhatsApp Web window and wait for the QR scan (interactive)."""
    return subprocess.run([_node(), str(EXPORTER), "login"], cwd=EXPORTER.parent).returncode


def _to_message(r):
    if r["type"] in SYSTEM_TYPES:
        kind = "system"
    else:
        kind = MESSAGE_TYPES.get(r["type"], r["type"])
        if kind == "text" and r.get("url"):
            kind = "link"
    msg = {
        "id": r["id"],
        "ts": r["t"],
        "timestamp": datetime.fromtimestamp(r["t"]).astimezone().isoformat(),
        "sender_jid": "me" if r["from_me"] else r.get("author"),
        "sender_name": r.get("author_name") or "Unknown",
        "type": kind,
        "text": r.get("body") or None,
        "starred": r.get("starred", False),
    }
    if kind == "document" and r.get("filename"):
        msg["title"] = r["filename"]
    elif kind in ("link", "poll", "event") and r.get("title"):
        msg["title"] = r["title"]
    if kind == "link":
        msg["url"] = r["url"]
    if kind == "location" and r.get("lat") is not None:
        msg["location"] = {"lat": r["lat"], "lon": r["lng"]}
    if kind == "contact" and r.get("vcard_name"):
        msg["contact_name"] = r["vcard_name"]
        msg["text"] = None  # body is the raw vCard
    return msg


def fetch(requests, timeout=1800):
    """requests: [(group_name, since_unix_ts)]. One WhatsApp Web session for all groups.

    Returns {group_name: (chat, messages)} or {group_name: Exception} for groups that could not be read.
    """
    res = _run("export", {"groups": [{"name": n, "since": int(s or 0)} for n, s in requests]}, timeout=timeout)
    if res.returncode != 0:
        raise RuntimeError(res.stderr.strip()[-500:] or res.stdout.strip() or "WhatsApp Web export failed")
    out = {}
    for name, g in json.loads(res.stdout)["groups"].items():
        out[name] = (RuntimeError(g["error"]) if "error" in g
                     else (g["chat"], [_to_message(r) for r in g["messages"]]))
    return out


def extract(group_name, since=0):
    result = fetch([(group_name, since)])[group_name]
    if isinstance(result, Exception):
        raise SystemExit(str(result))
    return result


def to_text_line(m) -> str:
    ts = datetime.fromisoformat(m["timestamp"]).strftime("%Y-%m-%d %H:%M:%S")
    if m["type"] == "system":
        return f"[{ts}] -- system event --"
    body = m["text"] or ""
    if m["type"] not in ("text", "link"):
        extra = m.get("title") or m.get("contact_name") or ""
        if "location" in m:
            extra = f"{m['location']['lat']}, {m['location']['lon']}"
        body = f"<{m['type']}{': ' + extra if extra else ''}>" + (f" {body}" if body else "")
    return f"[{ts}] {m['sender_name']}: {body}"


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--group", default="Argentina Overland Trucks", help="Group name (exact or partial)")
    parser.add_argument("--out-dir", default="exports", help="Output directory")
    parser.add_argument("--since", help="Only messages from this date on (YYYY-MM-DD); default: all WhatsApp Web can load")
    args = parser.parse_args()

    since = datetime.fromisoformat(args.since).astimezone().timestamp() if args.since else 0
    chat, messages = extract(args.group, since)

    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    slug = re.sub(r"[^a-z0-9]+", "_", chat["name"].lower()).strip("_")

    json_path = out_dir / f"{slug}.json"
    json_path.write_text(
        json.dumps(
            {
                "group_name": chat["name"],
                "group_jid": chat["jid"],
                "archived": chat["archived"],
                "exported_at": datetime.now().astimezone().isoformat(),
                "message_count": len(messages),
                "messages": messages,
            },
            ensure_ascii=False,
            indent=2,
        )
    )

    txt_path = out_dir / f"{slug}.txt"
    txt_path.write_text("\n".join(to_text_line(m) for m in messages) + "\n")

    first, last = (messages[0]["timestamp"], messages[-1]["timestamp"]) if messages else ("-", "-")
    print(f"Group:    {chat['name']} (archived={chat['archived']})")
    print(f"Messages: {len(messages)}  ({first} → {last})")
    print(f"Wrote:    {json_path}\n          {txt_path}")


if __name__ == "__main__":
    main()
