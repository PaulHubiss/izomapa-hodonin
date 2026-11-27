# Budovy bez modelu, seřazené podle toho, jak moc jsou v mapě vidět – podklad pro další výběr pro ChatGPT.
#   .venv/bin/python nastroje-pavel/chatgpt-modely/kandidati_vyber.py [--plocha 250] [--vyska 9] [--ulice "Část názvu"] [--misto] [--viditelnost]
# Bez --viditelnost řadí podle objemu (půdorys × výška), s ním podle viditelných pixelů fasád a střechy z pohledu mapy
# (pamatky/viditelnost.py: zakrytí sousedy, bez stromů; px = pixely mapy při 0,2 m/px).
# Výpis: oid (8 znaků), výška (m, laser), půdorys (m²), třída, adresa, způsob využití z RÚIAN, rok, název nebo místa v budově
# (veřejná místa, podniky). --misto = jen budovy s názvem nebo místem. Slovensko (bez RÚIAN a adres) vynechává.
import glob, json, os, sys
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.chdir(ROOT); sys.path.insert(0, ROOT)
import geo
from shapely.geometry import Point, Polygon


def arg(n, d):
    return sys.argv[sys.argv.index(n) + 1] if n in sys.argv else d


PL, VY, UL, MISTO = float(arg('--plocha', 250)), float(arg('--vyska', 9)), arg('--ulice', ''), '--misto' in sys.argv
MIMO = {'kandidati', 'navic', 'rozhodnuti', 'schvalene', 'seznam', 'vrsky'}
ma = set()
for f in glob.glob('pamatky/*.json'):
    if os.path.basename(f)[:-5] in MIMO: continue
    ma |= {b['oid'][:8] for b in json.load(open(f, encoding='utf-8')).get('budovy') or []}
mista = []
for f, kl in (('assets/verejna_mista.json', 'druh'), ('assets/podniky.json', 'druh')):
    for m in json.load(open(f, encoding='utf-8')):
        x, y = geo.to_local(m['lon'], m['lat']); mista.append((Point(float(x), float(y)), m['nazev']))
kat = json.load(open('assets/ruian_karta.json', encoding='utf-8')) if os.path.exists('assets/ruian_karta.json') else {}
B = {}
for C in sorted(geo.CHUNKS):
    cx, cy = geo.chunk_center(C)
    for b in json.load(open(f'{geo.chunk_dir(C)}/info_src.json', encoding='utf-8'))['buildings']:
        o = b['oid'][:8]
        p = Polygon([(x + cx, y + cy) for x, y in b['ring']]).buffer(0)
        e = B.setdefault(o, {'p': p, 'h': 0, 'b': b})
        e['p'] = e['p'].union(p) if not e['p'].equals(p) else p
        e['h'] = max(e['h'], b['top'] - b['base'])
        if b.get('addr') and not e['b'].get('addr'): e['b'] = b
out = []
for o, e in B.items():
    b = e['b']
    if o in ma: continue
    nm = [n for q, n in mista if e['p'].buffer(1).contains(q)]
    if b.get('name'): nm.insert(0, b['name'])
    k = kat.get(b['oid']) or {}
    if not (b.get('addr') or k or nm): continue
    if MISTO and not nm: continue
    if not MISTO and (e['p'].area < PL or e['h'] < VY): continue
    a = ', '.join((b.get('addr') or [])[:3])
    if UL and UL.lower() not in a.lower(): continue
    out.append((-e['p'].area * e['h'], o, e['h'], e['p'].area, b.get('cls'), a, k, nm, e['p'].centroid))
VID = {}
if '--viditelnost' in sys.argv:                 # řadit podle viditelné plochy fasád a střechy z pohledu mapy (pamatky/viditelnost.py)
    sys.path.insert(0, os.path.join(ROOT, 'pamatky')); import viditelnost
    for C in sorted(geo.CHUNKS):
        for b in viditelnost.budovy(C) or []:
            VID[b['oid'][:8]] = VID.get(b['oid'][:8], 0) + round((b['zdi_vid'] + b['strecha_vid']) * viditelnost.K)
    out = [(-VID.get(r[1], 0),) + r[1:] for r in out]
out.sort(key=lambda r: r[0])
for _, o, h, s, cls, a, k, nm, c in out:
    print(f"{o} {(str(VID.get(o, '')) + ' px ') if VID else ''}{h:5.1f} m {s:6.0f} m²{str(cls)[:14]:14} {a[:44]:44} {str(k.get('vyuziti') or k.get('vyu') or '')[:24]:24} {str(k.get('rok') or ''):5} [{c.x:.0f},{c.y:.0f}] {' | '.join(nm)[:70]}")
print(len(out), 'budov bez modelu;', len(ma), 'budov s modelem')
