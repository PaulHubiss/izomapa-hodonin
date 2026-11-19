"""Porovnání půdorysů budov v mapě (jen OSM – budovy Microsoft ML z Overture mapa nekreslí) s katastrem (RÚIAN, ČÚZK CC BY 4.0).

⚠️ RÚIAN není úplný soupis budov: stavby bez čísla (kostel sv. Vavřince, kůlny, garáže, část hal) v něm chybí,
stejně jako v INSPIRE BU (ověřeno 2026-11-13). Skupina „navic“ proto neznamená „zbořené“ – jen „ověřit na ortofotu“.

    .venv/bin/python nastroje-pavel/porovnej_pudorysy.py

Výstupy:
  build/pudorysy/rozdily.json      všechny rozdíly (poloha, plocha, adresa, údaje z katastru)
  snimky/pudorysy-prehled.png      přehled přes ortofoto: červeně chybí v mapě, modře navíc, oranžově jiný tvar
  napady/PUDORYSY.md               zpráva: počty a největší rozdíly s adresami

Skupiny:
  chybi     v katastru je, v mapě ne        (mapa pokrývá < 25 % plochy objektu)  → nejspíš novostavba
  navic     v mapě je, v katastru ne        (katastr pokrývá < 25 % plochy budovy) → zbořená, chybná, nebo se nezapisuje
  jiny_tvar v mapě jen zčásti               (25–70 % plochy objektu z katastru)   → přestavba, přístavba
Drobnosti pod MIN_PLOCHA m² se vynechávají (kůlny, přístřešky).
Katastr se stahuje po čtvercích do build/ruian_vse/ (jméno = zeměpisné souřadnice, takže přežije posun středu mapy)
a bere všechna pole, která se hodí i pro kartu budovy (plán, blok D).
"""
import collections, datetime, json, math, os, subprocess, sys, urllib.parse
import numpy as np, pyarrow.parquet as pq, shapely
from PIL import Image, ImageDraw, ImageFont

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import geo

URL = 'https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/Prohlizeci_sluzba_nad_daty_RUIAN/MapServer/3/query?'
POLE = ('kod,cisladomovni,typstavebnihoobjektukod,zpusobvyuzitikod,pocetpodlazi,platiod,dokonceni,pocetbytu,'
        'zastavenaplocha,podlahovaplocha,obestavenyprostor,druhkonstrukcekod,vybavenivytahemkod,zpusobvytapenikod')
D = 'build/ruian_vse/'
MIN_PLOCHA = 16.0
CHYBI, JINY = 0.25, 0.70
VYUZITI = {1: 'průmyslový objekt', 2: 'zemědělská usedlost', 3: 'objekt k bydlení', 4: 'zemědělská stavba', 5: 'občanské vybavení',
           6: 'bytový dům', 7: 'rodinný dům', 8: 'stavba pro rodinnou rekreaci', 9: 'stavba pro shromažďování',
           10: 'obchod', 11: 'ubytovací zařízení', 12: 'výroba a sklad', 13: 'zahradnický domek', 14: 'administrativa',
           15: 'zdravotnictví / sociální', 16: 'technické vybavení', 17: 'doprava', 18: 'garáž', 19: 'jiná stavba',
           20: 'víceúčelová stavba', 21: 'skleník'}
os.makedirs(D, exist_ok=True); os.makedirs('build/pudorysy', exist_ok=True); os.makedirs('snimky', exist_ok=True)

X0, Y0, X1, Y1 = geo.extent(0)
MAPA = shapely.box(X0, Y0, X1, Y1)
to_poly_local = lambda g: shapely.transform(g, lambda c: np.column_stack(geo.to_local(c[:, 0], c[:, 1])))
rok = lambda ms: datetime.datetime.fromtimestamp(ms / 1000, datetime.UTC).year if ms else None


# --- 1) katastr po čtvercích mapy ---
def stahni(c):
    cx, cy = geo.chunk_center(c); h = geo.HALF + 30
    (lo0, lo1), (la0, la1) = geo.to_lonlat([cx - h, cx + h], [cy - h, cy + h])
    lo0, lo1, la0, la1 = (round(float(v), 5) for v in (lo0, lo1, la0, la1))
    f = f'{D}{la0}_{lo0}_{la1}_{lo1}.json'
    if not os.path.exists(f):
        q = urllib.parse.urlencode({'geometry': f'{lo0},{la0},{lo1},{la1}', 'geometryType': 'esriGeometryEnvelope',
                                    'inSR': 4326, 'outSR': 4326, 'spatialRel': 'esriSpatialRelIntersects',
                                    'outFields': POLE, 'f': 'json'})
        subprocess.run(['curl', '-s', '-f', '-m', '300', '-o', f + '.tmp', URL + q], check=True)
        d = json.load(open(f + '.tmp'))
        if 'features' not in d: raise SystemExit(f'RÚIAN nevrátil data pro čtverec {c}')
        if d.get('exceededTransferLimit'): raise SystemExit(f'RÚIAN useknul odpověď pro čtverec {c} – zmenšit dotaz')
        os.replace(f + '.tmp', f)
    return json.load(open(f))['features']


