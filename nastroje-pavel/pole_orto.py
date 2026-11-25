"""Pole z nastroje/pole_cesty.py proti ortofotu: .venv/bin/python nastroje-pavel/pole_orto.py → snimky/pole-orto.png
Vlevo ortofoto s hranicemi polí a průměrným jasem (podle něj nástroj vybírá plodinu), vpravo vybraná plodina.
Potřebuje build/orto_cele.jpg (nastroje/les.py)."""
import json, os, sys
sys.path.insert(0, os.getcwd())
import numpy as np, geo
from PIL import Image, ImageDraw, ImageFont

Image.MAX_IMAGE_PIXELS = None
o = Image.open('build/orto_cele.jpg').convert('RGB')
X0, Y1, M = json.load(open('build/les_maska.json'))['x0y1m']
Z = json.load(open('assets/zabaged.json'))
BARVY = {'wheat': (222, 180, 90), 'rape': (150, 140, 75), 'soil': (120, 125, 60), 'maize': (60, 120, 50), None: (200, 60, 200)}
pismo = ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc', 26)
leva, prava = o.copy(), Image.eval(o, lambda v: v // 2 + 60)
dl, dp = ImageDraw.Draw(leva), ImageDraw.Draw(prava)
jas = np.asarray(o).astype(np.float32).mean(-1)
for r, pl in zip(Z['orna_dil'], Z['orna_plodina']):
    body = [[((x - X0) / M, (Y1 - y) / M) for x, y in [geo.to_local(lo, la) for la, lo in kruh]] for kruh in r]
    m = Image.new('L', o.size); d = ImageDraw.Draw(m); d.polygon(body[0], fill=1)
    for dira in body[1:]: d.polygon(dira, fill=0)
    ma = np.asarray(m) > 0
    if ma.sum() < 50: continue
    dp.polygon(body[0], fill=BARVY[pl])
    for kruh in body: dl.line(kruh + kruh[:1], fill=(255, 60, 60), width=5); dp.line(kruh + kruh[:1], fill=(255, 255, 255), width=4)
    ys, xs = np.nonzero(ma); t = f'{jas[ma].mean():.0f}'
    dl.text((xs.mean(), ys.mean()), t, fill=(255, 255, 0), font=pismo, anchor='mm', stroke_width=3, stroke_fill=(0, 0, 0))
    dp.text((xs.mean(), ys.mean()), f'{pl or "los"} {ma.sum() * M * M / 1e4:.0f} ha', fill=(255, 255, 255), font=pismo, anchor='mm', stroke_width=3, stroke_fill=(0, 0, 0))
v = Image.new('RGB', (o.width * 2 + 20, o.height), (255, 255, 255))
v.paste(leva, (0, 0)); v.paste(prava, (o.width + 20, 0))
v.resize((v.width // 2, v.height // 2)).save('snimky/pole-orto.png')
print('snimky/pole-orto.png', v.size)
