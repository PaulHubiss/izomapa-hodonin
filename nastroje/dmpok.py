# výšky budov z DMP OK (ČÚZK, model povrchu z obrazové korelace leteckých snímků, „žádné podmínky neplatí“)
# místo laseru DMP 1G (2013): Hodonín snímkován 2024, aktualizace po dvou letech.
#   python nastroje/dmpok.py              stáhne listy pokrývající mapu, zpracuje list po listu a LAZ hned maže (~350 MB / list)
#   python nastroje/dmpok.py --list HODO51  jen jeden list (pilot)
#   python nastroje/dmpok.py --vyhodnot   jen spočítá výsledky z už zpracovaných listů
#   --nech                                LAZ po zpracování nemazat (ladění; build/dmpok/<list>.json smazat, ať se list přepočítá)
# Body (třídy 2 terén, 6 budova) se nejdřív sečtou do mřížky 0,5 m (průměrná výška a barva v buňce), pak se měří budovy:
# medián a 90. percentil buněk budovy uvnitř půdorysu minus medián terénu v prstenci 1–14 m kolem.
# Výstupy: build/dmpok/<list>.json (buňky budov z listu), build/dmpok_vysky.json (stejný tvar jako build/dmp_vysky.json
# + podíl půdorysu, kde DMP OK budovu vidí, + barva střechy), build/dmpok_porovnani.csv (proti laseru 2013).
import csv, glob, json, os, re, subprocess, sys
import numpy as np, laspy, shapely, pyarrow.parquet as pq
from pyproj import Transformer
sys.path.insert(0, '.')
import geo

D = 'build/dmpok/'
CELL = 0.5
OKRAJ = 0.75          # m, o kolik se půdorys zmenší pro měření střechy (rozmazané hrany, posun obrysu OSM)
NDVI_MAX = 0.15       # body budovy zelenější než tohle jsou koruny stromů (vegetační střechy tím taky vypadnou)
ATOM = 'https://atom.cuzk.gov.cz/DMPOK-SJTSK-LAZ/DMPOK-SJTSK-LAZ.xml'
T = Transformer.from_crs(4326, 5514, always_xy=True)
os.makedirs(D, exist_ok=True)


def listy():
    """listy DMP OK, které zasahují do mapy"""
    if not os.path.exists(D + 'atom.xml'): subprocess.run(['curl', '-sL', '-m', '300', '-o', D + 'atom.xml', ATOM], check=True)
    s = open(D + 'atom.xml', encoding='utf8').read(); lo0, lo1, la0, la1 = geo.bbox_lonlat(50)
    mapa = shapely.box(lo0, la0, lo1, la1); out = []
    for e in s.split('<entry>')[1:]:
        p = re.search(r'<georss:polygon>(.*?)<', e); k = re.search(r'DMPOK-SJTSK-LAZ_([A-Z0-9]+)\.xml', e)
        if p and k:
            v = list(map(float, p.group(1).split()))
            if shapely.box(min(v[1::2]), min(v[0::2]), max(v[1::2]), max(v[0::2])).intersects(mapa): out.append(k.group(1))
    return sorted(out)


def budovy():
    """budovy mapy: OSM (jen ty kreslí prep.py) + ručně doplněné custom_bld; id -> (polygon v S-JTSK, řádek)"""
    B = {}
    for f in sorted(glob.glob('data*/building.parquet')):
        if 'data_all' in f: continue
        for r in pq.read_table(f, columns=['id', 'geometry', 'height', 'num_floors', 'class', 'sources']).to_pylist():
            if r['id'] in B or not any(s.get('dataset') == 'OpenStreetMap' for s in (r['sources'] or [])): continue
            g = shapely.from_wkb(r['geometry'])
            if g.geom_type in ('Polygon', 'MultiPolygon'): B[r['id']] = (g, r)
    U = json.load(open('assets/upresneni.json', encoding='utf-8')) if os.path.exists('assets/upresneni.json') else {}
    for q in U.get('custom_bld', []):
        B[q['id']] = (shapely.Polygon([(lo, la) for la, lo in q['poly']]), {'height': q.get('h'), 'num_floors': None, 'class': q.get('cls')})
    ids = list(B)
    P = shapely.make_valid(shapely.transform([B[i][0] for i in ids], lambda c: np.column_stack(T.transform(c[:, 0], c[:, 1]))))
    return ids, P, B


