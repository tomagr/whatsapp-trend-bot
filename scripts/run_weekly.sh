#!/bin/zsh
# Weekly update: new WhatsApp messages only -> analysis -> merged state -> site database (Postgres).
# Results go straight to the site's database (web/, Postgres); the notification links to the site.
# Never waits on a person: every step that could hang has a time limit, and the result is always notified.
set -u
cd "$(dirname "$0")/.."
export PATH="$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH"
PY=/usr/bin/python3
HUB="https://whatsapp-trend-pages.vercel.app"
mkdir -p logs
LOG="logs/$(date +%Y%m%d-%H%M%S).log"

with_timeout() {  # with_timeout SECONDS cmd... ; exit 142 when the limit is hit
  perl -e 'alarm shift @ARGV; exec @ARGV' "$@"
}

notify() {  # notify "title" "message": banner that opens the index page on click + a window that stays until closed
  terminal-notifier -title "$1" -message "$2" -open "$HUB" -sound Glass -group whatsapptrendbot >/dev/null 2>&1 \
    || osascript -e 'on run argv' -e 'display notification (item 2 of argv) with title (item 1 of argv) sound name "Glass"' -e 'end run' "$1" "$2"
  # Detached and self-closing after 12 h, so the job itself never waits for a click.
  nohup osascript \
    -e 'on run argv' \
    -e 'set r to display dialog (item 2 of argv) with title (item 1 of argv) buttons {"Cerrar", "Abrir páginas"} default button "Abrir páginas" giving up after 43200' \
    -e 'if button returned of r is "Abrir páginas" then open location (item 3 of argv)' \
    -e 'end run' "$1" "$2" "$HUB" >>"$LOG" 2>&1 &
}

# Last outcome for the /admin poller (web/scripts/poll-runs.mts): the same exit codes as `trendbot summary`.
record() {  # record CODE "message"
  $PY -c 'import json, sys, time; json.dump({"code": int(sys.argv[1]), "message": sys.argv[2], "at": time.time()}, open("logs/last-result.json", "w"), ensure_ascii=False)' "$1" "$2"
}

# One run at a time: the Monday job and an "Update now" from /admin must not read WhatsApp Web together.
# A run that finds the lock waits for it (up to 90 min), so Monday's job is not lost behind a manual run.
# A lock older than 3 h is left over from a crash (every step has a time limit), so it is taken over.
LOCK=logs/run.lock
waited=0
until mkdir "$LOCK" 2>/dev/null; do
  if [[ -n $(find "$LOCK" -maxdepth 0 -mmin +180 2>/dev/null) ]]; then
    rmdir "$LOCK" 2>/dev/null
  elif (( waited >= 5400 )); then
    echo "== $(date): another update kept running; skipped" >> "$LOG"
    record 4 "Ya había otra actualización en curso"
    exit 0
  else
    sleep 30; (( waited += 30 ))
  fi
done
trap 'rmdir "$LOCK" 2>/dev/null' EXIT

echo "== $(date)" >> "$LOG"

# "Update" on one group in /admin: the poller leaves the group keys in logs/run-request.json just before
# starting this script. Taken once and only if fresh, so a leftover file never narrows the Monday run.
REQ=logs/run-request.json
if [[ -f $REQ ]]; then
  ONLY=$($PY -c 'import json, sys, time; r = json.load(open(sys.argv[1])); print(",".join(r["groups"]) if time.time() - r["at"] < 900 else "")' "$REQ" 2>>"$LOG")
  rm -f "$REQ"
  if [[ -n $ONLY ]]; then
    export TRENDBOT_ONLY=$ONLY
    echo "== only: $ONLY" >> "$LOG"
  fi
fi

# 1. Is WhatsApp Web linked? (headless Chrome with the saved login in .wa-session/)
with_timeout 300 $PY -m trendbot preflight >> "$LOG" 2>&1
case $? in
  0) ;;
  3) MESSAGE="WhatsApp Web no está vinculado. En la carpeta del proyecto corré: python3 -m trendbot login, y escaneá el QR con el celular (WhatsApp → Dispositivos vinculados)."
     notify "WhatsApp Trend Bot: vincular WhatsApp Web" "$MESSAGE"
     record 3 "$MESSAGE"
     echo "== preflight: not linked; notified" >> "$LOG"
     exit 1 ;;
  *) MESSAGE="WhatsApp Web no cargó. Revisá $PWD/$LOG"
     notify "WhatsApp Trend Bot: falló" "$MESSAGE"
     record 3 "$MESSAGE"
     echo "== preflight failed; notified" >> "$LOG"
     exit 1 ;;
esac

# 2. Read new messages from WhatsApp Web, analyse, merge, export; then copy to the site's database.
{
  # Only sync a fresh export: if the run failed, the site keeps last week's data and the summary says it failed.
  # The sync limit stays above Python's own 300 s timeout so that Python can record a timeout before exiting.
  if with_timeout 3600 $PY -m trendbot run; then
    echo "== exit 0"
    with_timeout 360 $PY -m trendbot sync
    echo "== sync exit $?"
  else
    echo "== exit $?; skipping sync"
  fi
} >> "$LOG" 2>&1

# 3. Always tell the user how it went, even when nothing changed.
MESSAGE=$(with_timeout 60 $PY -m trendbot summary --text 2>>"$LOG")
CODE=$?
case $CODE in
  0) notify "WhatsApp Trend Bot: actualización lista" "$MESSAGE" ;;
  2) notify "WhatsApp Trend Bot: revisar" "$MESSAGE" ;;
  3) MESSAGE="$MESSAGE. Revisá $PWD/$LOG"
     notify "WhatsApp Trend Bot: falló" "$MESSAGE" ;;
  *) MESSAGE="No se pudo completar la actualización semanal. Revisá $PWD/$LOG"
     notify "WhatsApp Trend Bot: falló" "$MESSAGE" ;;
esac
echo "== notified: $MESSAGE" >> "$LOG"
record $(( CODE == 0 || CODE == 2 ? CODE : 3 )) "$MESSAGE"

ls -1t logs/2*.log | tail -n +13 | xargs rm -f 2>/dev/null
exit 0
