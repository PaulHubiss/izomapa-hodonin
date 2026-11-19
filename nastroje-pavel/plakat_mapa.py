"""Obraz mapy pro tiskový plakát: složí celou mapu v plném rozlišení, ořízne průhledný okraj a zmenší celým násobkem.

.venv/bin/python nastroje-pavel/plakat_mapa.py [varianta] [zmenseni]     např. autumn 4
→ build/plakat/mapa_<varianta>_<zmenseni>.png (průhledné pozadí), pak node nastroje-pavel/plakat.mjs

Plné rozlišení je ~35 000 px na šířku (na 62 cm by to bylo ~1 400 dpi). Zmenšení celým násobkem s průměrováním
(Image.reduce = průměr bloku n × n) nedělá moaré ani rozmazání jako obecné převzorkování; průměruje se
v přednásobené alfě (RGBa), jinak by okraj dioramatu dostal tmavý lem od průhledných černých pixelů.
4× → ~8 800 px ≈ 360 dpi na 62 cm.
"""
import os, subprocess, sys
from PIL import Image

Image.MAX_IMAGE_PIXELS = None
KOREN = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
os.chdir(KOREN)
var = sys.argv[1] if len(sys.argv) > 1 else 'autumn'
n = int(sys.argv[2]) if len(sys.argv) > 2 else 4
os.makedirs('build/plakat', exist_ok=True)
plne = f'build/plakat/mapa_{var}.png'
if not os.path.exists(plne):
    subprocess.run([sys.executable, 'compose.py', var, '1', plne], check=True, env={**os.environ, 'TRANSPARENT': '1'})
im = Image.open(plne)
im = im.crop(im.getchannel('A').getbbox())
print('plné po ořezu', im.size)
im = im.convert('RGBa').reduce(n).convert('RGBA')
out = f'build/plakat/mapa_{var}_{n}.png'
im.save(out, optimize=False, compress_level=6)
print(out, im.size, f'{os.path.getsize(out) / 1e6:.0f} MB')
