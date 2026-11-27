# Návrh výběru pro ChatGPT podle viditelnosti (2026-11-27, Pavel: „vyber takové, co jdou na mapě nejvíce vidět“):
#   .venv/bin/python nastroje-pavel/chatgpt-modely/navrh_vyberu.py <výpis kandidati_vyber.py --viditelnost> <číslo> [--min 30000] [--davka 5]
# Vezme budovy s aspoň --min viditelných pixelů, sousední (do 3 m) spojí do jedné stavby, pojmenuje je adresou, jinak
# druhem a nejbližší ulicí („Hala (Velkomoravská)“, bez skloňování), dávky po --davka stavbách podle ulice, aby stavby jednoho
# areálu šly spolu. Zapíše vybery/<číslo>.json (pak vyber.py na kontrolu a --zapis).
import json, os, re, sys
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.chdir(ROOT); sys.path.insert(0, ROOT)
import geo
from shapely.geometry import LineString, Point, Polygon
from shapely.ops import unary_union


def arg(n, d):
    return sys.argv[sys.argv.index(n) + 1] if n in sys.argv else d


VYPIS, CISLO, MIN, DAVKA = sys.argv[1], sys.argv[2], int(arg('--min', 30000)), int(arg('--davka', 5))
DRUH = {'průmyslová bud': 'Hala', 'sklad': 'Sklad', 'obchod': 'Obchod', 'komerční budov': 'Obchod', 'občanská stavb': 'Budova',
        'budova': 'Budova', 'stodola': 'Stodola', 'mateřská škola': 'Mateřská škola'}
radky = []
for r in open(VYPIS, encoding='utf-8'):
    m = re.match(r'^(\S{8}) (\d+) px +([\d.]+) m +(\d+) m²(.{14}) (.{44})', r)
    # ruian_…: novostavby doplněné z katastru, zkrácené ID je nejednoznačné (vynecháno už v 10. výběru)
    if m and int(m[2]) >= MIN and not m[1].startswith('ruian'): radky.append({'oid': m[1], 'px': int(m[2]), 'cls': m[5].strip(), 'adr': m[6].strip()})
P = {}
for C in sorted(geo.CHUNKS):
    cx, cy = geo.chunk_center(C)
    for b in json.load(open(f'{geo.chunk_dir(C)}/info_src.json', encoding='utf-8'))['buildings']:
        o = b['oid'][:8]
        if any(r['oid'] == o for r in radky):
            p = Polygon([(x + cx, y + cy) for x, y in b['ring']]).buffer(0); P[o] = P[o].union(p) if o in P else p
ulice = [(n, LineString(list(zip(c[0::2], c[1::2])))) for n, cs in json.load(open('site/ulice.json', encoding='utf-8')).items() for c in cs if len(c) >= 4]
# sousední budovy (do 3 m) = jedna stavba
sk = {r['oid']: {r['oid']} for r in radky}
for a in radky:
    for b in radky:
        if a['oid'] < b['oid'] and P[a['oid']].distance(P[b['oid']]) < 3 and sk[a['oid']] is not sk[b['oid']]:
            u = sk[a['oid']] | sk[b['oid']]
            for o in u: sk[o] = u
stavby, videno = [], set()
for r in radky:                                           # pořadí podle viditelnosti
    g = sk[r['oid']]
    if id(g) in videno: continue
    videno.add(id(g))
    clen = [q for q in radky if q['oid'] in g]
    c = unary_union([P[o] for o in g]).centroid
    ul = min(ulice, key=lambda u: u[1].distance(c))[0]
    adr = sorted({q['adr'].split(',')[0] for q in clen if q['adr']})
    druh = DRUH.get(clen[0]['cls'], 'Budova')
    if len(g) > 1: druh = {'Hala': 'Haly', 'Sklad': 'Sklady', 'Budova': 'Budovy', 'Obchod': 'Obchody'}.get(druh, druh)
    stavby.append({'druh': druh, 'adr': (adr[0] if len(adr) == 1 else f"{adr[0]} a další") if adr else None,
                   'oids': [q['oid'] for q in clen], 'px': sum(q['px'] for q in clen), 'ulice': ul, 'xy': (round(c.x), round(c.y))})
for s in stavby: s['nazev'] = s['adr'] or f"{s['druh']} ({s['ulice']})"
pocet = {}
for s in stavby: pocet[s['nazev']] = pocet.get(s['nazev'], 0) + 1
cislo = {}
for s in stavby:                                          # stejný název: pořadové číslo podle viditelnosti
    n = s['nazev']
    if pocet[n] > 1: cislo[n] = cislo.get(n, 0) + 1; s['nazev'] = f"{s['druh']} {cislo[n]} ({s['ulice']})" if not s['adr'] else f"{n} ({cislo[n]})"
stavby.sort(key=lambda s: (s['ulice'], -s['px']))
davky = {}
for i, s in enumerate(stavby): davky.setdefault('abcdefghijklmnopqrstuvwxyz'[i // DAVKA], {})[s['nazev']] = s['oids']
ks = list(davky)
if len(ks) > 1 and len(davky[ks[-1]]) < 3: davky[ks[-2]].update(davky.pop(ks[-1]))   # zbytek do poslední plné dávky
out = {'skupina': f'{CISLO}. výběr (ChatGPT)', 'zdroj': f'Pavel 2026-11-27: nejviditelnější budovy bez modelu (napady/CHATGPT-DAVKA-{CISLO}.md); skupina = jedna stavba s více budovami',
       'davky': davky}
f = f'nastroje-pavel/chatgpt-modely/vybery/{CISLO}.json'
json.dump(out, open(f, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
for d, st in davky.items():
    print(f'## {d}')
    for n, o in st.items():
        s = next(q for q in stavby if q['nazev'] == n); print(f"  {n:38} {s['px']:>7} px  {len(o)} bud.  {s['xy']}")
print(len(stavby), 'staveb,', sum(len(s['oids']) for s in stavby), 'budov →', f)
