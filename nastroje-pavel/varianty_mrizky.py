"""Varianty mřížky čtverců vedle sebe → snimky/varianty-mrizky.png

Všechny panely mají stejný výřez ortofota ČÚZK a stejné měřítko, takže jdou porovnat od oka.
Plná čára = čtverce mapy, žlutě hranice obce, červená tečka = náměstí, oranžově plocha zástavby v čtverci.

    .venv/bin/python nastroje-pavel/varianty_mrizky.py
Varianty se upravují v seznamu VARIANTY níže.
"""
import json, math, os, sys, subprocess
import numpy as np
import pyarrow.parquet as pq
import shapely
from PIL import Image, ImageDraw, ImageFont

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import geo

NAMESTI = (48.8483, 17.1284)               # Masarykovo nám. (radnice), lat, lon
OKNO = 5200.0                              # půl strany výřezu v m kolem náměstí
PX = 900                                   # pixelů na panel
os.makedirs('snimky', exist_ok=True)

LAT0, LON0 = NAMESTI
KX, KY = math.cos(math.radians(LAT0)) * 111320.0, 110574.0
loc = lambda lon, lat: ((np.asarray(lon) - LON0) * KX, (np.asarray(lat) - LAT0) * KY)   # metry od náměstí
lonlat = lambda x, y: (x / KX + LON0, y / KY + LAT0)

# --- podklady (společné pro všechny panely) ---
(lo0, la0), (lo1, la1) = lonlat(-OKNO, -OKNO), lonlat(OKNO, OKNO)
orto = 'build/varianty_orto.jpg'
if not os.path.exists(orto):
    url = ('https://ags.cuzk.gov.cz/arcgis1/services/ORTOFOTO/MapServer/WMSServer?SERVICE=WMS&VERSION=1.3.0'
           f'&REQUEST=GetMap&LAYERS=0&STYLES=&CRS=EPSG:4326&BBOX={la0},{lo0},{la1},{lo1}&WIDTH={PX}&HEIGHT={PX}&FORMAT=image/jpeg')
    subprocess.run(['curl', '-s', '-m', '180', '-o', orto, url], check=True)
ORTO_CZ = Image.open(orto).convert('RGB').resize((PX, PX))
# slovenská strana: ortofoto ÚGKK SR (ZBGIS), doplní se tam, kde ČÚZK nemá snímek (bílá)
orto_sk = 'build/varianty_orto_sk.jpg'
if not os.path.exists(orto_sk):
    url = ('https://zbgisws.skgeodesy.sk/zbgis_ortofoto_wms/service.svc/get?SERVICE=WMS&VERSION=1.3.0'
           f'&REQUEST=GetMap&LAYERS=1&STYLES=&CRS=EPSG:4326&BBOX={la0},{lo0},{la1},{lo1}&WIDTH={PX}&HEIGHT={PX}&FORMAT=image/jpeg')
    subprocess.run(['curl', '-s', '-m', '180', '-o', orto_sk, url], check=True)
_cz = np.asarray(ORTO_CZ); _sk = np.asarray(Image.open(orto_sk).convert('RGB').resize((PX, PX)))
ORTO = Image.fromarray(np.where((_cz.min(-1) > 245)[..., None], _sk, _cz))

obec_ll = shapely.geometry.shape(json.load(open('build/hranice_obce.geojson')))   # z nastroje-pavel/mrizka.py
obec = shapely.transform(obec_ll, lambda p: np.column_stack(loc(p[:, 0], p[:, 1])))

g = shapely.from_wkb(pq.read_table('data_all/building.parquet', columns=['geometry']).column('geometry').to_pylist())
g = shapely.transform(g, lambda p: np.column_stack(loc(p[:, 0], p[:, 1])))
B_XY = shapely.get_coordinates(shapely.centroid(g)); B_A = shapely.area(g)


def zastavba(cx, cy, h):
    """podíl plochy čtverce zastavěné budovami (v %)"""
    m = (np.abs(B_XY[:, 0] - cx) <= h) & (np.abs(B_XY[:, 1] - cy) <= h)
    return B_A[m].sum() / (2 * h) ** 2 * 100


def mrizka(h, posun=(0.0, 0.0)):
    """středy čtverců (i, j) → (x, y); posun = kde je náměstí vůči středu čtverce (0, 0)"""
    return lambda i, j: (i * 2 * h - posun[0], j * 2 * h - posun[1])


