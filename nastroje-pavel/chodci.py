"""Cesty pro chodce v mapě (lidé v ulicích, F13; Pavel 2026-11-16) -> site/chodci.json

    .venv/bin/python nastroje-pavel/chodci.py

Prohlížeč (web/app.html, „chodci“) po nich nechá chodit lidi: kolik jich je, řídí denní doba, počasí a roční období,
kam se rozmístí, řídí váha cesty. Render ani prep.py nejsou potřeba, stačí tenhle skript a build_html.py.

Odkud (Overture = OSM, data_all/segment.parquet), jen uvnitř zástavby (rozsah_mesta v mesto.json + 150 m):
  chodníky, pěší zóny, obytné zóny, schody, pěšiny  → po ose
  ulice (obytné až hlavní)                          → po obou stranách, kousek za okrajem silnice (šířka jako prep.py RW)
Váha = druh cesty × blízkost centra (vanocni_strom = náměstí) × blízkost restaurací a kaváren (assets/podniky.json).
Výstup ve světových souřadnicích mapy (m od středu, x na východ, y na sever), stejně jako sjezdovky pro lyžaře.
"""
import json, math, os, sys
import numpy as np, pyarrow.parquet as pq, shapely, shapely.ops
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import geo

OSA = {'pedestrian': 4.0, 'living_street': 2.0, 'footway': 1.5, 'steps': 1.0, 'path': 0.5, 'cycleway': 0.4}
OKRAJ = {'primary': 1.2, 'secondary': 1.2, 'tertiary': 1.0, 'residential': 0.6, 'unclassified': 0.4}
RW = {'primary': 10, 'secondary': 9, 'tertiary': 8, 'residential': 6, 'unclassified': 6}   # jako prep.py (celá šířka)
CHODNIK = 1.3                                              # m od okraje silnice ke středu chodníku

M = geo.MESTO
lok = lambda lat, lon: tuple(float(v) for v in geo.to_local(lon, lat))
mesto = shapely.Polygon([lok(la, lo) for la, lo in M['rozsah_mesta']]).buffer(150) if M.get('rozsah_mesta') else None
x0, y0, x1, y1 = geo.extent(0.0)
oblast = shapely.box(x0, y0, x1, y1)
if mesto is not None: oblast = oblast.intersection(mesto)
stred = lok(*M['vanocni_strom']) if M.get('vanocni_strom') else (0.0, 0.0)
pod = np.array([lok(p['lat'], p['lon']) for p in json.load(open('assets/podniky.json'))]) if os.path.exists('assets/podniky.json') else np.zeros((0, 2))

t = pq.read_table('data_all/segment.parquet', columns=['subtype', 'class', 'geometry']).to_pylist()
cesty, delka = [], 0.0
for r in t:
    if r['subtype'] != 'road' or (r['class'] not in OSA and r['class'] not in OKRAJ): continue
    g = shapely.transform(shapely.from_wkb(r['geometry']), lambda c: np.column_stack(geo.to_local(c[:, 0], c[:, 1])))
    g = g.intersection(oblast)
    if g.is_empty: continue
    casti = list(getattr(g, 'geoms', [g]))
    for l in casti:
        if l.geom_type != 'LineString' or l.length < 8: continue
        if r['class'] in OSA: linie, v0 = [l], OSA[r['class']]
        else:
            d = RW[r['class']] / 2 + CHODNIK
            linie, v0 = [l.offset_curve(d), l.offset_curve(-d)], OKRAJ[r['class']]
        for q in linie:
            if q.is_empty or q.geom_type != 'LineString' or q.length < 8: continue
            q = shapely.simplify(q, 0.4)
            c = q.interpolate(0.5, normalized=True)
            dc = math.hypot(c.x - stred[0], c.y - stred[1])
            v = v0 * (0.35 + 1.65 * math.exp(-dc / 700))
            if len(pod): v *= 1 + 0.6 * min(3, int((np.hypot(pod[:, 0] - c.x, pod[:, 1] - c.y) < 60).sum()))
            cesty.append([round(v, 3), [round(float(a), 1) for xy in q.coords for a in xy]])
            delka += q.length