R = {}                                             # kód objektu → (polygon v metrech, atributy)
for c in sorted(geo.CHUNKS):
    for o in stahni(c):
        a, g = o['attributes'], o.get('geometry')
        if not g or not g.get('rings') or a['kod'] in R: continue
        rings = [np.column_stack(geo.to_local(*np.asarray(r, float).T)) for r in g['rings']]
        p = shapely.make_valid(shapely.Polygon(rings[0], rings[1:]))
        if p.area >= MIN_PLOCHA and MAPA.contains(p.centroid): R[a['kod']] = (p, a)
print('objektů v katastru', len(R))

# --- 2) budovy mapy (Overture) ---
t = pq.read_table('data_all/building.parquet', columns=['id', 'geometry', 'sources', 'class', 'names'])
B = {}
for r in t.to_pylist():
    g = shapely.from_wkb(r['geometry'])
    if g.geom_type not in ('Polygon', 'MultiPolygon'): continue
    p = shapely.make_valid(to_poly_local(g))
    if p.area < MIN_PLOCHA or not MAPA.contains(p.centroid): continue
    zdroj = (r['sources'] or [{}])[0].get('dataset', '?')
    if not any(s.get('dataset') == 'OpenStreetMap' for s in (r['sources'] or [])): continue   # prep.py kreslí jen OSM (prep.py:751)
    jmeno = ((r['names'] or {}).get('primary') or '') if isinstance(r['names'], dict) else ''
    B[r['id']] = (p, zdroj, r['class'], jmeno)
print('budov v mapě', len(B), dict(collections.Counter(v[1] for v in B.values())))

# --- 3) adresy (z katastru přes Overture) ---
ta = pq.read_table('data_all/address.parquet', columns=['street', 'number', 'postal_city', 'geometry']).to_pylist()
A_XY = np.array([geo.to_local(*shapely.get_coordinates(shapely.from_wkb(a['geometry']))[0]) for a in ta])
A_TXT = [f"{a['street'] or a['postal_city'] or ''} {a['number'] or ''}".strip() for a in ta]
A_STROM = shapely.STRtree(shapely.points(A_XY))


def adresa(p):
    """adresní bod uvnitř půdorysu, jinak nejbližší do 25 m"""
    uvnitr = A_STROM.query(p, predicate='contains')
    if len(uvnitr): return A_TXT[uvnitr[0]]
    j = A_STROM.query_nearest(p.centroid, max_distance=25)
    return A_TXT[j[0]] + ' (poblíž)' if len(j) else ''


# --- 4) porovnání ---
SB = shapely.STRtree([v[0] for v in B.values()]); BP = [v[0] for v in B.values()]
SR = shapely.STRtree([v[0] for v in R.values()]); RP = [v[0] for v in R.values()]


def pokryti(p, strom, polys):
    kus = [polys[j] for j in strom.query(p)]
    return shapely.union_all([shapely.intersection(p, q) for q in kus]).area / p.area if kus else 0.0


ll = lambda p: [round(float(v), 6) for v in reversed(geo.to_lonlat(*p.centroid.coords[0]))]
out = {'chybi': [], 'jiny_tvar': [], 'navic': []}
for kod, (p, a) in R.items():
    k = pokryti(p, SB, BP)
    if k >= JINY: continue
    zaznam = {'kod': kod, 'latlon': ll(p), 'plocha': round(p.area), 'pokryti': round(k, 2), 'adresa': adresa(p),
              'cp': a['cisladomovni'], 'vyuziti': VYUZITI.get(a['zpusobvyuzitikod'], ''),
              'dokonceno': rok(a['dokonceni']), 'zmena_v_katastru': rok(a['platiod']), 'podlazi': a['pocetpodlazi'],
              'kruh': bool(4 * math.pi * p.area / p.length ** 2 > 0.85),      # kruhová nádrž (čistírna, jímka)
              'poly': [[round(float(x), 1), round(float(y), 1)] for x, y in shapely.get_coordinates(p.convex_hull if p.geom_type != 'Polygon' else p.exterior)]}
    out['chybi' if k < CHYBI else 'jiny_tvar'].append(zaznam)
