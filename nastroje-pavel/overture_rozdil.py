"""Co by přineslo novější vydání Overture: stáhne ho bokem (build/overture_<vydání>/) a porovná s daty, ze kterých stojí mapa.
Mapu ani data_*/ nemění.

    .venv/bin/python nastroje-pavel/overture_rozdil.py 2026-11-18.0 [48.8617,17.1090,350]

Vypíše počty přidaných, odebraných a změněných prvků po vrstvách (jen v rozsahu mapy) a s bodem i to, co je nového kolem něj.
"""
import collections, os, sys
VYD = sys.argv[1]; os.environ['IZO_OVERTURE'] = VYD
sys.path.insert(0, os.getcwd())
import pyarrow.dataset as ds, pyarrow.parquet as pq, shapely
import geo
from nastroje import overture

VRSTVY = [('buildings', 'building'), ('transportation', 'segment'), ('base', 'land_use'), ('base', 'water'), ('base', 'infrastructure'), ('base', 'land'), ('addresses', 'address')]
D = f'build/overture_{VYD}'; os.makedirs(D, exist_ok=True)
X0, X1, Y0, Y1 = geo.bbox_lonlat(400)
x0, x1, y0, y1 = geo.bbox_lonlat(0)
bod = [float(v) for v in sys.argv[2].split(',')] if len(sys.argv) > 2 else None


def osm(r):
    return next((s['record_id'].split('@')[0] for s in r['sources'] or [] if s.get('record_id') and s.get('dataset') == 'OpenStreetMap'), None)


def nacti(f):
    out = {}
    for r in pq.read_table(f).to_pylist():
        b = r['bbox']
        if b['xmin'] > x1 or b['xmax'] < x0 or b['ymin'] > y1 or b['ymax'] < y0: continue
        out[r['id']] = r
    return out


for tema, typ in VRSTVY:
    f = f'{D}/{typ}.parquet'
    if not os.path.exists(f):
        fl = ((ds.field('bbox', 'xmin') < X1) & (ds.field('bbox', 'xmax') > X0) & (ds.field('bbox', 'ymin') < Y1) & (ds.field('bbox', 'ymax') > Y0))
        pq.write_table(overture.dataset(tema, typ).to_table(filter=fl), f)
    a, b = nacti(f'data_all/{typ}.parquet'), nacti(f)
    pridano, odebrano = [b[i] for i in b.keys() - a.keys()], [a[i] for i in a.keys() - b.keys()]
    zmeneno = [b[i] for i in a.keys() & b.keys() if a[i]['geometry'] != b[i]['geometry'] or a[i].get('class') != b[i].get('class')]
    print(f'{typ:15} {len(a)} → {len(b)}   přidáno {len(pridano)}, odebráno {len(odebrano)}, změněno {len(zmeneno)}', flush=True)
    if pridano or odebrano:
        print('   přidáno podle druhu:', dict(collections.Counter(str(r.get('class')) for r in pridano).most_common(8)),
              '· odebráno:', dict(collections.Counter(str(r.get('class')) for r in odebrano).most_common(8)))
    if bod:
        for jm, rs in (('+', pridano), ('−', odebrano), ('~', zmeneno)):
            for r in rs:
                c = shapely.from_wkb(r['geometry']).centroid
                if abs(c.y - bod[0]) * 111320 < bod[2] and abs(c.x - bod[1]) * 73200 < bod[2]:
                    print(f'   {jm} u bodu: {osm(r)} {r.get("class")} {c.y:.5f},{c.x:.5f}')
