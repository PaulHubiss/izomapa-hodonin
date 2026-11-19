"""Doplní do mapy budovy z katastru, které v OSM chybějí (výstup porovnej_pudorysy.py) → assets/upresneni.json, custom_bld.

    .venv/bin/python nastroje-pavel/dopln_budovy.py

- Bere položky od 50 m² ze skupin „chybí“ a „jiný tvar“ (build/pudorysy/rozdily.json), bez kruhových nádrží
  a bez ručně vyřazených (VYRADIT – kódy objektů RÚIAN, ověřeno na výřezech ortofota 2026-11-13).
- Z obrysu z katastru přidá jen část, kterou nepokrývá žádná budova z OSM → nové budovy se nepřekrývají se starými.
- Třída a střecha podle způsobu využití, výška podle počtu podlaží, barva střechy z ortofota uvnitř obrysu
  (když je tam zeleň – novostavba po snímkování – barvu nechá na mapě).
- Předchozí položky s id „ruian_…“ nahradí, ostatní ruční custom_bld nechá.
Po spuštění: prep.py + render dotčených čtverců (./postav.sh render).
"""
import glob, json, os, sys
import numpy as np, pyarrow.parquet as pq, shapely
from PIL import Image, ImageDraw

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import geo

VYRADIT = {
    38900157: 'C1 obrys kolem celého areálu, budovy uvnitř už v mapě jsou',
    44758821: 'C3 otevřená nádrž čistírny',
    38739968: 'C5 pás vedle stavby, budova na snímku není',
    44810971: 'C6 otevřená nádrž čistírny',
    44810989: 'C7 otevřená nádrž čistírny',
    48675857: 'C15 skleník na snímku není (tráva)',
    38898471: 'C32 na snímku jen tráva',
    44792514: 'C34 nejasné',
    38901544: 'C35 nejasné',
}
TRIDA = {'rodinný dům': 'house', 'objekt k bydlení': 'residential', 'bytový dům': 'apartments', 'garáž': 'garage',
         'výroba a sklad': 'industrial', 'průmyslový objekt': 'industrial', 'zemědělská stavba': 'farm_auxiliary',
         'obchod': 'retail', 'administrativa': 'office', 'zdravotnictví / sociální': 'civic', 'občanské vybavení': 'civic',
         'víceúčelová stavba': 'commercial', 'ubytovací zařízení': 'hotel', 'doprava': 'transportation'}
SIKMA = {'house', 'residential'}

d = json.load(open('build/pudorysy/rozdily.json', encoding='utf-8'))
pol = [z for k in ('chybi', 'jiny_tvar') for z in d[k] if z['plocha'] >= 50 and not z.get('kruh') and z['kod'] not in VYRADIT]

# budovy OSM (jako v mapě) pro odečtení
osm = []
for r in pq.read_table('data_all/building.parquet', columns=['geometry', 'sources']).to_pylist():
    if not any(s.get('dataset') == 'OpenStreetMap' for s in (r['sources'] or [])): continue
    g = shapely.from_wkb(r['geometry'])
    if g.geom_type in ('Polygon', 'MultiPolygon'):
        osm.append(shapely.make_valid(shapely.transform(g, lambda c: np.column_stack(geo.to_local(c[:, 0], c[:, 1])))))
STROM = shapely.STRtree(osm)


def barva_strechy(z, cast):
    """medián barvy ortofota uvnitř obrysu (výřez z porovnej_pudorysy.py), None u zeleně nebo bez výřezu"""
    f = glob.glob(f'build/pudorysy/vyrezy/{z["kod"]}_*.jpg')
    if not f: return None
    pts = np.array(z['poly']); cx, cy = pts.mean(0); r = max(40.0, (pts.max(0) - pts.min(0)).max() * 0.8)
    im = Image.open(f[0]).convert('RGB'); n = im.size[0]
    m = Image.new('L', im.size, 0)
    vnitrek = cast.buffer(-0.8) if not cast.buffer(-0.8).is_empty else cast
    for g in getattr(vnitrek, 'geoms', [vnitrek]):
        ImageDraw.Draw(m).polygon([((x - cx + r) / (2 * r) * n, (cy + r - y) / (2 * r) * n) for x, y in g.exterior.coords], fill=255)
    px = np.asarray(im)[np.asarray(m) > 0]
    if len(px) < 20: return None
    c = np.median(px, 0).astype(int).tolist()
    if c[1] > c[0] + 6 and c[1] > c[2] + 6: return None          # zeleň: stavba je novější než snímek
    return c


nove = []
for z in pol:
    R = shapely.make_valid(shapely.Polygon(z['poly']))
    okoli = [osm[j] for j in STROM.query(R)]
    zbytek = R.difference(shapely.union_all([g.buffer(0.3) for g in okoli])) if okoli else R
    casti = [g for g in getattr(zbytek, 'geoms', [zbytek]) if g.geom_type == 'Polygon' and g.area >= 20 and not g.buffer(-1.2).is_empty]
    trida = TRIDA.get(z['vyuziti'], 'service')
    for n, g in enumerate(casti):
        g = g.simplify(0.3)
        pod = z.get('podlazi') or 1
        if trida in SIKMA: h = pod * 3.0 + 3.0
        elif trida == 'garage': h = 2.8
        elif trida == 'industrial' and g.area >= 400 and not z.get('podlazi'): h = 8.0
        else: h = pod * 3.3 + 0.5
        lonlat = [geo.to_lonlat(x, y) for x, y in g.exterior.coords]
        q = {'id': f"ruian_{z['kod']}_{n}", 'poly': [[round(float(la), 7), round(float(lo), 7)] for lo, la in lonlat],
             'h': round(h, 1), 'cls': trida, 'r': 'gabled' if trida in SIKMA else 'flat',
             '_zdroj': f"RÚIAN {z['kod']} · {z.get('oznaceni', '')} · {z['vyuziti']} · {z['adresa']} · {z['dokonceno'] or ''}".strip(' ·')}
        rc = barva_strechy(z, g)
        if rc: q['rc'] = rc
        nove.append(q)

U = json.load(open('assets/upresneni.json', encoding='utf-8'))
U['custom_bld'] = [q for q in U.get('custom_bld', []) if not str(q.get('id', '')).startswith('ruian_')] + nove
# zápis: každá doplněná budova na jednom řádku, ať jde soubor číst
t = json.dumps({k: v for k, v in U.items() if k != 'custom_bld'}, ensure_ascii=False, indent=1)
radky = ',\n'.join('  ' + json.dumps(q, ensure_ascii=False) for q in U['custom_bld'])
t = t[:t.rindex('}')].rstrip() + ',\n "custom_bld": [\n' + radky + '\n ]\n}\n'
json.loads(t)
open('assets/upresneni.json', 'w', encoding='utf-8').write(t)
print('položek', len(pol), '→ doplněných budov', len(nove), '· s barvou střechy z ortofota', sum('rc' in q for q in nove))
