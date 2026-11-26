"""Kde je vánoční jarmark v mapě opravdu vidět → site/jarmark_klik.json (klikací plochy stánků, stromu a pódia)

    .venv/bin/python nastroje-pavel/jarmark_klik.py

Proč (Pavel 2026-11-26: „u většiny stánků brání vyšší budovy kolem kliknutí“): obrys budovy pro klikání je konvexní obal
(overlay.py), u hlubokých domů na náměstí přesahuje přes stánky, které jsou v obrázku vidět. Měření: budova brala klik
u 46 % viditelné plochy jarmarku. Vrstva výzdoby (render.html mode=xmas) zakrývání už vyřešila: neprůhledné pixely jsou
přesně to, co z výzdoby (a z terénu pod ní) je vidět. Z nich se tu složí mnohoúhelníky v souřadnicích obrysů (čtverec
(0, 0), 0,2 m/px) a prohlížeč (jarmarkAt v web/js/84-kresleni-vozidel.js) v nich dá přednost jarmarku před budovou.

Pouštět po renderu výzdoby (vanoce.sh / postav.sh); novy_stroj.sh a doplnky.sh to dělají samy. Bez vrstvy výzdoby
soubor smaže a prohlížeč se vrátí k obrysům stánků.
"""
import glob, json, os, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT); sys.path.insert(0, ROOT)
import numpy as np, shapely
from PIL import Image
from geo import MPP_OVERLAY

OUT = 'site/jarmark_klik.json'
base = json.load(open('build/tiles_autumn/info.json'))          # souřadnice obrysů = čtverec (0, 0) po MPP_OVERLAY (jako overlay.py)
boxy = []
for D in sorted(glob.glob('build/tiles_xmas_winter') + glob.glob('build/c*/tiles_xmas_winter')):
    if not os.path.exists(f'{D}/info.json'): continue
    info = json.load(open(f'{D}/info.json'))
    k = round(MPP_OVERLAY / info['mpp']); T = info['tile']
    dx, dy = (info['x0'] - base['x0']) / MPP_OVERLAY, (base['y1'] - info['y1']) / MPP_OVERLAY
    for f in glob.glob(f'{D}/*_*.png'):
        c, r = map(int, os.path.basename(f)[:-4].split('_'))
        a = np.array(Image.open(f).convert('RGBA'))[:, :, 3] > 0
        if not a.any(): continue
        h, w = a.shape[0] // k * k, a.shape[1] // k * k
        m = a[:h, :w].reshape(h // k, k, w // k, k).any(axis=(1, 3))     # pixel obrysů = aspoň kus výzdoby v něm
        ox, oy = c * T / k + dx, r * T / k + dy
        for y in range(m.shape[0]):                                       # běhy v řádcích → obdélníky
            row = np.flatnonzero(np.diff(np.r_[0, m[y].astype(np.int8), 0]))
            for x0, x1 in zip(row[::2], row[1::2]):
                boxy.append(shapely.box(ox + x0, oy + y, ox + x1, oy + y + 1))
if not boxy:
    if os.path.exists(OUT): os.remove(OUT)
    print('vrstva výzdoby nenalezena, bez klikacích ploch jarmarku'); sys.exit(0)
g = shapely.unary_union(boxy).buffer(0.5).buffer(-0.5).simplify(0.6)    # zacelit štěrbiny mezi pixely, uhladit schody
polys = [p for p in getattr(g, 'geoms', [g]) if p.area >= 4]
kolo = lambda ring: [[round(x, 1), round(y, 1)] for x, y in list(ring.coords)[:-1]]
data = [{'o': kolo(p.exterior), 'd': [kolo(i) for i in p.interiors if shapely.Polygon(i).area >= 4]} for p in polys]
json.dump(data, open(OUT, 'w'), separators=(',', ':'))
print(f'{OUT}: {len(data)} ploch, {sum(p.area for p in polys):.0f} px² ({len(boxy)} běhů), {os.path.getsize(OUT) // 1024} kB')
