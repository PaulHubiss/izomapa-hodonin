"""Rozsah zástavby města pro nejmenší přiblížení mapy („diorama“, Pavel 2026-11-16) -> vypíše "rozsah_mesta" do mesto.json.

    .venv/bin/python nastroje-pavel/rozsah_mesta.py          vypíše výsledek
    .venv/bin/python nastroje-pavel/rozsah_mesta.py zapis    a zapíše ho do mesto.json

Mapa jde oddálit tak, aby byl v okně vidět celý tenhle obrys (web/app.html, limitZoom). Bez něj platí dřívější
pravidlo: oddálit jen na největší obdélník uvnitř kosočtverce mapy (na telefonu na výšku ~32 % mapy).

Obrys = konvexní obal budov uvnitř hranice obce (build/hranice_obce.geojson z nastroje-pavel/mrizka.py) a uvnitř mapy,
jen z buněk 150 × 150 m, kde budovy zabírají aspoň PRAH plochy: samoty a chatové osady na kraji ho nenafouknou.
"""
import json, os, sys
import numpy as np, pyarrow.parquet as pq, shapely
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import geo

BUNKA, PRAH = 150.0, 0.04

obec = shapely.geometry.shape(json.load(open('build/hranice_obce.geojson')))
obec = shapely.transform(obec, lambda p: np.column_stack(geo.to_local(p[:, 0], p[:, 1])))
x0, y0, x1, y1 = geo.extent(0.0)
g = shapely.from_wkb(pq.read_table('data_all/building.parquet', columns=['geometry']).column('geometry').to_pylist())
g = shapely.transform(g, lambda p: np.column_stack(geo.to_local(p[:, 0], p[:, 1])))
c = shapely.get_coordinates(shapely.centroid(g)); a = shapely.area(g)
uvnitr = shapely.contains_xy(obec, c[:, 0], c[:, 1]) & (c[:, 0] > x0) & (c[:, 0] < x1) & (c[:, 1] > y0) & (c[:, 1] < y1)
c, a, g = c[uvnitr], a[uvnitr], g[uvnitr]
klic = np.floor(c / BUNKA).astype(int)
plocha = {}
for k, s in zip(map(tuple, klic), a): plocha[k] = plocha.get(k, 0.0) + s
husto = np.array([plocha[tuple(k)] >= PRAH * BUNKA ** 2 for k in klic])
obal = shapely.convex_hull(shapely.union_all(g[husto]))
obal = shapely.simplify(obal, 25.0).intersection(shapely.box(x0, y0, x1, y1))
pod = a[husto].sum() / a.sum() * 100
body = [[round(float(la), 5), round(float(lo), 5)] for lo, la in
        (geo.to_lonlat(x, y) for x, y in list(obal.exterior.coords)[:-1])]
print(f'budov v obci a v mapě {len(a)}, v obrysu {husto.sum()} ({pod:.0f} % zastavěné plochy), bodů obrysu {len(body)}')
print(f'obrys {obal.bounds[2] - obal.bounds[0]:.0f} × {obal.bounds[3] - obal.bounds[1]:.0f} m, mapa {x1 - x0:.0f} × {y1 - y0:.0f} m')
if sys.argv[1:2] == ['zapis']:
    t = open('mesto.json', encoding='utf-8').read()
    m = json.loads(t)
    radek = ' "rozsah_mesta": ' + json.dumps(body) + ',\n'
    if 'rozsah_mesta' in m:
        import re
        t = re.sub(r' "rozsah_mesta": \[.*?\]\],\n', lambda _: radek, t, flags=re.S)
    else:
        t = t.replace('{\n', '{\n' + radek, 1)
    assert json.loads(t)['rozsah_mesta'] == body
    open('mesto.json', 'w', encoding='utf-8').write(t)
    print('zapsáno do mesto.json')
