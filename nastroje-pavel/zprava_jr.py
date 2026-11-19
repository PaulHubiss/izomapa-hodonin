"""Krátká zpráva o jízdních řádech v mapě (site/mhd.json): kolik linek a spojů a do kdy platí.

    .venv/bin/python nastroje-pavel/zprava_jr.py ulož     uloží stav před aktualizací do build/aktualizace/pred.json
    .venv/bin/python nastroje-pavel/zprava_jr.py          vypíše stav a rozdíl proti uloženému

Služby vlaků (nastroje/vlaky.py) mají klíč začínající „V“, ostatní jsou z GTFS IDS JMK.
"""
import datetime, json, os, sys

PRED = 'build/aktualizace/pred.json'


def stav():
    if not os.path.exists('site/mhd.json'): return None
    m = json.load(open('site/mhd.json', encoding='utf-8'))
    druh = lambda t: {0: 'tramvaje', 2: 'vlaky'}.get(t, 'autobusy')
    linky, spoje = {}, {}
    for t in m['trips']:
        r = m['routes'][t[0]]; k = druh(r[1])
        spoje[k] = spoje.get(k, 0) + 1
        linky.setdefault(k, set()).add(r[0] if k != 'vlaky' else r[0].split()[0])
    do = lambda vlak: max((s[2] for k, s in m['services'].items() if k.startswith('V') == vlak), default=0)
    return {'linky': {k: len(v) for k, v in linky.items()}, 'spoje': spoje, 'mhd_do': do(False), 'vlaky_do': do(True)}


def datum(n):
    return datetime.datetime.strptime(str(n), '%Y%m%d').strftime('%-d. %-m. %Y') if n else '–'


s = stav()
if sys.argv[1:2] == ['ulož']:
    os.makedirs(os.path.dirname(PRED), exist_ok=True)
    json.dump(s, open(PRED, 'w')); sys.exit()
p = json.load(open(PRED)) if os.path.exists(PRED) else None
if not s: sys.exit('site/mhd.json chybí')
zmena = lambda a, b: '' if p is None or a == b else f' (dřív {b})'
print('── Jízdní řády v mapě ──')
for k in ('autobusy', 'tramvaje', 'vlaky'):
    if k in s['spoje'] or (p and k in p['spoje']):
        sp, li = s['spoje'].get(k, 0), s['linky'].get(k, 0)
        print(f'  {k}: {sp} spojů{zmena(sp, p and p["spoje"].get(k, 0))}'
              + ('' if k == 'vlaky' else f', {li} linek{zmena(li, p and p["linky"].get(k, 0))}'))
dnes = int(datetime.date.today().strftime('%Y%m%d'))
for k, jm in (('mhd_do', 'MHD (IDS JMK)'), ('vlaky_do', 'vlaky (CIS JŘ)')):
    if not s[k]: continue
    zbyva = (datetime.datetime.strptime(str(s[k]), '%Y%m%d').date() - datetime.date.today()).days
    print(f'  {jm} platí do {datum(s[k])}{zmena(datum(s[k]), p and datum(p[k]))}'
          + (f'  ⚠️ zbývá {zbyva} dní' if zbyva < 14 else ''))
