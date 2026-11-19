"""Výřez z vyrenderovaných dlaždic kolem GPS bodu – na porovnání před/po u dominant.

  .venv/bin/python nastroje-pavel/vyrez.py <složka dlaždic> 48.8490,17.1285 <výstup.png> [velikost px] [výška m]

Složka dlaždic = např. build/tiles_summer nebo build/test (musí v ní být info.json z render.mjs).
Výška = nadmořská výška bodu vůči nule mapy (mesto.json "href"); v Hodoníně je centrum ≈ 0, výchozí 0.
"""
import json, os, sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from PIL import Image  # noqa: E402
from geo import Image2D, to_local  # noqa: E402

d, bod, out = sys.argv[1], sys.argv[2], sys.argv[3]
S = int(sys.argv[4]) if len(sys.argv) > 4 else 900
h = float(sys.argv[5]) if len(sys.argv) > 5 else 0.0
info = json.load(open(os.path.join(d, 'info.json')))
lat, lon = map(float, bod.split(','))
px, py, _ = Image2D(info).px(*to_local(lon, lat), h)
px, py, T = float(px), float(py), info['tile']
x0, y0 = int(px - S / 2), int(py - S * 0.6)          # trochu víc nad bodem: věže rostou nahoru
img = Image.new('RGBA', (S, S), (27, 31, 46, 255))
for tx in range(x0 // T, (x0 + S) // T + 1):
    for ty in range(y0 // T, (y0 + S) // T + 1):
        f = os.path.join(d, f'{tx}_{ty}.png')
        if os.path.exists(f):
            t = Image.open(f).convert('RGBA')
            img.paste(t, (tx * T - x0, ty * T - y0), t)
os.makedirs(os.path.dirname(out) or '.', exist_ok=True)
img.convert('RGB').save(out)
print(out, f'bod na pixelu {px:.0f},{py:.0f}')
