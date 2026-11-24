# Výběr staveb pro ChatGPT najednou (i skupiny: víc budov = jedna stavba, jeden model).
#   .venv/bin/python nastroje-pavel/chatgpt-modely/vyber.py nastroje-pavel/chatgpt-modely/vybery/8.json [--zapis]
# Bez --zapis jen zkontroluje. Soubor: {"skupina": "8. výběr …", "zdroj": "…", "davky": {"a": {"Název stavby": ["oid8", …]}}}
# Dělá, co se u 6. a 7. výběru dělalo ručně: bod do pamatky/navic.json, kandidati.py, sestav.py --novy, doplnění oids skupiny a znovu sestav.
# Hlídá: budova existuje, nemá ji už jiný model ani jiná stavba výběru, jméno je volné, skupina není moc roztažená.
import glob, json, os, subprocess, sys
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.chdir(ROOT); sys.path.insert(0, ROOT)
import geo
from shapely.geometry import Polygon
from shapely.ops import unary_union

V = json.load(open(sys.argv[1], encoding='utf-8')); zapis = '--zapis' in sys.argv
MIMO = {'kandidati', 'navic', 'rozhodnuti', 'schvalene', 'seznam', 'vrsky'}
ma = {}
for f in glob.glob('pamatky/*.json'):
    n = os.path.basename(f)[:-5]
    if n in MIMO: continue
    for b in json.load(open(f, encoding='utf-8')).get('budovy') or []: ma[b['oid'][:8]] = n
B = {}
for C in sorted(geo.CHUNKS):
    cx, cy = geo.chunk_center(C)
    for b in json.load(open(f'{geo.chunk_dir(C)}/info_src.json', encoding='utf-8'))['buildings']:
        e = B.setdefault(b['oid'][:8], {'kusy': [], 'h': 0, 'addr': None})
        e['kusy'].append(Polygon([(x + cx, y + cy) for x, y in b['ring']]).buffer(0)); e['h'] = max(e['h'], b['top'] - b['base']); e['addr'] = e['addr'] or (b.get('addr') or [None])[0]
navic = json.load(open('pamatky/navic.json', encoding='utf-8')); jmena = {d['nazev'] for d in navic}
chyby, nove, videno = [], [], {}
for dv, stavby in V['davky'].items():
    print(f'## dávka {dv}')
    for nazev, oids in stavby.items():
        if nazev in jmena: chyby.append(f'{nazev}: jméno už v navic.json je')
        for o in oids:
            if o not in B: chyby.append(f'{nazev}: budova {o} není')
            if o in ma: chyby.append(f'{nazev}: {o} už má model {ma[o]}')
            if o in videno: chyby.append(f'{nazev}: {o} je i v „{videno[o]}“')
            videno[o] = nazev
        kus = [k for o in oids if o in B for k in B[o]['kusy']]
        if not kus: continue
        x0, y0, x1, y1 = unary_union(kus).bounds; r = max(x1 - x0, y1 - y0)
        if r > 300: chyby.append(f'{nazev}: skupina je roztažená přes {r:.0f} m (nad 300 m je ortofoto hrubé, rozdělit)')
        # balík se kreslí ze čtverce, ve kterém leží bod; domy dál než MARGIN za jeho hranicí v něm nejsou (Věžáky Sadová 2026-11-24)
        # → bod = první dům, z jehož čtverce jsou vidět všechny; jinak skupinu rozdělit
        p = None
        for o in (o for o in oids if o in B):
            q = max(B[o]['kusy'], key=lambda k: k.area).representative_point(); cx, cy = geo.chunk_center(geo.chunk_of(q.x, q.y)); h = geo.MESTO['polovina'] + geo.MARGIN
            if all(abs(k.centroid.x - cx) < h and abs(k.centroid.y - cy) < h for k in kus): p = q; break
        if p is None: chyby.append(f'{nazev}: žádný čtverec neobsáhne všechny domy (přes hranici čtverců), rozdělit'); continue
        lon, lat = geo.to_lonlat(p.x, p.y)
        nove.append({'nazev': nazev, 'lat': round(float(lat), 6), 'lon': round(float(lon), 6)})
        print(f"  {nazev:34} {len(oids)} bud. {r:4.0f} m  " + ', '.join(f"{B[o]['addr'] or o} ({B[o]['h']:.0f} m)" for o in oids if o in B))
print(f'staveb {len(nove)}, budov {len(videno)}'); [print('❌', c) for c in chyby]
if chyby: sys.exit(1)
if not zapis: sys.exit(0)

nove[0]['_zdroj'] = V['zdroj']
t = open('pamatky/navic.json', encoding='utf-8').read().rstrip()
assert t.endswith(']')
t = t[:-1].rstrip() + ',\n' + ',\n'.join(' ' + json.dumps(d, ensure_ascii=False) for d in nove) + '\n]\n'
json.loads(t); open('pamatky/navic.json', 'w', encoding='utf-8').write(t)
subprocess.run([sys.executable, 'pamatky/kandidati.py'], check=True, stdout=subprocess.DEVNULL)
K = {k['nazev']: k['slug'] for k in json.load(open('pamatky/kandidati.json', encoding='utf-8'))}
chybi = [d['nazev'] for d in nove if d['nazev'] not in K]
if chybi: sys.exit(f'❌ v kandidati.json nejsou: {chybi}')
subprocess.run([sys.executable, 'pamatky/sestav.py', '--novy', *[K[d['nazev']] for d in nove], '--skupina', V['skupina']], check=True, stdout=subprocess.DEVNULL)
for stavby in V['davky'].values():
    for nazev, oids in stavby.items():
        f = f'pamatky/{K[nazev]}.json'; d = json.load(open(f, encoding='utf-8')); d['oids'] = oids
        json.dump(d, open(f, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
subprocess.run([sys.executable, 'pamatky/sestav.py', *[K[d['nazev']] for d in nove]], check=True)
print('\nslugy dávek:'); [print(f'{dv}: ' + ' '.join(K[n] for n in s)) for dv, s in V['davky'].items()]
