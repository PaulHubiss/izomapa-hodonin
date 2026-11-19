"""Co o budově ví postavená scéna: rozměry půdorysu, výška říms a střechy (laser), barvy, styl.

  .venv/bin/python nastroje-pavel/budova.py 48.84903,17.12850 [48.8483,17.1284 …]

Podklad pro dominanty (assets/dominanty.json): `h` = výška zdí nad terénem, `rh` = výška střechy.
Hledá v build/scene.json a build/c*/scene.json budovu, jejíž půdorys bod obsahuje (jinak nejbližší do 25 m).
"""
import glob, json, math, os, sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from shapely.geometry import Point, Polygon  # noqa: E402
from geo import to_local  # noqa: E402

sceny = {}
for f in ['build/scene.json'] + sorted(glob.glob('build/c*/scene.json')):
    sceny[f] = json.load(open(f))['buildings']

for arg in sys.argv[1:]:
    lat, lon = map(float, arg.split(','))
    x, y = to_local(lon, lat)
    pt, best = Point(x, y), None
    for f, bs in sceny.items():
        for b in bs:
            if len(b.get('p', [])) < 3:
                continue
            P = Polygon(b['p'])
            d = 0 if P.contains(pt) else P.distance(pt)
            if d < 25 and (best is None or d < best[0] or (d == best[0] and P.area > best[3].area)):
                best = (d, f, b, P)
    if not best:
        print(arg, '→ žádná budova do 25 m'); continue
    d, f, b, P = best
    o = P.minimum_rotated_rectangle; c = list(o.exterior.coords)
    s1, s2 = math.dist(c[0], c[1]), math.dist(c[1], c[2])
    ax = (c[1][0] - c[0][0], c[1][1] - c[0][1]) if s1 >= s2 else (c[2][0] - c[1][0], c[2][1] - c[1][1])
    azimut = (math.degrees(math.atan2(ax[0], ax[1])) + 360) % 180   # 0 = sever–jih, 90 = východ–západ
    print(f"{arg}  ({f}, id {b['id']}{', ' + b['dn'] if 'dn' in b else ''}{', vzdálenost %.1f m' % d if d else ''})")
    print(f"  půdorys {max(s1, s2):.1f} × {min(s1, s2):.1f} m, plocha {P.area:.0f} m², delší osa azimut {azimut:.0f}°")
    print(f"  zdi h = {b['e'] - b['g']:.1f} m, střecha {b['r']} rh = {b['rh']:.1f} m, hřeben {b['e'] - b['g'] + b['rh']:.1f} m nad terénem")
    print(f"  barva zdí {list(b['wc'])}, střechy {list(b['rc'])}, styl oken {b['s']}, lm {b.get('lm', '-')}")
