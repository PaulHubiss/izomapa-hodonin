# údaje o stavbách z RÚIAN (ČÚZK, CC BY 4.0) do karty budovy: rok dokončení, podlaží, byty, plocha, konstrukce, vytápění, výtah
# -> assets/ruian_karta.json (id budovy -> údaje); overlay.py je přidá do klikací vrstvy, prohlížeč je ukáže v kartě
# spouštět z kořene repa: python nastroje/ruian_karta.py   (stahuje po čtvercích do build/ruian_karta/, jména podle zeměpisných
# souřadnic, takže mezipaměť přežije posun středu mapy; texty číselníků bere ze služby, nic se nepřepisuje ručně)
import datetime, glob, json, os, re, subprocess, sys, urllib.parse
import numpy as np, pyarrow.parquet as pq, shapely
sys.path.insert(0, '.')
import geo

SLUZBA = 'https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/Prohlizeci_sluzba_nad_daty_RUIAN/MapServer/3'
D = 'build/ruian_karta/'
POLE = ['kod', 'zpusobvyuzitikod', 'dokonceni', 'pocetpodlazi', 'pocetbytu', 'zastavenaplocha', 'druhkonstrukcekod',
        'vybavenivytahemkod', 'zpusobvytapenikod']
NEZNAME = {'Nezjištěno', 'Nedefinováno'}
MIN_PREKRYTI = 0.5
os.makedirs(D, exist_ok=True)


def stahni(url, f):
    if not os.path.exists(f):
        subprocess.run(['curl', '-s', '-f', '-m', '300', '--retry', '3', '-o', f + '.tmp', url], check=True)
        os.replace(f + '.tmp', f)
    return json.load(open(f, encoding='utf-8'))


vrstva = stahni(SLUZBA + '?f=json', D + 'vrstva.json')
pomlcka = lambda t: ' '.join(re.sub(r'\s*[-–]\s+|\s+[-–]\s*', ' – ', t).split())   # „domovní- plyn“, „ -  uhlí“ → „ – “
CIS = {f['name']: {c['code']: pomlcka(c['name'])
                   for c in f['domain'].get('codedValues', [])} for f in vrstva['fields'] if f.get('domain')}


def text(pole, kod):
    t = CIS.get(pole, {}).get(kod)
    return None if t is None or t in NEZNAME else t[0].lower() + t[1:]   # v kartě jednotně malým písmenem („stěnové panely“)


# 1) stavební objekty po čtvercích mapy
R = {}
for c in sorted(geo.CHUNKS):
    cx, cy = geo.chunk_center(c); h = geo.HALF + geo.MARGIN
    (lo0, lo1), (la0, la1) = geo.to_lonlat([cx - h, cx + h], [cy - h, cy + h])
    lo0, lo1, la0, la1 = (round(float(v), 5) for v in (lo0, lo1, la0, la1))
    q = urllib.parse.urlencode({'geometry': f'{lo0},{la0},{lo1},{la1}', 'geometryType': 'esriGeometryEnvelope', 'inSR': 4326, 'outSR': 4326,
                                'spatialRel': 'esriSpatialRelIntersects', 'outFields': ','.join(POLE), 'f': 'json'})
    d = stahni(f'{SLUZBA}/query?{q}', f'{D}{la0}_{lo0}_{la1}_{lo1}.json')
    if 'features' not in d or d.get('exceededTransferLimit'): raise SystemExit(f'RÚIAN nevrátil úplná data pro čtverec {c}')
    for o in d['features']:
        a, g = o['attributes'], o.get('geometry')
        if a['kod'] in R or not g or not g.get('rings'): continue
        rings = [np.column_stack(geo.to_local(*np.asarray(r, float).T)) for r in g['rings']]
        R[a['kod']] = (shapely.make_valid(shapely.Polygon(rings[0], rings[1:])), a)
print('stavebních objektů', len(R))

# 2) budovy mapy (OSM jako v prep.py + ručně doplněné custom_bld)
B = {}
for f in sorted(glob.glob('data*/building.parquet')):
    if 'data_all' in f: continue
    for r in pq.read_table(f, columns=['id', 'geometry', 'sources']).to_pylist():
        if r['id'] in B or not any(s.get('dataset') == 'OpenStreetMap' for s in (r['sources'] or [])): continue
        g = shapely.from_wkb(r['geometry'])
        if g.geom_type in ('Polygon', 'MultiPolygon'):
            B[r['id']] = shapely.make_valid(shapely.transform(g, lambda c: np.column_stack(geo.to_local(c[:, 0], c[:, 1]))))
if os.path.exists('assets/upresneni.json'):
    for q in json.load(open('assets/upresneni.json', encoding='utf-8')).get('custom_bld', []):
        B[q['id']] = shapely.Polygon([geo.to_local(lo, la) for la, lo in q['poly']])

# 3) každé budově nejvíc překrývající stavební objekt (aspoň polovina její plochy)
objekty = list(R.values()); strom = shapely.STRtree([o[0] for o in objekty]); out = {}
for i, p in B.items():
    best, kolik = None, 0.0
    for j in strom.query(p):
        a = shapely.area(shapely.intersection(p, objekty[j][0]))
        if a > kolik: best, kolik = j, a
    if best is None or kolik < MIN_PREKRYTI * p.area: continue
    a = objekty[best][1]
    rok = datetime.datetime.fromtimestamp(a['dokonceni'] / 1000, datetime.UTC).year if a.get('dokonceni') else None
    z = {'kod': a['kod'], 'rok': rok, 'podl': a.get('pocetpodlazi'), 'byty': a.get('pocetbytu'), 'plocha': a.get('zastavenaplocha'),
         'vyuziti': text('zpusobvyuzitikod', a.get('zpusobvyuzitikod')), 'konstr': text('druhkonstrukcekod', a.get('druhkonstrukcekod')),
         'vytap': text('zpusobvytapenikod', a.get('zpusobvytapenikod')), 'vytah': {1: True, 2: False}.get(a.get('vybavenivytahemkod'))}
    out[i] = {k: v for k, v in z.items() if v not in (None, '', 0)}
json.dump(out, open('assets/ruian_karta.json', 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
print('budov', len(B), '· s údaji z katastru', len(out), '· s rokem dokončení', sum('rok' in v for v in out.values()))