for i, (p, zdroj, trida, jmeno) in B.items():
    k = pokryti(p, SR, RP)
    if k >= CHYBI: continue
    out['navic'].append({'id': i, 'latlon': ll(p), 'plocha': round(p.area), 'pokryti': round(k, 2), 'adresa': adresa(p),
                         'zdroj': zdroj, 'trida': trida, 'jmeno': jmeno,
                         'poly': [[round(float(x), 1), round(float(y), 1)] for x, y in shapely.get_coordinates(p.convex_hull if p.geom_type != 'Polygon' else p.exterior)]})
for v in out.values(): v.sort(key=lambda z: -z['plocha'])
json.dump(out, open('build/pudorysy/rozdily.json', 'w', encoding='utf-8'), ensure_ascii=False)
for k, v in out.items(): print(k, len(v), 'z toho ≥ 50 m²:', sum(z['plocha'] >= 50 for z in v))

# --- 5) přehledový obrázek přes ortofoto ---
MPP = 2.0
W, H = int((X1 - X0) / MPP), int((Y1 - Y0) / MPP)
(lo0, lo1), (la0, la1) = geo.to_lonlat([X0, X1], [Y0, Y1])
orto = f'build/pudorysy/orto_{float(la0):.5f}_{float(lo0):.5f}_{W}.jpg'
if not os.path.exists(orto):
    subprocess.run(['curl', '-s', '-m', '300', '-o', orto,
                    'https://ags.cuzk.gov.cz/arcgis1/services/ORTOFOTO/MapServer/WMSServer?SERVICE=WMS&VERSION=1.3.0'
                    f'&REQUEST=GetMap&LAYERS=0&STYLES=&CRS=EPSG:4326&BBOX={la0},{lo0},{la1},{lo1}&WIDTH={W}&HEIGHT={H}&FORMAT=image/jpeg'],
                   check=True)
im = Image.blend(Image.open(orto).convert('RGB').resize((W, H)), Image.new('RGB', (W, H), (20, 20, 20)), 0.45)
d = ImageDraw.Draw(im, 'RGBA')
px = lambda xy: [((x - X0) / MPP, (Y1 - y) / MPP) for x, y in xy]
BARVY = {'chybi': (255, 60, 60), 'jiny_tvar': (255, 170, 30), 'navic': (60, 160, 255)}
for k in ('navic', 'jiny_tvar', 'chybi'):
    for z in out[k]:
        c = BARVY[k]; d.polygon(px(z['poly']), fill=c + (150,), outline=c + (255,))
F = lambda s: ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc', s, index=1)
leg = [('chybi', f"chybí v mapě (v katastru je): {len(out['chybi'])}"),
       ('jiny_tvar', f"jiný tvar (v mapě jen zčásti): {len(out['jiny_tvar'])}"),
       ('navic', f"navíc v mapě (v katastru není): {len(out['navic'])}")]
o = Image.new('RGB', (W, H + 40 + 44 * len(leg)), (24, 24, 24)); o.paste(im, (0, 0)); do = ImageDraw.Draw(o)
for n, (k, s) in enumerate(leg):
    y = H + 24 + 44 * n; do.rectangle([20, y, 48, y + 28], fill=BARVY[k]); do.text((62, y + 2), s, font=F(26), fill=(235, 235, 235))
o.save('snimky/pudorysy-prehled.png')
print('snimky/pudorysy-prehled.png', o.size)

