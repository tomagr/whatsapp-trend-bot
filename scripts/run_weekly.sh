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

echo "== $(date)" >> "$LOG"

# 1. Is WhatsApp Web linked? (headless Chrome with the saved login in .wa-session/)
with_timeout 300 $PY -m trendbot preflight >> "$LOG" 2>&1
case $? in
  0) ;;
  3) MESSAGE="WhatsApp Web no está vinculado. En la carpeta del proyecto corré: python3 -m trendbot login, y escaneá el QR con el celular (WhatsApp → Dispositivos vinculados)."
     notify "WhatsApp Trend Bot: vincular WhatsApp Web" "$MESSAGE"
     echo "== preflight: not linked; notified" >> "$LOG"
     exit 1 ;;
  *) MESSAGE="WhatsApp Web no cargó. Revisá $PWD/$LOG"
     notify "WhatsApp Trend Bot: falló" "$MESSAGE"
     echo "== preflight failed; notified" >> "$LOG"
     exit 1 ;;
esac

# 2. Read new messages from WhatsApp Web, analyse, merge, export; then copy to the site's database.
{
  with_timeout 3600 $PY -m trendbot run
  echo "== exit $?"
  with_timeout 300 $PY -m trendbot sync
  echo "== sync exit $?"
} >> "$LOG" 2>&1

# 3. Always tell the user how it went, even when nothing changed.
MESSAGE=$(with_timeout 60 $PY -m trendbot summary --text 2>>"$LOG")
case $? in
  0) notify "WhatsApp Trend Bot: actualización lista" "$MESSAGE" ;;
  2) notify "WhatsApp Trend Bot: revisar" "$MESSAGE" ;;
  *) MESSAGE="No se pudo completar la actualización semanal. Revisá $PWD/$LOG"
     notify "WhatsApp Trend Bot: falló" "$MESSAGE" ;;
esac
echo "== notified: $MESSAGE" >> "$LOG"

ls -1t logs/2*.log | tail -n +13 | xargs rm -f 2>/dev/null
exit 0