def zpracuj(n, ids, P):
    out_f = f'{D}{n}.json'
    if os.path.exists(out_f): return
    laz = f'{D}{n}.laz'
    if not os.path.exists(laz):
        z = f'{D}{n}.zip'
        # server občas spojení uprostřed přeruší (curl 56, 2026-11-13 u HODO72 v 90 %) → opakovat a navázat (-C -)
        subprocess.run(['curl', '-sL', '-f', '-m', '1200', '--retry', '5', '--retry-delay', '10', '--retry-all-errors', '-C', '-',
                        '-o', z, f'https://openzu.cuzk.gov.cz/opendata/DMPOK-LAZ/epsg-5514/{n}.zip'], check=True)
        subprocess.run(['unzip', '-oq', z, '-d', D], check=True); os.remove(z)
    with laspy.open(laz) as f:
        x0, y0 = f.header.mins[0], f.header.mins[1]
        W = int(np.ceil((f.header.maxs[0] - x0) / CELL)) + 1; H = int(np.ceil((f.header.maxs[1] - y0) / CELL)) + 1
        N = W * H
        sB = np.zeros(N, np.float32); cB = np.zeros(N, np.float32); sG = np.zeros(N, np.float32); cG = np.zeros(N, np.float32)
        sR = np.zeros(N, np.float32); sGr = np.zeros(N, np.float32); sBl = np.zeros(N, np.float32)
        for ch in f.chunk_iterator(5_000_000):
            c = np.asarray(ch.classification); X = np.asarray(ch.x); Y = np.asarray(ch.y); Z = np.asarray(ch.z)
            idx = ((Y - y0) / CELL).astype(np.int64) * W + ((X - x0) / CELL).astype(np.int64)
            # koruny stromů nad střechou korelace zařadí jako budovu → vyřadit podle zeleně (NDVI z kanálů NIR a R):
            # ověřeno na garážích v Hodoníně 2026-11-13: střechy NDVI ≤ −0,08 (p90), koruna nad garáží ≥ 0,34 (p10)
            nir, red = np.asarray(ch.nir).astype(np.float32), np.asarray(ch.red).astype(np.float32)
            m = (c == 6) & ((nir - red) / np.maximum(nir + red, 1) < NDVI_MAX)
            if m.any():
                cB += np.bincount(idx[m], minlength=N).astype(np.float32); sB += np.bincount(idx[m], Z[m], minlength=N).astype(np.float32)
                for s, k in ((sR, 'red'), (sGr, 'green'), (sBl, 'blue')):
                    s += np.bincount(idx[m], np.asarray(ch[k])[m] / 256.0, minlength=N).astype(np.float32)
            m = c == 2
            if m.any():
                cG += np.bincount(idx[m], minlength=N).astype(np.float32); sG += np.bincount(idx[m], Z[m], minlength=N).astype(np.float32)
    zB = np.where(cB > 0, sB / np.maximum(cB, 1), np.nan); zG = np.where(cG > 0, sG / np.maximum(cG, 1), np.nan)
    rgb = np.stack([sR, sGr, sBl], 1) / np.maximum(cB, 1)[:, None]
    list_box = shapely.box(x0, y0, x0 + W * CELL, y0 + H * CELL)
    vys = {}
    for k in shapely.STRtree(P).query(list_box):
        p = P[k]; kruh = shapely.difference(shapely.buffer(p, 14), shapely.buffer(p, 1))
        # korelace snímků rozmazává hrany střech: malá budova u vysoké by „chytila“ výšku souseda → měřit jen vnitřek
        vnitrek = shapely.buffer(p, -OKRAJ)
        if vnitrek.is_empty or vnitrek.area < 6: vnitrek = p
        rec = []
        for poly in (vnitrek, kruh):
            bx0, by0, bx1, by1 = poly.bounds
            i0, i1 = max(0, int((bx0 - x0) / CELL)), min(W - 1, int((bx1 - x0) / CELL))
            j0, j1 = max(0, int((by0 - y0) / CELL)), min(H - 1, int((by1 - y0) / CELL))
            if i1 < i0 or j1 < j0: rec.append(None); continue
            ii, jj = np.meshgrid(np.arange(i0, i1 + 1), np.arange(j0, j1 + 1))
            uvnitr = shapely.contains_xy(poly, x0 + (ii + 0.5) * CELL, y0 + (jj + 0.5) * CELL)
            rec.append((jj[uvnitr] * W + ii[uvnitr]).ravel())
        if rec[0] is None or not len(rec[0]): continue
        b = rec[0]; vb = zB[b]; ok = ~np.isnan(vb)
        g = zG[rec[1]] if rec[1] is not None and len(rec[1]) else np.array([])
        # buňky půdorysu, kde je jen terén (žádná střecha) – odliší zbořený dům od díry v datech
        # (fotovoltaika, lesklé střechy: korelace tam nedá body vůbec, ověřeno na skladu 48,8417 / 17,1251)
        zem = int(((cG[b] > 0) & (cB[b] == 0)).sum())
        vys[ids[k]] = {'n': int(len(b)), 'zem': zem, 'b': np.round(vb[ok], 2).tolist(), 'g': np.round(g[~np.isnan(g)], 2).tolist(),
                       'rgb': np.round(np.median(rgb[b[ok]], 0)).astype(int).tolist() if ok.sum() >= 4 else None}
    json.dump(vys, open(out_f, 'w'), separators=(',', ':'))
    if '--nech' not in sys.argv: os.remove(laz)        # šetřit disk: LAZ ~350 MB, výsledek listu pár MB
    print(n, 'budov', len(vys), flush=True)


