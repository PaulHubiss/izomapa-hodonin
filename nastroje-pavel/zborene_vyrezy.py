"""Výřezy ortofota u kandidátů na zbořené budovy (build/dmpok_zborene.csv z nastroje/dmpok.py) → snimky/zborene-vyrezy.png

    .venv/bin/python nastroje-pavel/zborene_vyrezy.py

Kandidát = budova z OSM, kde DMP OK 2024 nevidí střechu a uvnitř půdorysu je terén. Ortofoto ČÚZK je ze stejného
snímkování jako DMP OK, takže když na něm střecha je, jde o chybu měření (nízká plochá střecha), ne o zbořený dům.
Čísla Z1… odpovídají pořadí v CSV (od největších) a seznamu build/zborene_cisla.json.
"""
import csv, json, math, os, subprocess, sys
import numpy as np, shapely, pyarrow.parquet as pq
from PIL import Image, ImageDraw, ImageFont

R, PX, SLOUPCU = 35.0, 260, 8
os.makedirs('build/zborene', exist_ok=True); os.makedirs('snimky', exist_ok=True)
rows = list(csv.reader(open('build/dmpok_zborene.csv', encoding='utf-8-sig'), delimiter=';'))[1:]
geo = {r['id']: shapely.from_wkb(r['geometry']) for r in pq.read_table('data_all/building.parquet', columns=['id', 'geometry']).to_pylist()}
F = lambda s: ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc', s, index=1)
radku = math.ceil(len(rows) / SLOUPCU)
out = Image.new('RGB', (SLOUPCU * (PX + 8) + 8, radku * (PX + 34) + 8), (24, 24, 24))
cisla = {}
for n, r in enumerate(rows):
    i, lat, lon = r[0], float(r[5]), float(r[6]); kx = 111320 * math.cos(math.radians(lat)); ky = 110574
    la0, lo0, la1, lo1 = lat - R / ky, lon - R / kx, lat + R / ky, lon + R / kx
    f = f'build/zborene/{i}.jpg'
    if not os.path.exists(f):
        subprocess.run(['curl', '-s', '-m', '60', '-o', f, 'https://ags.cuzk.gov.cz/arcgis1/services/ORTOFOTO/MapServer/WMSServer?SERVICE=WMS&VERSION=1.3.0'
                        f'&REQUEST=GetMap&LAYERS=0&STYLES=&CRS=EPSG:4326&BBOX={la0},{lo0},{la1},{lo1}&WIDTH={PX}&HEIGHT={PX}&FORMAT=image/jpeg'], check=True)
    im = Image.open(f).convert('RGB'); d = ImageDraw.Draw(im)
    g = geo.get(i)
    for p in getattr(g, 'geoms', [g]) if g is not None else []:
        d.line([((x - lo0) / (lo1 - lo0) * PX, (la1 - y) / (la1 - la0) * PX) for x, y in p.exterior.coords], (255, 40, 40), 2)
    x0, y0 = (n % SLOUPCU) * (PX + 8) + 8, (n // SLOUPCU) * (PX + 34) + 8
    out.paste(im, (x0, y0 + 26))
    ImageDraw.Draw(out).text((x0, y0), f'Z{n + 1}  {r[1]} m²  {r[4]}', font=F(18), fill=(255, 210, 80))
    cisla[f'Z{n + 1}'] = {'id': i, 'plocha': int(float(r[1])), 'typ': r[4], 'lat': lat, 'lon': lon}
    # půdorys v souřadnicích výřezu (0–PX) pro klikací výběr navrhy/zborene.html
    cisla[f'Z{n + 1}']['obrys'] = [[[round((x - lo0) / (lo1 - lo0) * PX, 1), round((la1 - y) / (la1 - la0) * PX, 1)] for x, y in p.exterior.coords]
                                   for p in (getattr(g, 'geoms', [g]) if g is not None else [])]
    cisla[f'Z{n + 1}']['bbox'] = [la0, lo0, la1, lo1]
out.save('snimky/zborene-vyrezy.png')
json.dump(cisla, open('build/zborene_cisla.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
json.dump([{'z': z, **v} for z, v in cisla.items()], open('navrhy/zborene-kandidati.json', 'w', encoding='utf-8'), ensure_ascii=False)
print('snimky/zborene-vyrezy.png', out.size, len(rows), 'kandidátů')
