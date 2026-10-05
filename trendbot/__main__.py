"""CLI: python3 -m trendbot <command>

  run           prepare + analyze + merge + export (what the weekly job calls)
  prepare       export rows added since each group's cursor
  analyze       run the model on the latest prepared run
  merge         fold the latest analysis into state/
  export        write state/<key>/site.json (full snapshot per group)
  sync          copy the snapshots into the site's Postgres (web/scripts/sync.mts)
  summary       JSON summary of the latest run (--text: notification message; exit 2 if a group failed)
  preflight     check that WhatsApp Web is linked (exit 3 if it needs a QR scan)
  login         open WhatsApp Web to link it (scan the QR with the phone; once)
  status        show each group's cursor
"""
import json
import sys

from . import pipeline
from .store import group_dir, groups, load


def main(argv):
    cmd = argv[0] if argv else "status"
    if cmd == "run":
        run, manifest = pipeline.prepare()
        if any(g.get("status") == "prepared" for g in manifest["groups"].values()):
            pipeline.analyze(run)
            pipeline.merge(run)
        pipeline.mark_checked(run)
        print(json.dumps(load(run / "manifest.json", {}), ensure_ascii=False, indent=1))
        print("exported:", pipeline.export())
    elif cmd == "summary":
        s = pipeline.run_summary()
        if "--text" not in argv:
            print(json.dumps(s, ensure_ascii=False)); return
        text = "; ".join(s["lines"]) or "sin grupos procesados"
        if s["failed"]:
            text = "Fallaron: " + ", ".join(s["failed"]) + ". " + text
        if s.get("warning"):
            text = s["warning"] + ". " + text
        site = s.get("site")
        text += (". Sitio sin actualizar" if site is None else
                 f". Sitio actualizado: {site['vendors']} proveedores, {site['opportunities']} oportunidades" if site["ok"] else
                 ". No se pudo actualizar el sitio")
        print(text)
        sys.exit(2 if s["failed"] or s.get("warning") or (site and not site["ok"]) else 0)
    elif cmd == "preflight":
        # Load WhatsApp Web once with the saved login. The weekly script runs this under a time limit,
        # so an unlinked session ends the run with a notification instead of hanging on a QR code.
        import extract_group as wa
        try:
            state = wa.check()
        except Exception as e:
            print(f"WhatsApp Web did not load: {e}"); sys.exit(1)
        print(state)
        sys.exit(0 if state == "ok" else 3)
    elif cmd == "login":
        import extract_group as wa
        sys.exit(wa.login())
    elif cmd == "prepare":
        run, manifest = pipeline.prepare(); print(run); print(json.dumps(manifest, ensure_ascii=False, indent=1))
    elif cmd == "analyze":
        print(json.dumps(pipeline.analyze(argv[1] if len(argv) > 1 else None), ensure_ascii=False, indent=1))
    elif cmd == "merge":
        print(json.dumps(pipeline.merge(argv[1] if len(argv) > 1 else None), ensure_ascii=False, indent=1))
    elif cmd == "export":
        print(json.dumps(pipeline.export()))
    elif cmd == "sync":
        try:
            pipeline.sync()
        except Exception as e:
            print(f"sync failed: {e}"); sys.exit(1)
    elif cmd == "status":
        for cfg in groups():
            c = load(group_dir(cfg["key"]) / "cursor.json", {})
            print(f"{cfg['key']:10} cursor={c.get('last_ts')} updated={c.get('updated_at')}")
    else:
        print(__doc__); sys.exit(1)


if __name__ == "__main__":
    main(sys.argv[1:])
