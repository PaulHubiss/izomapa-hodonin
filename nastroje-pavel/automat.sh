#!/bin/sh
# Automatická aktualizace jízdních řádů: každou neděli ve 3:00 PŘIPRAVÍ nový web (launchd, i bez Clauda),
# nasadí ho ale až po Pavlově potvrzení (Pavel 2026-11-20: „ideálně ať čeká na moje potvrzení“).
#   sh nastroje-pavel/automat.sh zapnout    nainstaluje službu cz.izomapa.aktualizace na TOMHLE Macu
#   sh nastroje-pavel/automat.sh vypnout
#   sh nastroje-pavel/automat.sh stav       běží? čeká něco na potvrzení? + konec posledního logu
#   sh nastroje-pavel/automat.sh beh        příprava tak, jak ji pouští launchd: main, přestavba, jízdní řády, web
#   sh nastroje-pavel/automat.sh nasad      POTVRZENÍ: nahraje připravený web (jen když se od přípravy nic nezměnilo)
# Zapnout na OBOU Macích (Pavel 2026-11-20: „zapínám/vypínám je různě“). Dřív jen M2, protože automat nasazoval sám
# a dva Macy by se přetahovaly; teď jen připravuje, nasadí se jen to, co Pavel potvrdí (na Macu, kde zrovna sedí).
# Spí-li Mac v neděli ve 3:00, launchd běh dožene po probuzení.
# Pojistky: rozdělaná práce v gitu (necommitnuté změny) = nepřipravovat, jen ohlásit. Chyba = oznámení macOS.
# Příprava vždy stáhne main a přestaví mapu (novy_stroj.sh: kroky s výsledkem přeskočí, render jen změněných čtverců).
# Proč vždy (2026-11-20): main stáhl už háček při startu sezení, automat „nic nového“ neviděl a nasadil dlaždice
# z 15. 11. přes web z M5 s 29 památkami. Nasazení navíc hlídá nastroje-pavel/kontrola_dlazdic.py.
set -e
cd "$(dirname "$0")/.."
KOREN=$(pwd)
NAZEV=cz.izomapa.aktualizace
PLIST="$HOME/Library/LaunchAgents/$NAZEV.plist"
LOG=build/aktualizace/automat.log
PRIPRAVENO=build/aktualizace/pripraveno   # řádek 1 popis (čas · commit · Mac), řádek 2 celý commit

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
  [ -f "$PRIPRAVENO" ] && echo "⏳ čeká na potvrzení: $(head -1 "$PRIPRAVENO") → sh nastroje-pavel/automat.sh nasad" || true
  [ -f "$LOG" ] && { echo "── konec logu ──"; tail -12 "$LOG"; } || true ;;
beh)
  mkdir -p build/aktualizace
  echo; echo "════ $(date '+%Y-%m-%d %H:%M') ════"
  date '+%Y-%m-%d %H:%M' > build/aktualizace/posledni_beh   # kontrola_podkladu.py: běžel od změny automatu? (i při ručním běhu mimo log)
  rm -f "$PRIPRAVENO"
  if [ -n "$(git status --porcelain)" ]; then
    echo "⏸ rozdělaná práce v gitu – nepřipravuji (jinak by šla na web i ona):"; git status --porcelain | head -10
    oznam "Přeskočeno: v projektu je necommitnutá práce."; exit 0
  fi
  if [ "$(git rev-parse --abbrev-ref HEAD)" != main ]; then
    echo "⏸ projekt není na větvi main – nepřipravuji"; oznam "Přeskočeno: projekt není na větvi main."; exit 0
  fi
  PRED=$(git rev-parse HEAD)
  if ! git pull -q --ff-only origin main; then
    echo "❌ git pull selhal (rozešlé větve?) – nepřipravuji"; oznam "Aktualizace selhala: git pull – viz log."; exit 1
  fi
  if [ "$PRED" != "$(git rev-parse HEAD)" ]; then
    echo "↓ nový kód: $(git log --oneline "$PRED"..HEAD | wc -l | tr -d ' ') commitů"
    if git diff --name-only "$PRED" HEAD | grep -q '^package-lock.json$'; then npm install > build/aktualizace/npm.txt 2>&1 || { oznam "Aktualizace selhala: npm install – viz log."; exit 1; }; fi
  fi
  # vždy, ne jen po změně z pull: main mohl stáhnout někdo jiný (háček při startu sezení) a dlaždice by zůstaly staré
  echo "== přestavba mapy (novy_stroj.sh)"
  if ! sh nastroje-pavel/novy_stroj.sh > build/aktualizace/prestavba.txt 2>&1; then
    tail -20 build/aktualizace/prestavba.txt; oznam "Přestavba mapy selhala, web se nezměnil – viz log."; exit 1
  fi
  grep -E '^(hotovo|beze změny|render hotov)' build/render_par.log || true
  if sh nastroje-pavel/aktualizuj.sh > build/aktualizace/posledni.txt 2>&1 && .venv/bin/python nastroje-pavel/kontrola_dlazdic.py >> build/aktualizace/posledni.txt 2>&1; then
    sed -n '/Jízdní řády v mapě/,/^==/p' build/aktualizace/posledni.txt | grep -v '^==' || true
    printf '%s · %s · %s\n' "$(date '+%Y-%m-%d %H:%M')" "$(git rev-parse --short HEAD)" "$(scutil --get ComputerName)" > "$PRIPRAVENO"
    git rev-parse HEAD >> "$PRIPRAVENO"
    echo "⏳ připraveno, čeká na potvrzení: sh nastroje-pavel/automat.sh nasad"
    oznam "Nový web je připravený a čeká na tvé potvrzení (automat.sh nasad)."
  else
    tail -20 build/aktualizace/posledni.txt; oznam "Příprava selhala, web se nezměnil – viz build/aktualizace/automat.log"; exit 1
  fi ;;
nasad)
  # potvrzení od Pavla: nahrát přesně to, co beh připravil – ne nic, co přibylo potom
  [ -f "$PRIPRAVENO" ] || { echo "○ nic nečeká na potvrzení – nejdřív sh nastroje-pavel/automat.sh beh"; exit 1; }
  git fetch -q origin main || true
  if [ "$(sed -n 2p "$PRIPRAVENO")" != "$(git rev-parse HEAD)" ] || [ "$(git rev-parse HEAD)" != "$(git rev-parse origin/main)" ] || [ -n "$(git status --porcelain)" ]; then
    echo "❌ od přípravy se změnil kód (tady nebo na GitHubu, třeba z M5) – nenasazuji. Připrav znovu: sh nastroje-pavel/automat.sh beh"; exit 1
  fi
  echo "== nasazuji připravený web ($(head -1 "$PRIPRAVENO"))"
  if sh nastroje-pavel/aktualizuj.sh nasad > build/aktualizace/posledni.txt 2>&1; then
    sed -n '/Jízdní řády v mapě/,/^==/p' build/aktualizace/posledni.txt | grep -v '^==' || true
    grep -E 'Current Version ID|custom domain' build/aktualizace/posledni.txt || true
    rm -f "$PRIPRAVENO"; echo "✅ nahráno"
  else
    tail -20 build/aktualizace/posledni.txt; exit 1
  fi ;;
*) echo "Použití: $0 {zapnout|vypnout|stav|beh|nasad}"; exit 1 ;;
esac