# náměstí a pěší plochy (land_use pedestrian/plaza): přes plochu vede jen pár čar cest, lidé by chodili jen po nich.
# Proto napříč plochou procházky mezi náhodnými body uvnitř (pevné semínko = pokaždé stejné), hustota podle plochy.
rng = np.random.default_rng(7)
plochy = [shapely.transform(shapely.from_wkb(r['geometry']), lambda c: np.column_stack(geo.to_local(c[:, 0], c[:, 1])))
          for r in pq.read_table('data_all/land_use.parquet', columns=['subtype', 'class', 'geometry']).to_pylist()
          if r['subtype'] == 'pedestrian' and r['class'] in ('plaza', 'pedestrian')]
# a ruční pěší plochy z assets/upresneni.json (Masarykovo náměstí tam je, v Overture ne)
if os.path.exists('assets/upresneni.json'):
    plochy += [shapely.Polygon([lok(la, lo) for la, lo in p['q']]) for p in json.load(open('assets/upresneni.json')).get('plochy', [])
               if p.get('k') in ('plaza', 'plaza2') and len(p.get('q', [])) >= 3]
for g in plochy:
    g = g.intersection(oblast)
    if g.is_empty or g.area < 200: continue
    plocha = g.buffer(-1.5)                                 # kousek od okraje (domy, silnice)
    if plocha.is_empty: continue
    bx0, by0, bx1, by1 = plocha.bounds
    body = []
    while len(body) < max(4, min(40, int(g.area / 250))):
        q = shapely.Point(rng.uniform(bx0, bx1), rng.uniform(by0, by1))
        if plocha.contains(q): body.append((q.x, q.y))
    for a, b in zip(body, body[1:] + body[:1]):
        l = shapely.LineString([a, b])
        if not plocha.contains(l) or l.length < 8: continue
        c = l.interpolate(0.5, normalized=True)
        v = 3.0 * (0.35 + 1.65 * math.exp(-math.hypot(c.x - stred[0], c.y - stred[1]) / 700))
        cesty.append([round(v, 3), [round(float(a), 1) for xy in l.coords for a in xy]])
        delka += l.length
# cyklisté (Pavel 2026-11-17): cyklostezky po ose, pěšiny a polní cesty málo, v ulicích u pravého kraje vozovky
# (obě strany, jezdí se tam a zpět). Hlavní silnice bez cyklistů: v Hodoníně po nich jezdí kamiony.
KOLO_OSA = {'cycleway': 1.0, 'path': 0.25, 'track': 0.2}
KOLO_KRAJ = {'tertiary': 0.35, 'residential': 0.3, 'unclassified': 0.3, 'living_street': 0.2}
kola, delka_kola = [], 0.0
for r in t:
    if r['subtype'] != 'road' or (r['class'] not in KOLO_OSA and r['class'] not in KOLO_KRAJ): continue
    g = shapely.transform(shapely.from_wkb(r['geometry']), lambda c: np.column_stack(geo.to_local(c[:, 0], c[:, 1]))).intersection(oblast)
    if g.is_empty: continue
    for l in getattr(g, 'geoms', [g]):
        if l.geom_type != 'LineString' or l.length < 15: continue
        # směr jízdy (Pavel 2026-11-17: „jezdí po všech stranách silnice“): vpravo od osy (offset_curve záporný, Shapely
        # zachová směr čáry) jen po směru čáry = 1, vlevo jen proti = -1; cyklostezka a pěšina oběma směry = 0
        if r['class'] in KOLO_OSA: linie, v0 = [(l, 0)], KOLO_OSA[r['class']]
        else:
            d = RW.get(r['class'], 5) / 2 - 0.8
            linie, v0 = [(l.offset_curve(-d), 1), (l.offset_curve(d), -1)], KOLO_KRAJ[r['class']]
        for q, smer in linie:
            if q.is_empty or q.geom_type != 'LineString' or q.length < 15: continue
            q = shapely.simplify(q, 0.4)
            c = q.interpolate(0.5, normalized=True)
            v = v0 * (0.5 + 1.0 * math.exp(-math.hypot(c.x - stred[0], c.y - stred[1]) / 1200))
            kola.append([round(v, 3), [round(float(a), 1) for xy in q.coords for a in xy], smer])
            delka_kola += q.length
