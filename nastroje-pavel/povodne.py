"""Záplavová území (DIBAVOD, VÚV T. G. M.) ve výřezu mapy → site/povodne.json pro vrstvu „Povodňová území“ (F4)

    .venv/bin/python nastroje-pavel/povodne.py

Zdroj: https://www.dibavod.cz (Objekty DIBAVOD, skupina D): D01 pětiletá, D02 dvacetiletá, D03 stoletá voda. Data VÚV
poskytuje bezúplatně (stránka „využití dat DIBAVOD“), výslovnou licenci neuvádí; v mapě uvádíme zdroj (Pavel 2026-11-26:
„pojďme postupně na vše a uvidíme dle dostupnosti dat“). Stažené zipy leží v build/povodne/ (mimo git, ~320 MB):
    curl -L -o build/povodne/D01.zip https://www.dibavod.cz/data/download/dib_D01_ZaplUzemi5Vody.zip   (D02 …20Vody, D03 …100Vody)
Výstup: {"q5": [polygon, …], "q20": […], "q100": […], "zdroj": …}, polygon = [vnější kruh, díry…], kruh = [x, y, x, y, …]
v metrech mapy (geo.to_local), oříznuto na mapu a zjednodušeno na 1 m. Prohlížeč (web/js/83-povodne.js) je kreslí po terénu.
Výsledek jde do assets/povodne.json (v gitu) a odtud do site/; bez stažených dat se jen zkopíruje ten z gitu, takže to jde
pouštět na každém Macu (novy_stroj.sh, doplnky.sh). Přepočítat jen se staženými zipy a pyshp (.venv/bin/pip install pyshp).
"""
import glob, io, json, os, shutil, sys, zipfile
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT); sys.path.insert(0, ROOT)
import numpy as np, shapely
from pyproj import CRS, Transformer
import geo

OUT, GIT = 'site/povodne.json', 'assets/povodne.json'   # výsledek v gitu (12 kB), ať ho má i Mac bez stažených dat (M2)
UROVNE = {'q5': 'D01', 'q20': 'D02', 'q100': 'D03'}
xs = [geo.chunk_center(c)[0] for c in geo.CHUNKS]; ys = [geo.chunk_center(c)[1] for c in geo.CHUNKS]
RAM = shapely.box(min(xs) - geo.HALF, min(ys) - geo.HALF, max(xs) + geo.HALF, max(ys) + geo.HALF)
lon0, lat0 = geo.to_lonlat(RAM.bounds[0] - 500, RAM.bounds[1] - 500); lon1, lat1 = geo.to_lonlat(RAM.bounds[2] + 500, RAM.bounds[3] + 500)


def nacti(zipcesta):
    import shapefile                                              # pyshp jen při přepočtu ze stažených dat
    z = zipfile.ZipFile(zipcesta)
    shp = next(n for n in z.namelist() if n.lower().endswith('.shp'))
    zaklad = shp[:-4]
    jmena = {n.lower(): n for n in z.namelist()}
    dat = lambda pripona: io.BytesIO(z.read(jmena[(zaklad + pripona).lower()]))
    prj = z.read(jmena[(zaklad + '.prj').lower()]).decode('latin-1') if (zaklad + '.prj').lower() in jmena else None
    crs = CRS.from_wkt(prj) if prj else CRS.from_epsg(5514)
    tr = Transformer.from_crs(crs, 'EPSG:4326', always_xy=True)
    trz = Transformer.from_crs('EPSG:4326', crs, always_xy=True)
    (bx0, by0), (bx1, by1) = trz.transform(lon0, lat0), trz.transform(lon1, lat1)
    hled = shapely.box(min(bx0, bx1), min(by0, by1), max(bx0, bx1), max(by0, by1))
    r = shapefile.Reader(shp=dat('.shp'), shx=dat('.shx'), dbf=dat('.dbf'))
    out = []
    for sh in r.iterShapes():
        if not sh.points or not shapely.box(*sh.bbox).intersects(hled): continue
        g = shapely.geometry.shape(sh.__geo_interface__)
        if not g.is_valid: g = g.buffer(0)
        g = g.intersection(hled)
        if g.is_empty: continue
        def mapa(xy):
            lo, la = tr.transform(xy[:, 0], xy[:, 1])
            return np.column_stack(geo.to_local(np.asarray(lo), np.asarray(la)))
        out.append(shapely.transform(g, mapa))
    return out


def ploch(g):
    for p in getattr(g, 'geoms', [g]):
        if p.geom_type == 'Polygon' and p.area >= 4: yield p
        elif hasattr(p, 'geoms'): yield from ploch(p)


data, chybi = {}, []
for k, kod in UROVNE.items():
    f = glob.glob(f'build/povodne/{kod}*.zip')
    if not f: chybi.append(kod); continue
    g = shapely.unary_union(nacti(f[0])).intersection(RAM).simplify(1.0)
    kruh = lambda r: [round(float(v), 1) for xy in list(r.coords)[:-1] for v in xy]
    data[k] = [[kruh(p.exterior)] + [kruh(i) for i in p.interiors if shapely.Polygon(i).area >= 4] for p in ploch(g)]
    print(f'{k}: {len(data[k])} ploch, {g.area / 1e6:.2f} km² v mapě')
if data:
    data['zdroj'] = 'VÚV T. G. M., DIBAVOD (záplavová území)'
    json.dump(data, open(GIT, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    print(f'{GIT}: {os.path.getsize(GIT) // 1024} kB' + (f' (chybí {", ".join(chybi)})' if chybi else ''))
elif os.path.exists(GIT):
    print(f'stažená data v build/povodne/ nejsou, beru {GIT} z gitu')
if os.path.exists(GIT):
    shutil.copyfile(GIT, OUT); print(f'→ {OUT}')
else:
    if os.path.exists(OUT): os.remove(OUT)
    print('žádná data (build/povodne/ ani assets/povodne.json), vrstva Povodně nebude')
