#!/bin/sh
# WebKit (engine Safari) a Firefox pro zkoušky v Playwrightu – náhrada za `playwright install webkit firefox`, který na
# Node 26 zamrzne při rozbalování stejně jako Chromium (2026-11-17 na M2: stáhl 71 MB, rozbalil jeden soubor a stál).
# Pavel prohlíží mapu v Safari a zkoušky mají běžet ve všech třech enginech (nastroje-pavel/zkousky.mjs).
# Buildy odpovídají playwright 1.56; po aktualizaci je zjistíš: node node_modules/playwright-core/cli.js install webkit firefox --dry-run
# Použití: sh nastroje-pavel/instaluj-webkit.sh [webkit] [firefox]   (bez argumentů oba)
set -e
CACHE="$HOME/Library/Caches/ms-playwright"
CDN="https://cdn.playwright.dev/dbazure/download/playwright/builds"
TMP="$(mktemp -d)"
instaluj() {   # $1 = cílová složka, $2 = cesta na CDN
  echo "→ $1"
  curl -fL --progress-bar -o "$TMP/balik.zip" "$CDN/$2"
  rm -rf "$CACHE/$1"
  mkdir -p "$CACHE/$1"
  unzip -oq "$TMP/balik.zip" -d "$CACHE/$1"
  touch "$CACHE/$1/INSTALLATION_COMPLETE"
  rm "$TMP/balik.zip"
}
CO="${*:-webkit}"
case " $CO " in *" webkit "*) instaluj webkit-2215 webkit/2215/webkit-mac-15-arm64.zip ;; esac
case " $CO " in *" firefox "*) instaluj firefox-1495 firefox/1495/firefox-mac-arm64.zip ;; esac
# ⚠️ Firefox z Playwrightu (142 i 159) na macOS 27 nenaběhne. Zkoušky jedou v BĚŽNÉM Firefoxu:
# brew install --cask firefox, jednou open -a Firefox a zavřít (viz prohlizec.mjs, 2026-11-17). Volba firefox tu zůstává
# jen pro starší macOS.
rmdir "$TMP"
rm -rf "$CACHE/__dirlock"
# zapsat Izomapu mezi uživatele prohlížečů, jinak je jiná instalace Playwrightu smaže (viz instaluj-chromium.sh)
CORE="$(cd "$(dirname "$0")/.." && pwd)/node_modules/playwright-core"
mkdir -p "$CACHE/.links"
printf '%s' "$CORE" > "$CACHE/.links/$(printf '%s' "$CORE" | shasum | cut -d' ' -f1)"
echo "Hotovo."
