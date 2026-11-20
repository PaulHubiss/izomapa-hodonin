"""Posune místní souřadnice modelů památek po změně středu mapy (posun_stredu.py).
    .venv/bin/python nastroje-pavel/pamatky_posun.py            jen změří, o kolik jsou modely mimo
    .venv/bin/python nastroje-pavel/pamatky_posun.py --proved   posune pamatky/*.json a pamatky/vrsky.json

Proč (Pavel 2026-11-20, mřížka 5 × 5 km: „nevidím naše modely budov“): pamatky/<slug>.json mají `bod`, `budovy[].ring`
a `ram` v metrech od středu mapy, vrsky.json `obalka` taky. Po posunu středu se render netrefí do půdorysů a modely zmizí.
Posun se měří pro každý soubor zvlášť: střed půdorysu uloženého v souboru proti téže budově (oid) v data_all/ podle
aktuálního geo.py; všechny soubory se posunou o medián (sochy a pomníky bez budovy taky). `ctverec` se přepočítá z `bodu`.
"""
import sys, os, json, glob
sys.path.insert(0, os.getcwd())
import numpy as np, pyarrow.parquet as pq, shapely
import geo

PROVED = '--proved' in sys.argv
t = pq.read_table('data_all/building.parquet', columns=['id', 'geometry']).to_pylist()
GEOM = {r['id']: r['geometry'] for r in t}


def stred_ted(oid):
    g = shapely.from_wkb(GEOM[oid]); c = shapely.centroid(g)
    x, y = geo.to_local(c.x, c.y); return np.array([float(x), float(y)])


soubory = {}
for f in sorted(glob.glob('pamatky/*.json')):
    d = json.load(open(f, encoding='utf-8'))
    if isinstance(d, dict) and 'bod' in d: soubory[f] = d

posun = {}
for f, d in soubory.items():
    pp = []
    for b in d.get('budovy') or []:
        if b.get('oid') in GEOM and b.get('ring'):
            # střed uloženého půdorysu stejnou cestou (shapely) jako dnešní, ať se porovnává totéž
            pp.append(stred_ted(b['oid']) - np.array(shapely.centroid(shapely.Polygon(b['ring'])).coords[0]))
    if pp: posun[f] = np.mean(pp, axis=0)
if not posun: sys.exit('žádný model s budovou v datech – není z čeho měřit')
P = np.array(list(posun.values())); med = np.median(P, axis=0)
print(f'modelů {len(soubory)}, změřeno podle budovy {len(posun)}; posun medián {med[0]:+.2f} / {med[1]:+.2f} m,'
      f' rozptyl {np.abs(P - med).max():.2f} m')
for f, p in posun.items():
    if np.abs(p - med).max() > 1: print(f'  ⚠️ {f}: {p[0]:+.2f} / {p[1]:+.2f} m (jiný než ostatní)')
if np.abs(med).max() < 0.05: sys.exit('modely sedí, není co posouvat')
if not PROVED: sys.exit('jen měření; posunout: --proved')

S = 2 * geo.HALF
r2 = lambda v: round(float(v), 2)
# Posun středu je čistá změna souřadnic, stejná pro všechny → všude medián. Odchylka jednoho souboru znamená,
# že se jeho budova v datech změnila – model se má dál trefit do půdorysu, pro který byl dělaný.
dx, dy = med
for f, d in soubory.items():
    d['bod'] = [r2(d['bod'][0] + dx), r2(d['bod'][1] + dy)] + list(d['bod'][2:])
    for b in d.get('budovy') or []:
        b['ring'] = [[r2(x + dx), r2(y + dy)] for x, y in b['ring']]
    if isinstance(d.get('ram'), dict):
        d['ram']['x'] = r2(d['ram']['x'] + dx); d['ram']['y'] = r2(d['ram']['y'] + dy)
    if 'ctverec' in d: d['ctverec'] = [int(round(d['bod'][0] / S)), int(round(d['bod'][1] / S))]
    open(f, 'w', encoding='utf-8').write(json.dumps(d, ensure_ascii=False, indent=1) + '\n')
V = 'pamatky/vrsky.json'
if os.path.exists(V):
    v = json.load(open(V, encoding='utf-8'))
    for slug, q in v.items():
        a, b, c, e = q['obalka']; q['obalka'] = [r2(a + dx), r2(b + dy), r2(c + dx), r2(e + dy)]
    open(V, 'w', encoding='utf-8').write(json.dumps(v, ensure_ascii=False, indent=1) + '\n')
print('posunuto; dál: pamatky/render_mapa.sh (nebo ./postav.sh render), pak overlay.py a build_html.py')
