"""Tvar ulic pro zvýraznění v hledání (Pavel 2026-11-17) -> site/ulice.json

    .venv/bin/python nastroje-pavel/ulice.py

Hledání (web/app.html) zná ulici jen jako jeden bod (overlay.py → prep.py street_out, střed nejdelšího kusu). Aby šla
celá ulice v mapě obtáhnout, uloží se sem její čáry: všechny pojmenované úseky silnic a cest z Overture
(data_all/segment.parquet), oříznuté mapou, zjednodušené na 1 m. Ve světových souřadnicích (m od středu, x na východ,
y na sever) jako chodci.json; prohlížeč je promítne přes terén sám. Soubor se načte až při prvním vybrání ulice.
{"Národní třída": [[x0, y0, x1, y1, …], …], …}
"""
import json, os, sys
import numpy as np, pyarrow.parquet as pq, shapely
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import geo

x0, y0, x1, y1 = geo.extent(0.0)
oblast = shapely.box(x0, y0, x1, y1)
ulice = {}
for r in pq.read_table('data_all/segment.parquet', columns=['subtype', 'names', 'geometry']).to_pylist():
    n = ((r['names'] or {}).get('primary') or '').strip()
    if r['subtype'] != 'road' or not n: continue
    g = shapely.transform(shapely.from_wkb(r['geometry']), lambda c: np.column_stack(geo.to_local(c[:, 0], c[:, 1]))).intersection(oblast)
    for l in getattr(g, 'geoms', [g]):
        if l.geom_type == 'LineString' and l.length >= 2: ulice.setdefault(n, []).append(l)
out = {}
for n, ls in ulice.items():
    m = shapely.line_merge(shapely.MultiLineString(ls))                 # navazující úseky do souvislých čar (méně bodů)
    out[n] = [[round(float(v), 1) for xy in shapely.simplify(l, 1.0).coords for v in xy] for l in getattr(m, 'geoms', [m])]
os.makedirs('site', exist_ok=True)
json.dump(out, open('site/ulice.json', 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
print(f'ulic {len(out)}, čar {sum(len(v) for v in out.values())}, {os.path.getsize("site/ulice.json") // 1000} kB')
