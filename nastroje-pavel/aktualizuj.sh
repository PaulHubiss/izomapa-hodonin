#!/bin/sh
# Pravidelná aktualizace mapy jedním příkazem (blok C v napady/PLAN-AKTUALNI-DATA.md).
#   sh nastroje-pavel/aktualizuj.sh            jízdní řády MHD a vlaků + web (bez renderu, ~2 min)
#   sh nastroje-pavel/aktualizuj.sh nasad      totéž a nahraje na Cloudflare (hodonin.paulhubiss.cz)
#   sh nastroje-pavel/aktualizuj.sh kontrola   jen zjistí, co je nového v datech budov (Overture, katastr) – nic nepřestaví
# Proč pravidelně: GTFS IDS JMK sahá jen ~měsíc dopředu a v mapě je ho tolik, kolik se stáhlo při poslední stavbě.
# Po vypršení jezdí MHD jen „podle dne v týdnu“ (app.html, mhdActive), tedy nepřesně. Spouštět aspoň jednou za 14 dní.
set -e
cd "$(dirname "$0")/.."
PY=.venv/bin/python
export PYTHONUTF8=1

if [ "$1" = kontrola ]; then
  # podklady na mřížce a v gitu, jízdní řády, vydání Overture (od sloučení 2026-11-18 v nastroje/overture.py), autor, data z OSM
  $PY nastroje-pavel/kontrola_podkladu.py || true
  echo "== katastr (RÚIAN): rozdíly půdorysů proti mapě"
  echo "  (bere uložené čtverce z build/ruian_vse/; čerstvý katastr = přesunout složku do Koše a pustit znovu)"
  $PY nastroje-pavel/porovnej_pudorysy.py
  exit 0
fi

# podklady ze staré mřížky nebo neúplné v gitu (2026-11-18: les u zoo zmizel) → nestavět ani nenasazovat (set -e)
$PY nastroje-pavel/kontrola_podkladu.py --tise
$PY nastroje-pavel/zprava_jr.py ulož
echo "== vlaky (celostátní jízdní řád, i příští ročník, když už vyšel)"
$PY nastroje-pavel/vlaky_jr.py
echo "== MHD: čerstvé GTFS IDS JMK"
$PY mhd.py --stahnout > /dev/null
echo "== web"
$PY build_html.py > /dev/null
# Zkušební nasazení: build_html.py přepíše robots.txt na „Allow“. Dokud _headers zakazuje indexování, zakázat i tady.
# hledá skutečný řádek hlavičky, ne slovo v komentáři (2026-11-19: komentář „noindex odstraněn“ nechal Disallow)
if grep -q -E '^[[:space:]]+X-Robots-Tag:.*noindex' site/_headers 2>/dev/null; then
  printf 'User-agent: *\nDisallow: /\n# Zkušební nasazení: vyhledávače nemají stránku indexovat. Ostré nasazení odstraní noindex v site/_headers.\n' > site/robots.txt
fi
$PY nastroje-pavel/zprava_jr.py

if [ "$1" = nasad ]; then
  echo "== nahrávám na Cloudflare (Worker hodonin-mapa, od 2026-11-19 místo Pages; worker/wrangler.jsonc)"
  node nastroje-pavel/test_worker.mjs > /dev/null
  npx wrangler deploy -c worker/wrangler.jsonc
  # kód nasazené verze do veřejného forku (AGPL, 2026-11-19); selhání nasazení nezastaví
  $PY nastroje-pavel/zverejni_kod.py || echo "⚠️ veřejný kód se nepodařilo nahrát (nastroje-pavel/zverejni_kod.py)"
  # záloha, kdyby bylo potřeba vrátit doménu na Pages: npx wrangler pages deploy site --project-name hodonin-mapa --branch main
fi
