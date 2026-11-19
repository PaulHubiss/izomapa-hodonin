"""Mřížka čtverců mapy přes ortofoto ČÚZK → snimky/mrizka-ctvercu.png

Ukáže, které čtverce [i, j] z mesto.json v mapě jsou (plná čára), které by šly přidat
(čárkovaně, o jeden pás kolem dokola), hranici obce a kolik % území obce každý čtverec kryje.
i roste na východ, j na sever, (0, 0) = střed města.

    .venv/bin/python nastroje-pavel/mrizka.py            # pás kandidátů 1 čtverec
    .venv/bin/python nastroje-pavel/mrizka.py 2          # pás 2 čtverce
"""
import json, math, os, sys, subprocess, urllib.parse, urllib.request
import shapely, shapely.geometry
from PIL import Image, ImageDraw, ImageFont

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import geo

PAS = int(sys.argv[1]) if len(sys.argv) > 1 else 1
PX = 300                                   # pixelů na čtverec
S, H = 2 * geo.HALF, geo.HALF
OUT = 'snimky/mrizka-ctvercu.png'
os.makedirs('snimky', exist_ok=True)

mapa = set(geo.CHUNKS)
I = [c[0] for c in mapa]; J = [c[1] for c in mapa]
i0, i1, j0, j1 = min(I) - PAS, max(I) + PAS, min(J) - PAS, max(J) + PAS
cols, rows = i1 - i0 + 1, j1 - j0 + 1
W, Hh = cols * PX, rows * PX
x0, y0, x1, y1 = i0 * S - H, j0 * S - H, i1 * S + H, j1 * S + H
(lo0, lo1), (la0, la1) = geo.to_lonlat([x0, x1], [y0, y1])

# 1) ortofoto (souřadnice v mapě jsou lineární ve stupních → stačí EPSG:4326)
orto = f'build/mrizka_orto_{i0}_{j0}_{i1}_{j1}.jpg'
if not os.path.exists(orto):
    url = ('https://ags.cuzk.gov.cz/arcgis1/services/ORTOFOTO/MapServer/WMSServer?SERVICE=WMS&VERSION=1.3.0'
           f'&REQUEST=GetMap&LAYERS=0&STYLES=&CRS=EPSG:4326&BBOX={la0},{lo0},{la1},{lo1}&WIDTH={W}&HEIGHT={Hh}&FORMAT=image/jpeg')
    subprocess.run(['curl', '-s', '-m', '180', '-o', orto, url], check=True)
img = Image.open(orto).convert('RGB').resize((W, Hh))
img = Image.blend(img, Image.new('RGB', img.size, (20, 20, 20)), 0.35)   # ztlumit, ať čte popisky

# 2) hranice obce z OpenStreetMap (Nominatim), uložená do build/
hr = 'build/hranice_obce.geojson'
if not os.path.exists(hr):
    q = urllib.parse.urlencode({'q': f"{geo.MESTO['nazev']}, Česko", 'format': 'json', 'polygon_geojson': 1,
                                'limit': 8, 'countrycodes': 'cz'})
    req = urllib.request.Request('https://nominatim.openstreetmap.org/search?' + q,
                                 headers={'User-Agent': 'izomapa/1.0 (https://github.com/adamklatovsky/izomapa)'})
    res = [r for r in json.loads(urllib.request.urlopen(req, timeout=60).read())
           if r.get('geojson', {}).get('type') in ('Polygon', 'MultiPolygon')]
    res.sort(key=lambda r: (r.get('class') != 'boundary', -float(r.get('importance') or 0)))
    json.dump(res[0]['geojson'], open(hr, 'w'))
obec_ll = shapely.geometry.shape(json.load(open(hr)))
obec = shapely.transform(obec_ll, lambda p: __import__('numpy').column_stack(geo.to_local(p[:, 0], p[:, 1])))