def vyhodnot(ids, P, B):
    acc = {}
    for f in sorted(glob.glob(D + '*.json')):
        if f.endswith('atom.xml'): continue
        for i, v in json.load(open(f)).items():
            a = acc.setdefault(i, {'n': 0, 'zem': 0, 'b': [], 'g': [], 'rgb': []})
            a['n'] += v['n']; a['zem'] += v.get('zem', 0); a['b'] += v['b']; a['g'] += v['g']
            if v['rgb']: a['rgb'].append(v['rgb'])
    idx = {i: k for k, i in enumerate(ids)}; res = {}
    for i, a in acc.items():
        if i not in idx or len(a['g']) < 4: continue
        r = B[i][1]; c = B[i][0].centroid; g0 = float(np.median(a['g']))
        pokryti = len(a['b']) / max(a['n'], 1)
        med = round(float(np.median(a['b'])) - g0, 1) if a['b'] else None
        p90 = round(float(np.percentile(a['b'], 90)) - g0, 1) if a['b'] else None
        res[i] = [round(float(P[idx[i]].area)), len(a['b']), med, p90, r.get('num_floors'), round(r['height'], 1) if r.get('height') else None,
                  r.get('class'), round(c.y, 6), round(c.x, 6), round(pokryti, 2), a['rgb'][0] if a['rgb'] else None,
                  round(a['zem'] / max(a['n'], 1), 2)]
    json.dump(res, open('build/dmpok_vysky.json', 'w'))

    # staré výšky z laseru 2013 (jen spolehlivé, ty dřív používal prep.py) – záloha tam, kde DMP OK selže
    ZALOHA = 'build/dmp_vysky_2013.json'
    if not os.path.exists(ZALOHA) and os.path.exists('assets/dmp_vysky.json'):
        json.dump(json.load(open('assets/dmp_vysky.json')), open(ZALOHA, 'w'), separators=(',', ':'))
    stare = json.load(open(ZALOHA)) if os.path.exists(ZALOHA) else {}
    nove, rows, zborene, pocty = {}, [], [], {'2024': 0, '2013 (záloha)': 0}
    for i, v in res.items():
        ar, med, p90, pok, zem = v[0], v[2], v[3], v[9], v[11]
        spolehlive = med is not None and pok >= 0.4 and 1.5 <= med <= 75 and not (p90 - med > 8 and ar > 300)
        if spolehlive: nove[i] = [med, p90]; pocty['2024'] += 1
        elif i in stare: nove[i] = stare[i]; pocty['2013 (záloha)'] += 1
        if pok < 0.2 and zem >= 0.6 and ar >= 30 and not i.startswith('ruian_'):
            zborene.append([i, ar, pok, zem, v[6] or '', v[7], v[8]])
        old = stare[i][0] if i in stare else None
        rows.append([i, ar, pok, zem, old, med, round(med - old, 1) if (med is not None and old is not None) else None,
                     'ano' if spolehlive else '', v[6] or '', v[7], v[8]])
    for i in stare:                                   # budovy mimo listy DMP OK si nechají starou výšku
        if i not in nove: nove[i] = stare[i]
    json.dump(nove, open('assets/dmp_vysky.json', 'w'), separators=(',', ':'))
    with open('build/dmpok_porovnani.csv', 'w', newline='', encoding='utf-8-sig') as f:
        w = csv.writer(f, delimiter=';')
        w.writerow(['id', 'plocha m2', 'pokrytí střechou', 'podíl terénu v půdorysu', 'medián 2013', 'medián 2024', 'rozdíl', 'použito 2024', 'typ', 'lat', 'lon'])
        w.writerows(rows)
    with open('build/dmpok_zborene.csv', 'w', newline='', encoding='utf-8-sig') as f:
        w = csv.writer(f, delimiter=';'); w.writerow(['id', 'plocha m2', 'pokrytí střechou', 'podíl terénu', 'typ', 'lat', 'lon'])
        w.writerows(sorted(zborene, key=lambda z: -z[1]))
    zm = [r for r in rows if r[6] is not None and abs(r[6]) > 2 and r[7]]
    print('změřeno', len(res), '· výška z 2024', pocty['2024'], '· záloha 2013', pocty['2013 (záloha)'],
          '· změna > 2 m', len(zm), '· kandidáti na zbořené', len(zborene), '→ assets/dmp_vysky.json, build/dmpok_zborene.csv')


if __name__ == '__main__':
    ids, P, B = budovy()
    if '--vyhodnot' not in sys.argv:
        seznam = [sys.argv[sys.argv.index('--list') + 1]] if '--list' in sys.argv else listy()
        print('listů', len(seznam), seznam, flush=True)
        for n in seznam: zpracuj(n, ids, P)
    vyhodnot(ids, P, B)