# zvířata v zoo (Pavel 2026-11-17): výběh = kruh kolem bodu z assets/zoo.json (nastroje-pavel/zoo.py) oříznutý
# Voronoiovou buňkou (sousední výběhy se nepřekrývají), bez budov a cestiček. Uvnitř procházka mezi náhodnými body
# (jako na náměstí), po ní se zvířata pasou: prohlížeč je kreslí jako chodce, jen pomaleji a s dlouhým stáním.
zoo = []
if os.path.exists('assets/zoo.json'):
    vybehy = json.load(open('assets/zoo.json'))
    body = [shapely.Point(*lok(z['lat'], z['lon'])) for z in vybehy]
    bunky = shapely.voronoi_polygons(shapely.MultiPoint(body), extend_to=oblast.envelope.buffer(500))
    okoli = shapely.MultiPoint(body).buffer(80)
    prekazky = [shapely.transform(shapely.from_wkb(r['geometry']), lambda c: np.column_stack(geo.to_local(c[:, 0], c[:, 1])))
                for r in pq.read_table('data_all/building.parquet', columns=['geometry']).to_pylist()]
    prekazky = [g.buffer(1.0) for g in prekazky if g.intersects(okoli)]
    prekazky += [shapely.transform(shapely.from_wkb(r['geometry']), lambda c: np.column_stack(geo.to_local(c[:, 0], c[:, 1]))).buffer(1.8)
                 for r in t if r['subtype'] == 'road']
    prekazky = shapely.unary_union([g for g in prekazky if g.intersects(okoli)])
    for z, b in zip(vybehy, body):
        bunka = next(c for c in bunky.geoms if c.contains(b))
        g = b.buffer(z['r']).intersection(bunka.buffer(-1.5)).difference(prekazky)
        casti = sorted(getattr(g, 'geoms', [g]), key=lambda p: p.distance(b) - p.area / 1e4)
        g = casti[0] if casti and not casti[0].is_empty else shapely.Polygon()
        if g.area < 12: print(f'  zoo: {z["nazev"]} – výběh jen {g.area:.0f} m², vynechán'); continue
        bx0, by0, bx1, by1 = g.bounds
        bod, cara = None, []
        for _ in range(400):                                   # 10 zastávek uvnitř, spojnice celé uvnitř výběhu
            q = (rng.uniform(bx0, bx1), rng.uniform(by0, by1))
            if not g.contains(shapely.Point(q)) or (bod and not g.contains(shapely.LineString([bod, q]))): continue
            cara.append(q); bod = q
            if len(cara) >= 10: break
        if len(cara) < 3: continue
        zoo.append([z['druh'], z['pocet'], [round(float(a), 1) for xy in cara for a in xy]])
