#!/bin/sh
# Doplňkové nástroje izomapy pro celý rozsah mapy, pak přestavba (scény, render, web).
# Spouštět po rozšíření mapy (novy_mesto.py) a po ./postav.sh – postav.sh je sám nespouští
# a soubory se starým rozsahem by tiše platily jen pro původní čtverce.
#   sh nastroje-pavel/doplnky.sh          jen doplňky + přestavba
#   sh nastroje-pavel/doplnky.sh data     nejdřív obnoví data pro nový rozsah (Overture, výšky z laseru)
#     (fetch_data.py si od 2026-11-12 pamatuje rozsah a při změně stáhne znovu; výšky z laseru
#      se přepočítají jen když chybí assets/dmp_vysky.json – po rozšíření ho přesuň do Koše)
set -e
cd "$(dirname "$0")/.."
PY=.venv/bin/python
export PYTHONUTF8=1
if [ "$1" = data ]; then
  echo "== data Overture pro celý rozsah"; $PY fetch_data.py --vse
  echo "== výšky budov z laseru";      [ -f assets/dmp_vysky.json ] || { $PY dmp_fetch.py && $PY dmp_vysky.py; }
  [ -f build/les_maska.png ] || { $PY nastroje/les.py && $PY nastroje-pavel/kontrola_podkladu.py razitko build/orto; }
  [ -f assets/zabaged.json ] || { $PY nastroje/zabaged.py && $PY nastroje/pole.py && $PY nastroje/pole_cesty.py; }
fi
# Střechy, zeleň a hřebeny: drahé (ortofoto ~5 GB) a v gitu z čisté stavby → znovu jen s `data` (nový rozsah) nebo když chybí.
# Mezipaměť ortofota (build/orto04/) se jmenuje podle polohy v mapě, ne na Zemi: po posunu středu by se poskládalo
# špatné místo (2026-11-18 na M5: dlaždice ze staré mřížky → špatné barvy střech a maska zeleně). Proto ji `data` maže.
if [ "$1" = data ] || [ ! -f assets/strechy_orto.json ] || [ ! -f build/zelen_maska.png ]; then
  if [ "$1" = data ] || ! $PY nastroje-pavel/kontrola_podkladu.py plati build/orto04; then rm -rf build/orto04; fi
  echo "== barvy střech z ortofota";  $PY nastroje/strechy.py
  $PY nastroje-pavel/kontrola_podkladu.py razitko build/orto04   # mezipaměť patří k téhle mřížce
  echo "== zeleň na zpevněných plochách"; $PY nastroje/povrchy.py
fi
if [ "$1" = data ] || [ ! -f assets/hrebeny.json ]; then echo "== směr hřebenů z laseru"; $PY nastroje/hrebeny.py; fi
echo "== typy budov RÚIAN";        $PY nastroje/ruian.py
echo "== komíny a potrubí";        $PY nastroje/kominy.py
echo "== železniční přejezdy";     $PY nastroje/prejezdy.py
echo "== sčítání dopravy";          [ -f build/scitani.json ] || $PY nastroje/scitani.py
echo "== vlaky (celostátní JŘ)";   $PY nastroje-pavel/vlaky_jr.py
echo "== cesty pro chodce";          $PY nastroje-pavel/chodci.py
echo "== tvar ulic pro hledání";     $PY nastroje-pavel/ulice.py
echo "== přestavba";               ./postav.sh render
echo "== klikací plochy jarmarku"; $PY nastroje-pavel/jarmark_klik.py
