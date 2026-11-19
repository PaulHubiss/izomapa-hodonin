#!/bin/sh
# Náhrada za `npx playwright install chromium`, který na Node 26 zamrzne při rozbalování
# (zjištěno 2026-11-12 na M5: stáhne 130 MB, rozbalí 624 kB a dál stojí).
# Stáhne balíky přes curl, rozbalí systémovým unzip a zapíše značku INSTALLATION_COMPLETE,
# podle které Playwright pozná hotovou instalaci. Verze (1194, 1011) odpovídají playwright 1.56;
# po aktualizaci playwrightu je zjistíš přes `npx playwright install chromium --dry-run`.
set -e
CACHE="$HOME/Library/Caches/ms-playwright"
CDN="https://cdn.playwright.dev/dbazure/download/playwright/builds"
TMP="$(mktemp -d)"

instaluj() {   # $1 = cílová složka, $2 = cesta na CDN
  echo "→ $1"
  curl -fL --progress-bar -o "$TMP/balik.zip" "$CDN/$2"
  mkdir -p "$CACHE/$1"
  unzip -oq "$TMP/balik.zip" -d "$CACHE/$1"
  touch "$CACHE/$1/INSTALLATION_COMPLETE"
  rm "$TMP/balik.zip"
}

instaluj chromium-1194                chromium/1194/chromium-mac-arm64.zip
instaluj chromium_headless_shell-1194 chromium/1194/chromium-headless-shell-mac-arm64.zip
instaluj ffmpeg-1011                  ffmpeg/1011/ffmpeg-mac-arm64.zip
rmdir "$TMP"
rm -rf "$CACHE/__dirlock"
# Zapsat Izomapu mezi uživatele prohlížečů (.links/<sha1 cesty> = cesta k playwright-core). Bez toho je jiná instalace
# Playwrightu (např. Společné nástroje) považuje za nepoužívané a SMAŽE je – stalo se 2026-11-15 na M2.
CORE="$(cd "$(dirname "$0")/.." && pwd)/node_modules/playwright-core"
mkdir -p "$CACHE/.links"
printf '%s' "$CORE" > "$CACHE/.links/$(printf '%s' "$CORE" | shasum | cut -d' ' -f1)"
echo "Hotovo."
