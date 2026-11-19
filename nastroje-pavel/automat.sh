#!/bin/sh
# Automatická aktualizace jízdních řádů: každou neděli ve 3:00 pustí `aktualizuj.sh nasad` (launchd, i bez Clauda).
#   sh nastroje-pavel/automat.sh zapnout    nainstaluje službu cz.izomapa.aktualizace na TOMHLE Macu
#   sh nastroje-pavel/automat.sh vypnout
#   sh nastroje-pavel/automat.sh stav       běží? + konec posledního logu
#   sh nastroje-pavel/automat.sh beh        jeden běh tak, jak ho pouští launchd (ruční zkouška)
# Zapnout jen na JEDNOM Macu (Pavel 2026-11-16: M2 – má postavenou mapu a přihlášený wrangler).
# Spí-li Mac v neděli ve 3:00, launchd běh dožene po probuzení.
# Pojistky: rozdělaná práce v gitu (necommitnuté změny) = nenahrávat, jen ohlásit. Chyba = oznámení macOS.
# Před nasazením stáhne main (jen fast-forward); při změně kódu přestaví mapu (novy_stroj.sh, i s kontrolou podkladů).
set -e
cd "$(dirname "$0")/.."
KOREN=$(pwd)
NAZEV=cz.izomapa.aktualizace
PLIST="$HOME/Library/LaunchAgents/$NAZEV.plist"
LOG=build/aktualizace/automat.log

oznam() { osascript -e "display notification \"$1\" with title \"Izomapa – aktualizace\"" 2>/dev/null || true; }

case "$1" in
zapnout)
  mkdir -p "$HOME/Library/LaunchAgents" build/aktualizace
  cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>             <string>$NAZEV</string>
  <key>ProgramArguments</key>  <array><string>/bin/sh</string><string>$KOREN/nastroje-pavel/automat.sh</string><string>beh</string></array>
  <key>StartCalendarInterval</key> <dict><key>Weekday</key><integer>0</integer><key>Hour</key><integer>3</integer><key>Minute</key><integer>0</integer></dict>
  <key>EnvironmentVariables</key> <dict><key>PATH</key><string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string></dict>
  <key>StandardOutPath</key>   <string>$KOREN/$LOG</string>
  <key>StandardErrorPath</key> <string>$KOREN/$LOG</string>
</dict>
</plist>
EOF
  launchctl bootout "gui/$(id -u)/$NAZEV" 2>/dev/null || true
  launchctl bootstrap "gui/$(id -u)" "$PLIST"
  echo "✅ zapnuto: každou neděli ve 3:00 ($(scutil --get ComputerName)), log $LOG" ;;
vypnout)
  launchctl bootout "gui/$(id -u)/$NAZEV" 2>/dev/null || true
  rm -f "$PLIST"; echo "○ vypnuto" ;;
stav)
  if launchctl print "gui/$(id -u)/$NAZEV" >/dev/null 2>&1; then echo "✅ zapnuto na $(scutil --get ComputerName)"; else echo "○ na tomhle Macu vypnuto"; fi
  [ -f "$LOG" ] && { echo "── konec logu ──"; tail -12 "$LOG"; } || true ;;
beh)
  echo; echo "════ $(date '+%Y-%m-%d %H:%M') ════"
  if [ -n "$(git status --porcelain)" ]; then
    echo "⏸ rozdělaná práce v gitu – nenahrávám (jinak by šla na web i ona):"; git status --porcelain | head -10
    oznam "Přeskočeno: v projektu je necommitnutá práce."; exit 0
  fi
  # Nejdřív čerstvý kód z gitu (2026-11-18: automat nahrával, co měl Mac u sebe → po nasazení z druhého Macu by web
  # v neděli vrátil na starou verzi). Jen fast-forward na main; při změně kódu nejdřív přestavět mapu, jinak by šel
  # na web nový prohlížeč se starými daty.
  if [ "$(git rev-parse --abbrev-ref HEAD)" != main ]; then
    echo "⏸ projekt není na větvi main – nenahrávám"; oznam "Přeskočeno: projekt není na větvi main."; exit 0
  fi
  PRED=$(git rev-parse HEAD)
  if ! git pull -q --ff-only origin main; then
    echo "❌ git pull selhal (rozešlé větve?) – nenahrávám"; oznam "Aktualizace selhala: git pull – viz log."; exit 1
  fi
  if [ "$PRED" != "$(git rev-parse HEAD)" ]; then
    echo "↓ nový kód: $(git log --oneline "$PRED"..HEAD | wc -l | tr -d ' ') commitů"
    if git diff --name-only "$PRED" HEAD | grep -q '^package-lock.json$'; then npm install > build/aktualizace/npm.txt 2>&1 || { oznam "Aktualizace selhala: npm install – viz log."; exit 1; }; fi
    # kód nebo podklady mapy (ne jen deník a poznámky) → přestavba; novy_stroj.sh začíná kontrolou podkladů
    if git diff --name-only "$PRED" HEAD | grep -qv -E '^(sessions/|napady/|navrhy/|[^/]*\.md$)'; then
      echo "== přestavba mapy (novy_stroj.sh)"
      if ! sh nastroje-pavel/novy_stroj.sh > build/aktualizace/prestavba.txt 2>&1; then
        tail -20 build/aktualizace/prestavba.txt; oznam "Přestavba mapy selhala, web se nezměnil – viz log."; exit 1
      fi
    fi
  fi
  if sh nastroje-pavel/aktualizuj.sh nasad > build/aktualizace/posledni.txt 2>&1; then
    sed -n '/Jízdní řády v mapě/,/^==/p' build/aktualizace/posledni.txt | grep -v '^==' || true
    grep 'Deployment complete' build/aktualizace/posledni.txt || true
    grep -q '⚠️' build/aktualizace/posledni.txt && oznam "Hotovo, ale jízdní řád brzy vyprší – viz log." || true
    echo "✅ nahráno"
  else
    tail -20 build/aktualizace/posledni.txt; oznam "Aktualizace selhala – viz build/aktualizace/automat.log"; exit 1
  fi ;;
*) echo "Použití: $0 {zapnout|vypnout|stav|beh}"; exit 1 ;;
esac
