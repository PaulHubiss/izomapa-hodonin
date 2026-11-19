"""Výběhy zoo z OpenStreetMap -> assets/zoo.json (zvířata v zoo, Pavel 2026-11-17)

    .venv/bin/python nastroje-pavel/zoo.py

V OSM má zoo výběhy jen jako body (attraction=animal) s českým názvem („Zebry“, „Lvi“), bez obrysů. Skript je stáhne
uvnitř každé zoo v mapě (tourism=zoo) a podle názvu přiřadí druh, který umí prohlížeč nakreslit (ZV_DRUHY ve
web/app.html), a počet kusů. Pavilony (zvířata uvnitř) se vynechají. Výběh kolem bodu pak dopočítá chodci.py
(kruh bez budov a cestiček). Ruční úpravy: zapsat do assets/zoo.json (druh, pocet, r = poloměr výběhu v m) –
při dalším běhu se zachovají, dokud v OSM zůstane bod se stejným id.
"""
import json, os, re, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'nastroje'))
import geo
from overpass import dotaz

# název výběhu (začátek, malými písmeny) -> (druh, počet kusů, poloměr výběhu v m)
DRUHY = [
    ('tygr', ('tygr', 1, 14)), ('lv', ('lev', 2, 14)), ('jagu',('jaguar', 1, 10)), ('nyala', ('antilopa', 3, 16)),
    ('adax', ('adax', 3, 16)), ('oryx', ('oryx', 3, 16)), ('zebr', ('zebra', 3, 18)), ('velbloud', ('velbloud', 2, 16)),
    ('lam', ('lama', 3, 12)), ('osel', ('osel', 1, 10)), ('koz', ('koza', 4, 10)), ('ovce', ('ovce', 4, 10)),
    ('prasat', ('prase', 3, 9)), ('klokan', ('klokan', 3, 12)), ('mar', ('mara', 3, 9)), ('surikat', ('surikata', 5, 6)),
    ('pes hřivnatý', ('pes', 1, 10)), ('jeřáb', ('jerab', 2, 9)), ('nandu', ('nandu', 2, 12)), ('plameň', ('plamenak', 7, 8)),
    ('veverk', ('veverka', 2, 5)),
]
UVNITR = re.compile(r'pavilon|akvári|expozice|ptáci jv', re.I)     # zvířata v pavilonu: venku nejsou vidět

lon0, lon1, lat0, lat1 = geo.bbox_lonlat(0.0)
bb = f'{lat0:.5f},{lon0:.5f},{lat1:.5f},{lon1:.5f}'
el = dotaz(f'[out:json][timeout:90];nwr["tourism"="zoo"]({bb})->.z;.z map_to_area->.a;'
           'node(area.a)["attraction"="animal"];out;')
puvodni = {}
if os.path.exists('assets/zoo.json'):
    puvodni = {v['id']: v for v in json.load(open('assets/zoo.json'))}
out, vynech = [], []
for e in el:
    n = e.get('tags', {}).get('name', '').strip()
    if not n or UVNITR.search(n): vynech.append(n or f'node/{e["id"]}'); continue
    d = next((v for k, v in DRUHY if n.lower().startswith(k)), None)
    if not d: vynech.append(n + ' (neznámý druh)'); continue
    z = {'id': e['id'], 'nazev': n, 'lat': round(e['lat'], 6), 'lon': round(e['lon'], 6), 'druh': d[0], 'pocet': d[1], 'r': d[2]}
    if e['id'] in puvodni: z.update({k: puvodni[e['id']][k] for k in ('druh', 'pocet', 'r') if k in puvodni[e['id']]})
    out.append(z)
out.sort(key=lambda z: z['id'])
with open('assets/zoo.json', 'w') as f:
    f.write('[\n' + ',\n'.join(json.dumps(z, ensure_ascii=False) for z in out) + '\n]\n')
print(f'výběhů {len(out)}, zvířat {sum(z["pocet"] for z in out)}; vynechány: {", ".join(vynech) or "nic"}')
