"""Kdy kdo v OpenStreetMap kolem bodu naposledy kreslil: co je tam nové a jestli to už máme v datech (Overture).

    .venv/bin/python nastroje-pavel/osm_stari.py 48.8617,17.1085 [poloměr m] [od roku]

Vypíše prvky od nejnovějších (datum poslední změny, druh, rozměr) a u každého, jestli jeho ID je v data_all/*.parquet.
Vzniklo 2026-11-25 nad parkem U Červených domků (otevřený 6/2026, ortofoto z roku 2024 ho neukazuje).
"""
import glob, os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'nastroje')); sys.path.insert(0, os.getcwd())
from overpass import dotaz
import pyarrow.parquet as pq

bod = sys.argv[1]; R = sys.argv[2] if len(sys.argv) > 2 else '350'; OD = sys.argv[3] if len(sys.argv) > 3 else '2024'
la, lo = bod.split(',')
prvky = dotaz(f'[out:json][timeout:80];nwr(around:{R},{la},{lo})[~"^(leisure|sport|highway|landuse|natural|amenity|building|barrier|playground|surface|construction)$"~"."];out meta center;')
znama = set()
for f in glob.glob('data_all/*.parquet'):
    try: t = pq.read_table(f, columns=['sources']).to_pylist()
    except Exception: continue
    for r in t:
        for s in r['sources'] or []:
            if s.get('record_id'): znama.add(s['record_id'].split('@')[0])
ZN = {'node': 'n', 'way': 'w', 'relation': 'r'}
KL = ('leisure', 'sport', 'highway', 'landuse', 'natural', 'amenity', 'building', 'playground', 'fitness_station', 'surface', 'name', 'construction', 'footway')
v = sorted((e for e in prvky if e.get('tags') and e['timestamp'][:4] >= OD), key=lambda e: e['timestamp'], reverse=True)
for e in v:
    c = e.get('center', e)
    print(e['timestamp'][:10], f"{e['type'][0]}{e['id']}", f"{c['lat']:.5f},{c['lon']:.5f}", 'v datech' if ZN[e['type']] + str(e['id']) in znama else '—',
          {k: e['tags'][k] for k in KL if k in e['tags']})
print(len(v), 'prvků změněných od', OD, 'z', len(prvky))
