#!/bin/sh
# Po ROZŠÍŘENÍ mapy (posun_stredu.py s větší plochou) přepočítá podklady vázané na budovy, které se počítaly jen pro
# starý rozsah, a mapu postaví znovu:
#   sh nastroje-pavel/podklady_po_rozsireni.sh
# Proč (2026-11-20, mřížka 5 × 5 km kvůli celému hřbitovu): v přidaném pásu měla barvu střechy z ortofota jen 15 ze 100
# budov (jinde 62 %), typ z RÚIAN 10 %, výšku z laseru 18–26 % (jinde 85 %), směr hřebene 0. novy_stroj.sh tyhle kroky
# přeskočí, když výsledek existuje – proto se staré výsledky a mezipaměti nejdřív přesunou do Koše (vratné).
# Mezipaměti pojmenované podle polohy v mapě (build/orto04, build/ruian) po posunu středu neplatí vůbec.
# Výsledky jsou v gitu (assets/*.json, build/dmpok_vysky.json) → druhý Mac je dostane pullem a počítat je nemusí.
# Stahuje: ortofoto ~10 min, RÚIAN pár minut, laser 2013 jen chybějící listy, DMP OK všechny listy znovu (~350 MB na list).
set -e
cd "$(dirname "$0")/.."
PY=.venv/bin/python
KOS="$HOME/.Trash/izomapa-podklady-pred-rozsirenim-$(date +%Y-%m-%d-%H%M)"
mkdir -p "$KOS/build/dmpok"
for f in assets/strechy_orto.json assets/ruian_budovy.json assets/dmp_vysky.json assets/hrebeny.json \
         build/dmpok_vysky.json build/dmp_vysky_2013.json build/dmp_vysky.json build/orto04 build/ruian; do
  [ -e "$f" ] && mkdir -p "$KOS/$(dirname "$f")" && mv "$f" "$KOS/$f"
done
# DMP OK: výsledky listů obsahují jen budovy, které byly v mapě při výpočtu → přepočítat všechny listy (atom.xml zůstává)
for f in build/dmpok/*.json; do [ -e "$f" ] && mv "$f" "$KOS/build/dmpok/"; done
echo "staré podklady v Koši: $KOS"
sh nastroje-pavel/novy_stroj.sh