# loďky (Pavel 2026-11-17): po Moravě od přístavu U jezu proti proudu (dál od jezu), kus po ose řeky.
# Přístav a jez z mesto.json "lode": {"pristav": [lat, lon], "jez": [lat, lon], "delka": m}
lode = []
L_ = M.get('lode')
if L_:
    pr, jz = shapely.Point(*lok(*L_['pristav'])), shapely.Point(*lok(*L_['jez']))
    voda = [r for r in pq.read_table('data_all/water.parquet', columns=['subtype', 'class', 'names', 'geometry']).to_pylist()]
    tr = lambda r: shapely.transform(shapely.from_wkb(r['geometry']), lambda c: np.column_stack(geo.to_local(c[:, 0], c[:, 1])))
    osa = shapely.line_merge(shapely.unary_union([tr(r) for r in voda if r['class'] == 'river'
                                                  and ((r['names'] or {}).get('primary') == L_.get('reka', 'Morava')) and r['subtype'] == 'river'
                                                  and tr(r).geom_type in ('LineString', 'MultiLineString')]))
    osa = min(getattr(osa, 'geoms', [osa]), key=lambda l: l.distance(pr))
    plocha = shapely.unary_union([tr(r) for r in voda if tr(r).geom_type in ('Polygon', 'MultiPolygon')])
    sp, sj = osa.project(pr), osa.project(jz)
    a, b = (sp, sp + L_.get('delka', 1500)) if sp >= sj else (sp - L_.get('delka', 1500), sp)
    trasa = shapely.ops.substring(osa, max(0, a), min(osa.length, b))
    if sp < sj: trasa = trasa.reverse()                         # vždy od přístavu proti proudu
    trasa = shapely.simplify(trasa, 1.0).intersection(shapely.box(x0 + 100, y0 + 100, x1 - 100, y1 - 100))   # jen uvnitř mapy
    trasa = min(getattr(trasa, 'geoms', [trasa]), key=lambda l: l.distance(pr))
    uvnitr = trasa.intersection(plocha.buffer(-6))
    print(f'loďky: trasa {trasa.length:.0f} m, z toho na vodě {uvnitr.length:.0f} m')
    lode.append({'b': [round(float(a), 1) for xy in trasa.coords for a in xy], 't': L_.get('typy', ['clun', 'pujcovna', 'kanoe']), 'o': 5})
    # slepá ramena (Pavel 2026-11-17: „ať to vypadá zajímavěji“): "ramena": [{"nazev", "bod": [lat, lon], "typy": […]}]
    # Plocha vody u bodu; trasa = osa řeky v ní (Stará Morava), jinak procházka mezi náhodnými body jako ve výběhu.
    # Stopa vpravo od osy podle šířky ramena (2 × plocha / obvod), ať loďka nevjede na břeh.
    osy = [tr(r) for r in voda if r['subtype'] in ('river', 'canal') and tr(r).geom_type == 'LineString']
    plochy_vody = [g for r in voda for g in getattr(tr(r), 'geoms', [tr(r)]) if g.geom_type == 'Polygon']
    for ra in L_.get('ramena', []):
        bod = shapely.Point(*lok(*ra['bod']))
        pl = min(plochy_vody, key=lambda g: g.distance(bod))
        if pl.distance(bod) > 30: print(f'  rameno {ra["nazev"]}: u bodu není voda, vynecháno'); continue
        sirka = 2 * pl.area / pl.length
        vnitrek = pl.buffer(-min(3, sirka / 3)).intersection(shapely.box(x0 + 60, y0 + 60, x1 - 60, y1 - 60))   # celá mapa, ne jen zástavba
        if vnitrek.is_empty: print(f'  rameno {ra["nazev"]}: mimo mapu, vynecháno'); continue
        kusy = [g for o in osy for g in getattr(o.intersection(vnitrek), 'geoms', [o.intersection(vnitrek)]) if g.geom_type == 'LineString']
        if kusy and max(k.length for k in kusy) > 80:
            trasa = shapely.simplify(max(kusy, key=lambda k: k.length), 1.0)
        else:                                                  # jezero bez osy: procházka mezi body uvnitř
            bx0, by0, bx1, by1 = vnitrek.bounds; cara, b0 = [], None
            for _ in range(2000):
                q = (rng.uniform(bx0, bx1), rng.uniform(by0, by1))
                if not vnitrek.contains(shapely.Point(q)) or (b0 and (not vnitrek.contains(shapely.LineString([b0, q])) or math.dist(b0, q) < 25)): continue
                cara.append(q); b0 = q
                if len(cara) >= 8: break
            if len(cara) < 3: print(f'  rameno {ra["nazev"]}: nevešla se trasa, vynecháno'); continue
            trasa = shapely.LineString(cara)
        print(f'  rameno {ra["nazev"]}: šířka ~{sirka:.0f} m, trasa {trasa.length:.0f} m')
        lode.append({'b': [round(float(a), 1) for xy in trasa.coords for a in xy], 't': ra.get('typy', ['kanoe', 'pramice']), 'o': round(min(3, sirka / 5), 1)})
os.makedirs('site', exist_ok=True)
json.dump({'cesty': cesty, 'kola': kola, 'zoo': zoo, 'lode': lode}, open('site/chodci.json', 'w'), separators=(',', ':'))
print(f'cest {len(cesty)}, délka {delka / 1000:.1f} km; pro kola {len(kola)}, {delka_kola / 1000:.1f} km; '
      f'výběhů {len(zoo)} ({sum(z[1] for z in zoo)} zvířat), tras loděk {len(lode)}; {os.path.getsize("site/chodci.json") // 1000} kB')
