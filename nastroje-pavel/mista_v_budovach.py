"""Kolik budov má v sobě víc míst (veřejná místa, podniky) – podklad pro kartu budovy s více místy.
Stejné pravidlo jako prohlížeč (web/js/40-karta.js verOf): bod místa v obrysu budovy a do 35 m od jejího středu.
Spuštění: .venv/bin/python nastroje-pavel/mista_v_budovach.py   (po overlay.py)
"""
import glob, json, math, os, sys
sys.path.insert(0, '.')
import geo

OV = json.load(open('site/overlay.json', encoding='utf-8'))
mista = [('veřejné', p['nazev'], p) for p in OV.get('verejna', [])] + [('podnik', p.get('nazev') or p.get('name'), p) for p in OV.get('podniky', [])]
ctverce = {f"c{i}_{j}" for i, j in geo.CHUNKS}


def v_obrysu(x, y, P):
    c = False
    for i in range(len(P)):
        (xi, yi), (xj, yj) = P[i], P[i - 1]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi: c = not c
    return c


def m(a, b):
    return math.hypot((a['lat'] - b['lat']) * 111320, (a['lon'] - b['lon']) * 72900)


vysledek = []
for f in sorted(glob.glob('site/overlay/*.json')):
    if os.path.basename(f)[:-5] not in ctverce: continue
    for b in json.load(open(f, encoding='utf-8'))['buildings']:
        uvnitr = [(druh, n) for druh, n, p in mista if 'xy' in p and m(b, p) < 35 and v_obrysu(p['xy'][0], p['xy'][1], b['hull'])]
        if len(uvnitr) > 1: vysledek.append((b.get('name') or (b.get('addr') or ['?'])[0], uvnitr))

print(f'budov s víc místy: {len(vysledek)}')
for nazev, uvnitr in sorted(vysledek, key=lambda r: -len(r[1])):
    print(f'  {nazev}: ' + ', '.join(f'{n} ({d})' for d, n in uvnitr))