px = lambda x, y: ((x - x0) / (x1 - x0) * W, (y1 - y) / (y1 - y0) * Hh)
d = ImageDraw.Draw(img, 'RGBA')
F = lambda s: ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc', s, index=1)   # Helvetica Bold
f_big, f_small, f_leg = F(40), F(22), F(26)


def dash(a, b, col, w, on=14, off=10):
    (ax, ay), (bx, by) = a, b
    L = math.hypot(bx - ax, by - ay); t = 0
    while t < L:
        e = min(t + on, L)
        d.line([(ax + (bx - ax) * t / L, ay + (by - ay) * t / L), (ax + (bx - ax) * e / L, ay + (by - ay) * e / L)], col, w)
        t += on + off


# hranice obce
for g in getattr(obec, 'geoms', [obec]):
    d.line([px(x, y) for x, y in g.exterior.coords], (255, 200, 40, 255), 5)

# čtverce: nejdřív kandidáti, pak mapa (ať je její čára navrchu)
for kolo in ('kandidat', 'mapa'):
    for i in range(i0, i1 + 1):
        for j in range(j0, j1 + 1):
            v = (i, j) in mapa
            if (kolo == 'mapa') != v: continue
            a, b = px(i * S - H, j * S + H), px(i * S + H, j * S - H)
            kryti = obec.intersection(shapely.box(i * S - H, j * S - H, i * S + H, j * S + H)).area / obec.area * 100
            if v:
                d.rectangle([a, b], fill=(255, 255, 255, 40), outline=(255, 255, 255, 255), width=4)
            else:
                rohy = [a, (b[0], a[1]), b, (a[0], b[1]), a]
                for k in range(4): dash(rohy[k], rohy[k + 1], (255, 255, 255, 150), 2)
            cx, cy = (a[0] + b[0]) / 2, (a[1] + b[1]) / 2
            t = f'{i}, {j}'
            d.text((cx, cy - 12), t, font=f_big, anchor='mm', fill=(255, 255, 255, 255 if v else 170),
                   stroke_width=4, stroke_fill=(0, 0, 0, 200))
            if kryti >= 0.05:
                d.text((cx, cy + 30), f'{kryti:.1f} % obce', font=f_small, anchor='mm',
                       fill=(255, 210, 80, 255 if v else 190), stroke_width=3, stroke_fill=(0, 0, 0, 200))

# střed města (0, 0) a sever
cx, cy = px(0, 0); d.ellipse([cx - 7, cy - 7, cx + 7, cy + 7], fill=(255, 60, 60, 255), outline=(0, 0, 0, 255), width=2)
sx, sy = W - 50, 40
d.polygon([(sx, sy), (sx - 14, sy + 34), (sx + 14, sy + 34)], fill=(255, 255, 255, 255))   # šipka jako tvar
d.text((sx, sy + 56), 'sever', font=f_small, anchor='mm', fill=(255, 255, 255, 255), stroke_width=3, stroke_fill=(0, 0, 0, 200))

# legenda pod obrázkem
v_mapa = sum(obec.intersection(shapely.box(i * S - H, j * S - H, i * S + H, j * S + H)).area for i, j in mapa) / obec.area * 100
leg = [f'Plná čára = v mapě ({len(mapa)} čtverců, {v_mapa:.0f} % území obce).  Čárkovaně = dá se přidat.',
       'Žlutá čára = hranice obce (OSM).  Číslo „i, j“: i roste na východ, j na sever.  Čtverec = 2,3 × 2,3 km.',
       'V mapě se díváš od jihozápadu, takže sever je tam vpravo nahoře.']
out = Image.new('RGB', (W, Hh + 30 + 40 * len(leg)), (24, 24, 24))
out.paste(img, (0, 0))
dl = ImageDraw.Draw(out)
for k, s in enumerate(leg):
    dl.text((20, Hh + 20 + 40 * k), s, font=f_leg, fill=(235, 235, 235))
out.save(OUT)
print(OUT, out.size)
