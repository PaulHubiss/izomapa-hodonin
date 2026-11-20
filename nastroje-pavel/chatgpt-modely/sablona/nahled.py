"""Obrázek modelu z vystup/<slug>/trojuhelniky.json (vyrobí ho `node zkouska.mjs <slug>`): pohled shora s půdorysem z dat
a čtyři pohledy z nadhledu jako na mapě (JZ = jako mapa, JV, SZ, SV). Jen matplotlib, plochým stínováním, bez textur oken.
    python3 nahled.py <slug>     -> vystup/<slug>/nahled.png
"""
import json, math, os, sys
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.collections import PolyCollection

DIR = os.path.dirname(os.path.abspath(__file__))
if len(sys.argv) < 2:
    sys.exit("použití: python3 nahled.py <slug>   (stavby: " + ", ".join(sorted(os.listdir(os.path.join(DIR, "stavby")))) + ")")
VD = os.path.join(DIR, "vystup", sys.argv[1])
D = json.load(open(os.path.join(VD, "trojuhelniky.json"), encoding="utf-8"))
T = D["t"]
SVETLO = (-0.45, -0.35, 0.82)                       # slunce od jihozápadu, vysoko
l = math.sqrt(sum(q * q for q in SVETLO)); SVETLO = tuple(q / l for q in SVETLO)


def odstin(P, col):
    (ax, ay, az), (bx, by, bz), (cx, cy, cz) = P
    u, v = (bx - ax, by - ay, bz - az), (cx - ax, cy - ay, cz - az)
    n = (u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0])
    ln = math.sqrt(sum(q * q for q in n)) or 1
    k = 0.55 + 0.45 * abs(sum(n[i] * SVETLO[i] for i in range(3)) / ln)
    return tuple(min(1, c * k) for c in col)


def pohled(ax, az_deg, nazev):
    a = math.radians(az_deg)                           # azimut kamery od severu po směru hodin (225 = od jihozápadu)
    vx, vy = -math.sin(a), -math.cos(a)                # směr pohledu (vodorovně)
    rx, ry = vy, -vx                                   # vpravo na obrazovce
    se, ce = 0.5, math.sqrt(0.75)                      # nadhled 30° (dimetrie 2:1 jako mapa)
    pol, barvy, klic = [], [], []
    for _, P, col in T:
        pol.append([(x * rx + y * ry, (x * vx + y * vy) * se + z * ce) for x, y, z in P])
        barvy.append(odstin(P, col))
        klic.append(sum((x * vx + y * vy) * ce - z * se for x, y, z in P) / 3)
    poradi = sorted(range(len(pol)), key=lambda i: -klic[i])   # od nejvzdálenějšího
    b = [barvy[i] for i in poradi]
    ax.add_collection(PolyCollection([pol[i] for i in poradi], facecolors=b, edgecolors=b, linewidths=0.3))   # bez švů
    ax.autoscale(); ax.set_aspect("equal"); ax.axis("off"); ax.set_title(nazev, fontsize=11)


def shora(ax):
    for P in D["okoli"]:
        ax.fill(*zip(*P), color="#dddddd", zorder=0)
    poradi = sorted(T, key=lambda t: sum(p[2] for p in t[1]) / 3)
    ax.add_collection(PolyCollection([[(x, y) for x, y, z in P] for _, P, _ in poradi],
                                     facecolors=[odstin(P, c) for _, P, c in poradi], edgecolors="none", zorder=1))
    for P in D["pudorys"]:
        xs, ys = zip(*(P + [P[0]])); ax.plot(xs, ys, color="#00b3c7", lw=1.2, zorder=2)
    ax.autoscale(); ax.set_aspect("equal"); ax.set_title("shora (tyrkysově půdorys z dat, šedě sousedé; sever nahoře)", fontsize=10)
    ax.tick_params(labelsize=7)


fig, axs = plt.subplots(2, 3, figsize=(18, 11), facecolor="#f4f4f4")
shora(axs[0][0])
for ax, (az, n) in zip([axs[0][1], axs[0][2], axs[1][0], axs[1][1]], [(225, "JZ – jako mapa"), (135, "JV"), (315, "SZ"), (45, "SV")]):
    pohled(ax, az, n)
axs[1][2].axis("off")
axs[1][2].text(0, 0.5, f"{D['slug']}\n{len(T)} trojúhelníků\n\nObrázek je jen orientační: mapa\nkreslí navíc okna ze stylu fasády,\nsníh, stíny a pixelovou paletu.",
               fontsize=12, va="center")
fig.tight_layout()
fig.savefig(os.path.join(VD, "nahled.png"), dpi=80)
print(f"Uloženo vystup/{sys.argv[1]}/nahled.png")