def ctverec_cz(cx, cy, h):
    """čtverec aspoň z poloviny na českém ortofotu (Slovensko je na snímku šedé)"""
    a = np.asarray(ORTO_CZ)
    p0 = px(cx - h, cy + h); p1 = px(cx + h, cy - h)
    x0, y0, x1, y1 = [int(max(0, min(PX - 1, v))) for v in (*p0, *p1)]
    if x1 <= x0 or y1 <= y0: return False
    s = a[y0:y1, x0:x1].astype(int)
    seda = (np.abs(s[..., 0] - s[..., 1]) < 4) & (np.abs(s[..., 1] - s[..., 2]) < 4) & (s[..., 0] > 200)
    return seda.mean() < 0.5


px = lambda x, y: ((x + OKNO) / (2 * OKNO) * PX, (OKNO - y) / (2 * OKNO) * PX)


def auto(h, prah, posun=(0.0, 0.0)):
    """čtverce se zástavbou aspoň `prah` %, souvislé s (0, 0); díry uvnitř se doplní"""
    st = mrizka(h, posun); n = int(OKNO // (2 * h)) + 1
    ok = {(i, j) for i in range(-n, n + 1) for j in range(-n, n + 1)
          if zastavba(*st(i, j), h) >= prah and ctverec_cz(*st(i, j), h)}
    vys, fronta = set(), [(0, 0)]
    while fronta:
        c = fronta.pop()
        if c in vys or c not in ok: continue
        vys.add(c); fronta += [(c[0] + 1, c[1]), (c[0] - 1, c[1]), (c[0], c[1] + 1), (c[0], c[1] - 1)]
    I = [c[0] for c in vys]; J = [c[1] for c in vys]
    for i in range(min(I), max(I) + 1):          # díry: čtverec mezi dvěma vybranými v řádku i sloupci
        for j in range(min(J), max(J) + 1):
            if any((a, j) in vys for a in range(min(I), i)) and any((a, j) in vys for a in range(i + 1, max(I) + 1)) \
               and any((i, b) in vys for b in range(min(J), j)) and any((i, b) in vys for b in range(j + 1, max(J) + 1)):
                vys.add((i, j))
    return sorted(vys)


if '--tabulka' in sys.argv:                      # % zástavby po čtvercích (s = převážně Slovensko)
    h = float(sys.argv[sys.argv.index('--tabulka') + 1]); st = mrizka(h); n = int(OKNO // (2 * h))
    for j in range(n, -n - 1, -1):
        print(f'j={j:+d} ' + ' '.join(f'{zastavba(*st(i, j), h):5.1f}{" " if ctverec_cz(*st(i, j), h) else "s"}'
                                       for i in range(-n, n + 1)))
    sys.exit()

ctverec3 = [(i, j) for i in (-1, 0, 1) for j in (-1, 0, 1)]
ctverec4 = [(i, j) for i in (-2, -1, 0, 1) for j in (-2, -1, 0, 1)]
dnes = [tuple(c) for c in geo.CHUNKS]

# těžiště zástavby obce (budovy uvnitř hranice, vážené plochou)
_v = shapely.contains_xy(obec, B_XY[:, 0], B_XY[:, 1])
TEZ = (float((B_XY[_v, 0] * B_A[_v]).sum() / B_A[_v].sum()), float((B_XY[_v, 1] * B_A[_v]).sum() / B_A[_v].sum()))
print(f'těžiště zástavby obce: {TEZ[0]:+.0f} m na východ, {TEZ[1]:+.0f} m na sever od náměstí',
      'lat %.5f lon %.5f' % tuple(reversed([float(v) for v in lonlat(*TEZ)])))
T = (-TEZ[0], -TEZ[1])                           # posun mřížky: střed čtverce (0, 0) na těžišti
T4 = lambda h: (T[0] - h, T[1] - h)              # sudý počet: těžiště v rohu mezi čtyřmi prostředními

VARIANTY = [
    ('Dnes', 'čtverec 2,3 km · střed 880 m severně od náměstí', geo.HALF, dnes,
     (-loc(*geo.to_lonlat(0, 0))[0], -loc(*geo.to_lonlat(0, 0))[1])),
    ('B', 'čtverec 2 km · 3 × 3 · střed v těžišti zástavby', 1000.0, ctverec3, T),
    ('B1', 'čtverec 1,8 km · 3 × 3 · střed v těžišti zástavby', 900.0, ctverec3, T),
    ('B2', 'čtverec 1,6 km · 3 × 3 · střed v těžišti zástavby', 800.0, ctverec3, T),
]
_ZO = B_A[_v].sum()                              # zastavěná plocha obce (budovy uvnitř hranice)

F = lambda s: ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc', s, index=1)
panely = []
for kod, popis, h, ctverce, posun in VARIANTY:
    if ctverce is None: ctverce = auto(h, 1.0, posun)
    st = mrizka(h, posun)
    im = Image.blend(ORTO, Image.new('RGB', ORTO.size, (15, 15, 15)), 0.55)
    # čtverce mapy rozsvítit (originální ortofoto), okolí nechat ztlumené
    maska = Image.new('L', im.size, 0); dm = ImageDraw.Draw(maska)
    for i, j in ctverce:
        cx, cy = st(i, j); dm.rectangle([px(cx - h, cy + h), px(cx + h, cy - h)], fill=255)
    im.paste(ORTO, (0, 0), maska)
    d = ImageDraw.Draw(im, 'RGBA')
    for gg in getattr(obec, 'geoms', [obec]):
        d.line([px(x, y) for x, y in gg.exterior.coords], (255, 200, 40, 230), 3)
    zast = 0.0
    for i, j in ctverce:
        cx, cy = st(i, j); a, b = px(cx - h, cy + h), px(cx + h, cy - h)
        d.rectangle([a, b], outline=(255, 255, 255, 255), width=2)
        z = zastavba(cx, cy, h); zast += z * (2 * h) ** 2 / 100
        fs = max(14, int((b[0] - a[0]) * 0.17))
        d.text(((a[0] + b[0]) / 2, (a[1] + b[1]) / 2), f'{i}, {j}', font=F(fs), anchor='mm', fill=(255, 255, 255, 230),
               stroke_width=3, stroke_fill=(0, 0, 0, 200))
    x, y = px(0, 0); d.ellipse([x - 6, y - 6, x + 6, y + 6], fill=(255, 60, 60), outline=(0, 0, 0), width=2)
    x, y = px(*TEZ)                              # těžiště zástavby = modrý křížek (čarami, ne znakem)
    for w, c in ((6, (0, 0, 0)), (3, (80, 170, 255))):
        d.line([(x - 9, y - 9), (x + 9, y + 9)], c, w); d.line([(x - 9, y + 9), (x + 9, y - 9)], c, w)
    plocha = len(ctverce) * (2 * h / 1000) ** 2
    vse = B_A[(np.abs(B_XY[:, 0]) <= OKNO) & (np.abs(B_XY[:, 1]) <= OKNO)].sum()
    # hlavička panelu
    out = Image.new('RGB', (PX, PX + 110), (24, 24, 24)); out.paste(im, (0, 110))
    do = ImageDraw.Draw(out)
    do.text((20, 14), f'{kod}', font=F(44), fill=(255, 255, 255))
    xt = 20 + do.textlength(kod, font=F(44)) + 20
    do.text((xt, 18), popis, font=F(24), fill=(235, 235, 235))
    uvnitr = np.zeros(len(B_A), bool)
    for i, j in ctverce:
        cx, cy = st(i, j); uvnitr |= (np.abs(B_XY[:, 0] - cx) <= h) & (np.abs(B_XY[:, 1] - cy) <= h)
    kryti = B_A[uvnitr & _v].sum() / _ZO * 100
    strana = (max(i for i, _ in ctverce) - min(i for i, _ in ctverce) + 1) * 2 * h / 1000
    do.text((xt, 56), f'{strana:.1f} × {strana:.1f} km · {plocha:.1f} km² · v mapě {kryti:.0f} % zástavby obce',
            font=F(22), fill=(255, 210, 80))
    panely.append(out)
    print(kod, len(ctverce), f'{plocha:.1f} km²', ctverce)

W = 2 * PX + 20
leg = ['Rozsvícené = plocha mapy, ztlumené = co v mapě nebude. Žlutě hranice obce. Červená tečka = Masarykovo náměstí,',
       'modrý křížek = těžiště zástavby obce. Stejný výřez (10,4 × 10,4 km) a měřítko ve všech panelech.',
       'Za Moravou vpravo dole je Slovensko (ortofoto ÚGKK SR, ZBGIS); v mapě se kreslí z OSM (pole, les, budovy).',
       'Sever je tady nahoře, v izometrické mapě vpravo nahoře.']
sit = Image.new('RGB', (W, 2 * (PX + 110) + 20 + 30 + 36 * len(leg)), (24, 24, 24))
for k, p in enumerate(panely):
    sit.paste(p, ((k % 2) * (PX + 20), (k // 2) * (PX + 130)))
ds = ImageDraw.Draw(sit)
for k, s in enumerate(leg):
    ds.text((20, 2 * (PX + 110) + 40 + 36 * k), s, font=F(22), fill=(230, 230, 230))
sit.save('snimky/varianty-mrizky.png')
print('snimky/varianty-mrizky.png', sit.size)
