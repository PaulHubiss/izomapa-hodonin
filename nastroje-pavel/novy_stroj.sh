#!/bin/sh
# Postaví mapu na Macu, kde je jen git (build/, data_*/, site/ se nepřenášejí): data, výšky, naše doplňky, render.
# Předpoklad: .venv s knihovnami (setup.sh bez posledního řádku) a Chromium z nastroje-pavel/instaluj-chromium.sh.
# Kroky s hotovým výsledkem se přeskočí, takže jde po pádu pustit znovu. Render jen jednou, na konci.
# Stahuje ~5 GB (laser 2013 + 12 listů DMP OK 2024 po ~350 MB, ty se po zpracování mažou). Na M2 (2026-11-15) ~1–1,5 h.
#   sh nastroje-pavel/novy_stroj.sh
# assets/ruian_karta.json a assets/pamatky.json jsou v gitu, ty se nestavějí.
set -e
cd "$(dirname "$0")/.."
PY=.venv/bin/python
export PYTHONUTF8=1
krok() { echo; echo "== $(date +%H:%M) $1"; }

krok "kontrola podkladů";           $PY nastroje-pavel/kontrola_podkladu.py --tise   # stará mřížka, neúplné dvojice → stop
krok "data Overture + terén";       $PY fetch_data.py --vse
krok "výšky z laseru 2013";         [ -f assets/dmp_vysky.json ] || { $PY dmp_fetch.py && $PY dmp_vysky.py; }
krok "les z ortofota";              [ -f build/les_maska.png ] || { $PY nastroje-pavel/kontrola_podkladu.py plati build/orto || rm -rf build/orto; $PY nastroje/les.py &&$PY nastroje-pavel/kontrola_podkladu.py razitko build/orto; }
krok "pole a louky (ZABAGED)";      [ -f assets/zabaged.json ] || { $PY nastroje/zabaged.py && $PY nastroje/pole.py && $PY nastroje/pole_cesty.py; }
krok "barvy střech z ortofota";     [ -f assets/strechy_orto.json ] || { $PY nastroje-pavel/kontrola_podkladu.py plati build/orto04 || rm -rf build/orto04; $PY nastroje/strechy.py &&$PY nastroje-pavel/kontrola_podkladu.py razitko build/orto04; }
krok "hřiště a semafory";           [ -f assets/hriste.json ] || $PY nastroje/hriste.py; [ -f assets/semafory.json ] || $PY nastroje/semafory.py
krok "zeleň na zpevněných plochách"; [ -f build/zelen_maska.png ] || $PY nastroje/povrchy.py
krok "směr hřebenů z laseru";       [ -f assets/hrebeny.json ] || $PY nastroje/hrebeny.py   # je v gitu; každý běh mění pořadí klíčů → automat by měl „rozdělanou práci“ (2026-11-20)
krok "typy budov RÚIAN";            [ -f assets/ruian_budovy.json ] || $PY nastroje/ruian.py
krok "komíny a potrubí";            [ -f assets/kominy.json ] || $PY nastroje/kominy.py
krok "železniční přejezdy";         [ -f assets/prejezdy.json ] || $PY nastroje/prejezdy.py
krok "sčítání dopravy (hustota aut)"; [ -f build/scitani.json ] || $PY nastroje/scitani.py
krok "vlaky (celostátní JŘ)";       $PY nastroje-pavel/vlaky_jr.py   # stáhne platné ročníky JR (~25 MB každý) a spojí je
krok "výšky DMP OK 2024";           [ -f build/dmpok_vysky.json ] || $PY nastroje/dmpok.py
krok "scény, render, web";          ./postav.sh render
krok "cesty pro chodce";            $PY nastroje-pavel/chodci.py
krok "tvar ulic pro hledání";       $PY nastroje-pavel/ulice.py
krok "hotovo"
