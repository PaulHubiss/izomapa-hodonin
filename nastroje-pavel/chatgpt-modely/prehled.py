"""Přehled převzatých modelů v jednom obrázku (Claudova kontrola očima před předáním Pavlovi):

    .venv/bin/python nastroje-pavel/chatgpt-modely/prehled.py davka-2026-11-25-a [další dávky] → snimky/modely-prehled.png

Každá stavba: snímek „po“ z mapy se jménem. Bere podklady-soukrome/pamatky/img/<slug>_po.jpg.
"""
import os, sys
from PIL import Image, ImageDraw, ImageFont
W, H, NA_RADEK = 300, 230, 6
pismo = ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc', 15)
slugy = [s for b in sys.argv[1:] for s in sorted(os.listdir(f'predani/chatgpt/{b}/stavby')) if not s.startswith('.')]
radku = -(-len(slugy) // NA_RADEK)
out = Image.new('RGB', (W * NA_RADEK, (H + 22) * radku), (27, 35, 51)); d = ImageDraw.Draw(out)
for i, s in enumerate(slugy):
    x, y = i % NA_RADEK * W, i // NA_RADEK * (H + 22)
    f = f'podklady-soukrome/pamatky/img/{s}_po.jpg'
    if os.path.exists(f):
        im = Image.open(f).convert('RGB'); im.thumbnail((W - 6, H - 4)); out.paste(im, (x + 3, y + 20))
    d.text((x + 6, y + 2), s if os.path.exists(f) else s + ' – CHYBÍ', fill=(255, 255, 255), font=pismo)
out.save('snimky/modely-prehled.png'); print('snimky/modely-prehled.png', out.size, len(slugy))
