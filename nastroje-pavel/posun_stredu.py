"""Posun středu mapy a změna velikosti čtverců bez zbytečného stahování.

    .venv/bin/python nastroje-pavel/posun_stredu.py LAT LON POLOVINA "i,j i,j …"

Co udělá:
1. zapíše do mesto.json nový `stred`, `polovina` a `ctverce`,
2. posune roh masek lesa a zeleně (build/*_maska.json, `x0y1m` je v metrech od středu mapy) o přesný posun,
   takže se nemusí znovu stavět z ortofota (les.py, povrchy.py),
3. když nová mapa leží celá uvnitř staženého rozsahu Overture, zapíše nový rozsah do data_all/rozsah.json,
   aby fetch_data.py --vse nestahoval vrstvy znovu (jen vyřízne čtverce).
Budovy, střechy, výšky a dominanty mají zeměpisné souřadnice nebo ID budovy a posun nevadí.
⚠️ Modely památek NE: pamatky/*.json a vrsky.json jsou v metrech od středu (2026-11-20 po mřížce 5 × 5 km zmizely).
Potom: nastroje/vlaky.py (trasy vlaků jsou v metrech), nastroje-pavel/pamatky_posun.py --proved, ./postav.sh
a pamatky/render_mapa.sh.
"""
import json, os, sys

LAT, LON, HALF = float(sys.argv[1]), float(sys.argv[2]), float(sys.argv[3])
CTVERCE = [[int(v) for v in c.split(',')] for c in sys.argv[4].split()]
# Strana čtverce musí být násobek kroku výškové mřížky (prep.py STEP = 5 m): render.html klade body terénu po přesně
# 5 m, prep.py je rozprostře přes celou stranu. S 1 668 m byl terén o 3 m kratší než silnice a domy → na švech mezera
# s tmavou hranou a posunuté cesty (Pavel 2026-11-20, hřbitov). 1 600 i 1 670 m jsou v pořádku.
if abs(2 * HALF / 5 - round(2 * HALF / 5)) > 1e-9:
    sys.exit(f'polovina {HALF}: strana {2 * HALF} m není násobek 5 m → švy mezi čtverci. Zvol třeba {round(2 * HALF / 5) * 2.5}.')
assert [0, 0] in CTVERCE, 'čtverec 0,0 musí být v seznamu'

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import geo                                         # starý střed (načte mesto.json před přepsáním)

dx, dy = (float(v) for v in geo.to_local(LON, LAT))   # nový střed ve starých metrech
print(f'posun středu: {dx:+.1f} m na východ, {dy:+.1f} m na sever')
stary_rozsah = json.load(open('data_all/rozsah.json')) if os.path.exists('data_all/rozsah.json') else None

# 1) mesto.json: přepsat jen tři klíče, zbytek souboru (formát, pořadí) nechat
import re
t = open('mesto.json', encoding='utf-8').read()
nove = {'stred': f'[{round(LON, 6)}, {round(LAT, 6)}]', 'polovina': f'{HALF}',
        'ctverce': '[\n' + ',\n'.join(f'  [{i}, {j}]' for i, j in CTVERCE) + '\n ]'}
VZOR = {'stred': r'\[[^\]]*\]', 'polovina': r'[-0-9.]+', 'ctverce': r'\[\s*(?:\[[^\]]*\]\s*,?\s*)*\]'}
for k, v in nove.items():
    t, n = re.subn(rf'"{k}": {VZOR[k]}', lambda _: f'"{k}": {v}', t, count=1)
    assert n == 1, f'klíč {k} v mesto.json nenalezen'
json.loads(t)                                      # kontrola, že je to pořád platný JSON
open('mesto.json', 'w', encoding='utf-8').write(t)

# 2) masky
for f in ('build/les_maska.json', 'build/zelen_maska.json'):
    if not os.path.exists(f): continue
    d = json.load(open(f)); x0, y1, mm = d['x0y1m']
    d['x0y1m'] = [x0 - dx, y1 - dy, mm]
    json.dump(d, open(f, 'w'))
    print(f, 'roh posunut')

# 3) rozsah Overture
import importlib; importlib.reload(geo)            # už s novým mesto.json
novy = [round(float(v), 6) for v in geo.bbox_lonlat(400)]
if stary_rozsah:
    a0, a1, b0, b1 = stary_rozsah; n0, n1, m0, m1 = novy
    if a0 <= n0 and n1 <= a1 and b0 <= m0 and m1 <= b1:
        json.dump(novy, open('data_all/rozsah.json', 'w'))
        print('nová mapa je uvnitř staženého rozsahu → data_all/rozsah.json přepsán, Overture se znovu nestahuje')
    else:
        print('⚠️ nová mapa přesahuje stažený rozsah → fetch_data.py --vse stáhne vrstvy znovu')
print('čtverců', len(CTVERCE), 'polovina', HALF)
print('dál: nastroje/vlaky.py, nastroje-pavel/pamatky_posun.py --proved (modely památek), ./postav.sh, pamatky/render_mapa.sh')
