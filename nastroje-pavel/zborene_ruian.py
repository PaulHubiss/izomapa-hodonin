"""Kandidáti na zbořené budovy proti RÚIAN: má ještě dům v katastru živý stavební objekt?

    .venv/bin/python nastroje-pavel/zborene_ruian.py      (po zborene_vyrezy.py a nastroje/ruian.py)

RÚIAN se aktualizuje denně a stavební objekt zbořené stavby v něm zaniká, takže je to novější pohled než laser
DMP OK 2024 a ortofoto ze stejného snímkování. Vypíše pro každého kandidáta, jakou část půdorysu kryje stavební
objekt RÚIAN (build/ruian/*.json z nastroje/ruian.py) → build/zborene_ruian.json.
"""
import glob, json
import shapely
from shapely.geometry import shape

obj = {}   # podle kódu: sousední dlaždice stahování vracejí tentýž objekt víckrát
for f in glob.glob('build/ruian/*.json'):
    for ft in json.load(open(f)).get('features', []):
        rings = ft.get('geometry', {}).get('rings')
        if rings:
            obj[ft['attributes'].get('kod')] = shapely.make_valid(shape({'type': 'Polygon', 'coordinates': rings}))
obj = list(obj.items())
strom = shapely.STRtree([g for _, g in obj])
K = json.load(open('navrhy/zborene-kandidati.json', encoding='utf-8'))
import pyarrow.parquet as pq
geo = {r['id']: shapely.from_wkb(r['geometry']) for r in pq.read_table('data_all/building.parquet', columns=['id', 'geometry']).to_pylist()}
out = {}
for k in K:
    p = geo.get(k['id'])
    if p is None:
        out[k['z']] = {'id': k['id'], 'kryti': None, 'pozn': 'budova už v datech není'}; continue
    kryti = sum(shapely.area(shapely.intersection(p, obj[j][1])) for j in strom.query(p)) / p.area
    out[k['z']] = {'id': k['id'], 'kryti': round(min(kryti, 1), 2)}
    print(f"{k['z']:>4} {k['plocha']:>5} m²  {k['typ'] or '-':<14} RÚIAN kryje {kryti:4.0%}")
json.dump(out, open('build/zborene_ruian.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(len(obj), 'stavebních objektů RÚIAN,', len(K), 'kandidátů')
