"""Písmo Source Sans 3 na náš web místo Google Fonts (Pavel 2026-11-18, napady/PRED-SPUSTENIM.md kap. 2).

Proč: při načtení písma z fonts.googleapis.com jde IP každého návštěvníka Googlu (rozsudek LG München 2022).
Stáhne stejné soubory, jaké posílá Google Fonts moderním prohlížečům (woff2, rozdělené podle znaků), jen sady
latin a latin-ext (čeština je v latin-ext), uloží je do web/ jako pismo-*.woff2 a k nim web/pisma.css se stejnými
@font-face a unicode-range. build_html.py je zkopíruje do site/ (kopíruje jen soubory, ne složky – proto plochě).

    .venv/bin/python nastroje-pavel/pisma.py

Spouštět jen při změně řezů (soubory jsou v gitu). Licence písma: SIL Open Font License 1.1 (smí se šířit).
"""
import glob
import os
import re
import urllib.request

DOTAZ = 'https://fonts.googleapis.com/css2?family=Source+Sans+3:ital,wght@0,400;0,600;0,700;1,400&display=swap'
UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36'
SADY = ('latin', 'latin-ext')


def stahni(url):
    return urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': UA}), timeout=30).read()


css = stahni(DOTAZ).decode()
bloky = re.findall(r'/\* ([\w-]+) \*/\s*(@font-face \{[^}]*\})', css)
assert bloky, 'Google Fonts vrátil nečekanou odpověď'
for f in glob.glob('web/pismo-*.woff2'):                   # staré řezy pryč (generované, v gitu je historie)
    os.remove(f)
vystup = ['/* Source Sans 3 (SIL OFL 1.1) z našeho webu místo Google Fonts – vyrobil nastroje-pavel/pisma.py */']
# Source Sans 3 je proměnné písmo: váhy 400–700 jsou v jednom souboru (Google je posílá pod stejnou adresou) → uložit jednou
jmena = {}
for sada, blok in bloky:
    if sada not in SADY:
        continue
    styl = re.search(r'font-style: (\w+)', blok).group(1)
    vaha = re.search(r'font-weight: (\d+)', blok).group(1)
    url = re.search(r'url\((https://[^)]+)\)', blok).group(1)
    if url not in jmena:
        jmeno = f"pismo-ss3{'-kurziva' if styl == 'italic' else ''}-{sada}.woff2"
        if jmeno in jmena.values():                        # statické řezy (jiný soubor pro každou váhu)
            jmeno = jmeno.replace('pismo-ss3', f'pismo-ss3-{vaha}')
        jmena[url] = jmeno
        open(f'web/{jmeno}', 'wb').write(stahni(url))
        print(jmeno)
    vystup.append(blok.replace(url, jmena[url]))
open('web/pisma.css', 'w', encoding='utf-8').write('\n'.join(vystup) + '\n')
print(f'web/pisma.css: {len(vystup) - 1} řezů')