# --- 6) výřezy: chybí a jiný tvar od 50 m², očíslované jako ve zprávě (C1…, T1…) ---
os.makedirs('build/pudorysy/vyrezy', exist_ok=True)
VEL, VYB = 300, [('C', 'chybi'), ('T', 'jiny_tvar')]
polozky = [(f'{p}{n + 1}', k, z) for p, k in VYB for n, z in enumerate([z for z in out[k] if z['plocha'] >= 50])]
SLOUPCU = 6; radku = math.ceil(len(polozky) / SLOUPCU) if polozky else 0
list_ = Image.new('RGB', (SLOUPCU * (VEL + 10) + 10, radku * (VEL + 54) + 10), (24, 24, 24))
for n, (oznaceni, k, z) in enumerate(polozky):
    pts = np.array(z['poly']); cx, cy = pts.mean(0)
    r = max(40.0, (pts.max(0) - pts.min(0)).max() * 0.8)          # půl strany výřezu v m
    (a0, a1), (b0, b1) = geo.to_lonlat([cx - r, cx + r], [cy - r, cy + r])
    f = f'build/pudorysy/vyrezy/{z["kod"]}_{round(r)}.jpg'
    if not os.path.exists(f):
        subprocess.run(['curl', '-s', '-m', '120', '-o', f,
                        'https://ags.cuzk.gov.cz/arcgis1/services/ORTOFOTO/MapServer/WMSServer?SERVICE=WMS&VERSION=1.3.0'
                        f'&REQUEST=GetMap&LAYERS=0&STYLES=&CRS=EPSG:4326&BBOX={b0},{a0},{b1},{a1}&WIDTH={VEL}&HEIGHT={VEL}&FORMAT=image/jpeg'],
                       check=True)
    v = Image.open(f).convert('RGB').resize((VEL, VEL)); dv = ImageDraw.Draw(v, 'RGBA')
    q = lambda xy: [((x - cx + r) / (2 * r) * VEL, (cy + r - y) / (2 * r) * VEL) for x, y in xy]
    okno = shapely.box(cx - r, cy - r, cx + r, cy + r)
    for j in SB.query(okno):                                        # budovy mapy tence bíle
        for g in getattr(BP[j], 'geoms', [BP[j]]):
            dv.line(q(g.exterior.coords), (255, 255, 255, 200), 1)
    dv.line(q(z['poly']) + q(z['poly'][:1]), BARVY[k] + (255,), 3)   # objekt z katastru
    x0_, y0_ = (n % SLOUPCU) * (VEL + 10) + 10, (n // SLOUPCU) * (VEL + 54) + 10
    list_.paste(v, (x0_, y0_ + 44))
    dl = ImageDraw.Draw(list_)
    dl.text((x0_, y0_), f"{oznaceni}  {z['plocha']} m²  {z['dokonceno'] or ''}", font=F(20), fill=BARVY[k])
    dl.text((x0_, y0_ + 22), (z['adresa'] or z['vyuziti'])[:34], font=F(16), fill=(220, 220, 220))
    z['oznaceni'] = oznaceni
list_.save('snimky/pudorysy-vyrezy.png')
json.dump(out, open('build/pudorysy/rozdily.json', 'w', encoding='utf-8'), ensure_ascii=False)
print('snimky/pudorysy-vyrezy.png', list_.size, len(polozky), 'výřezů')

# --- 7) tabulka do napady/PUDORYSY-tabulka.md (generuje se, ruční komentář je v napady/PUDORYSY.md) ---
def druh(z):
    if z.get('kruh'): return 'nádrž'
    if (z['dokonceno'] or 0) >= 2020: return '**novostavba**'
    return ''
r_ = [f'# Rozdíly půdorysů: mapa (OSM) × katastr (RÚIAN) – tabulka',
      '', f'> Generuje `nastroje-pavel/porovnej_pudorysy.py` ({datetime.date.today()}), ručně neupravovat. Výřezy: `snimky/pudorysy-vyrezy.png`.',
      '', f"Celkem: chybí {len(out['chybi'])} · jiný tvar {len(out['jiny_tvar'])} · navíc {len(out['navic'])} (od {MIN_PLOCHA:.0f} m²). "
      'Níže jen položky od 50 m².', '']
for p, k, nadpis in (('C', 'chybi', 'Chybí v mapě (v katastru je)'), ('T', 'jiny_tvar', 'Jiný tvar (v mapě jen zčásti)')):
    r_ += [f'## {nadpis}', '', '| # | m² | druh | využití (katastr) | dokončeno | adresa | poloha |', '|---|---|---|---|---|---|---|']
    for z in out[k]:
        if 'oznaceni' not in z: continue
        la, lo = z['latlon']
        r_.append(f"| {z['oznaceni']} | {z['plocha']} | {druh(z)} | {z['vyuziti']} | {z['dokonceno'] or ''} | {z['adresa']} | "
                  f"[{la:.5f}, {lo:.5f}](https://www.openstreetmap.org/?mlat={la}&mlon={lo}#map=19/{la}/{lo}) |")
    r_.append('')
open('napady/PUDORYSY-tabulka.md', 'w', encoding='utf-8').write('\n'.join(r_) + '\n')
print('napady/PUDORYSY-tabulka.md')
