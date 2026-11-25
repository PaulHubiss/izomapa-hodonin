# popis.md pro všechny stavby výběru najednou (u 8. výběru se psal ručně): údaje budov z RÚIAN, laser, místa v budově.
#   .venv/bin/python nastroje-pavel/chatgpt-modely/popis_hromadne.py nastroje-pavel/chatgpt-modely/vybery/9.json
# Z výběru bere i "poznamky": {"Název stavby": "na co si dát pozor"} a "poznamky_davky": {"a": "…"}. Existující popis.md nepřepíše
# (kromě --znovu). Pouštět po vyber.py --zapis a před pamatky/podklady_md.py.
import json, os, sys
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.chdir(ROOT); sys.path.insert(0, ROOT)
import geo
from shapely.geometry import Point, Polygon

V = json.load(open(sys.argv[1], encoding='utf-8'))
KAT = json.load(open('assets/ruian_karta.json', encoding='utf-8'))
DMP = json.load(open('assets/dmp_vysky.json', encoding='utf-8'))
SLUG = {k['nazev']: k['slug'] for k in json.load(open('pamatky/kandidati.json', encoding='utf-8'))}
MISTA = []
for f in ('assets/verejna_mista.json', 'assets/podniky.json'):
    for m in json.load(open(f, encoding='utf-8')):
        x, y = geo.to_local(m['lon'], m['lat']); MISTA.append((Point(float(x), float(y)), m['nazev']))
B = {}
for C in sorted(geo.CHUNKS):
    cx, cy = geo.chunk_center(C)
    for b in json.load(open(f'{geo.chunk_dir(C)}/info_src.json', encoding='utf-8'))['buildings']:
        p = Polygon([(x + cx, y + cy) for x, y in b['ring']]).buffer(0)
        e = B.setdefault(b['oid'][:8], {'oid': b['oid'], 'p': p, 'addr': b.get('addr') or [], 'h': 0})
        e['p'] = e['p'].union(p); e['h'] = max(e['h'], b['top'] - b['base']); e['addr'] = e['addr'] or b.get('addr') or []
n = 0
for dv, stavby in V['davky'].items():
    for nazev, oids in stavby.items():
        d = f'podklady-soukrome/pamatky/{SLUG[nazev]}'; f = f'{d}/popis.md'
        os.makedirs(d, exist_ok=True)
        if os.path.exists(f) and '--znovu' not in sys.argv: continue
        o = []
        for t in (V.get('poznamky', {}).get(nazev), V.get('poznamky_davky', {}).get(dv)):
            if t: o += [t, '']
        if len(oids) > 1:
            o += [f'Jeden model pro {len(oids)} {"budovy" if len(oids) < 5 else "budov"}. Každá má vlastní výšku, střechu a fasádu podle svých údajů; u shodných domů stačí '
                  'jedna funkce s parametry.', '']
        o += ['| budova | oid | RÚIAN: rok | podlaží | bytů | využití | konstrukce | laser medián / p90 m | v budově |', '|---|---|---|---|---|---|---|---|---|']
        for q in oids:
            e = B[q]; k = KAT.get(e['oid'], {}); l = DMP.get(e['oid'])
            ms = ', '.join(nm for pt, nm in MISTA if e['p'].buffer(1).contains(pt))
            o.append(f"| {', '.join(e['addr'][:4]) or '–'} | `{q}` | {k.get('rok', '–')} | {k.get('podl', '–')} | {k.get('byty', '–')} | {k.get('vyuziti', '–')} | "
                     f"{k.get('konstr', '–')} | {f'{l[0]:.1f} / {l[1]:.1f}' if l else 'není, v mapě %.1f' % e['h']} | {ms or '–'} |")
        o += ['', 'Rok v RÚIAN je rok dokončení nebo období (1945, 1960, 1970, 1980, 1990 bývá konec období), neber ho jako přesný. Fotky: co není '
              've `fotky/`, hledej podle mantinelů v ZADANI.md a u každé budovy ověř číslo popisné. Co nevíš, napiš do poznámek jako odhad.']
        open(f, 'w', encoding='utf-8').write('\n'.join(o) + '\n'); n += 1
print('popis.md zapsáno', n)
