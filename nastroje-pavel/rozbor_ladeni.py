"""Rozbor záznamu ladicího nástroje zoomu: .venv/bin/python nastroje-pavel/rozbor_ladeni.py [ladeni/zoom-….json]

Bez argumentu vezme nejnovější záznam v ladeni/. Vypíše zuby kolečka, skoky a snímky kolem největšího skoku:
čas, výřez, posun omezením (ve snímku / z události), drift bodu pod myší a jeho změnu za snímek.
"""
import glob, json, math, os, sys

os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
f = sys.argv[1] if len(sys.argv) > 1 else max(glob.glob('ladeni/zoom-*.json'), key=os.path.getmtime)
z = json.load(open(f))
S, K = z['snimky'], z['kolecko']
print(f'{f}: {z["prohlizec"][:60]}…, okno {z["okno"]}, dpr {z["dpr"]}')
print(f'snímků {len(S)}, zubů {len(K)}, skoků {len(z["skoky"])} (práh {z["prah"]} px)')
vetve = [k[6] for k in K]
print(f'zuby: kolečko {vetve.count(0)}, trackpad {vetve.count(1)}; deltaY {sorted(set(k[1] for k in K))[:8]}')
if not z['skoky']: sys.exit()
nej = max(z['skoky'], key=lambda s: s['px'])
i = next(k for k, s in enumerate(S) if s[0] == nej['t'])
print(f'\nnejvětší skok {nej["px"]} px v {nej["t"]} ms; snímky kolem (zuby kolečka označené ⚙):')
print('    t ms   výřez km   omez.snímek  omez.událost   drift x,y      změna driftu  oddáleno')
zuby = {k[0] for k in K}
for k in range(max(0, i - 12), min(len(S), i + 8)):
    s, p = S[k], S[k - 1] if k else None
    zm = math.hypot(s[6] - p[6], s[7] - p[7]) if p and s[6] is not None and p[6] is not None else None
    zub = '⚙' if any(p and p[0] < t <= s[0] for t in zuby) else ' '
    print(f'{zub} {s[0]:6d}  {s[1]:8.4f}  {s[4]:10.1f}  {s[5]:11.1f}   {str(s[6]):>6},{str(s[7]):<6}  {"" if zm is None else f"{zm:8.1f}"}   {s[8]}'
          + ('   ← skok' if k == i else ''))
