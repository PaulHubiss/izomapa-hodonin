"""Ověří fotky památek z Wikimedia Commons proti zdroji (Pavel 2026-11-18, UKOLY.md „fotky Commons“).

Pro každou fotku v assets/pamatky.json se zeptá Commons (API imageinfo, extmetadata) na autora a licenci a porovná je
s tím, co ukazuje karta. Zkusí i, že se náhled opravdu načte (HTTP 200, obrázek). Nic nemění, jen vypíše tabulku.

    .venv/bin/python nastroje-pavel/over_fotky.py

Licence CC BY-SA chce: jméno autora, název licence s odkazem a odkaz na dílo. Karta (showCard v web/app.html) ukazuje
„Foto: autor, licence, Wikimedia Commons“ s odkazem na stránku souboru, kde je i plné znění licence.
"""
import html
import json
import re
import urllib.parse
import urllib.request

UA = 'izomapa-kontrola-fotek/1.0'   # obecný název klienta, bez osobních údajů


def get(url, raw=False):
    r = urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': UA}), timeout=30)
    return (r.status, r.headers.get('content-type', ''), r.read(2048)) if raw else json.load(r)


def holy(t):
    return re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', '', t or ''))).strip()


P = json.load(open('assets/pamatky.json', encoding='utf-8'))
fotky = [p for p in P if p.get('foto')]
nazvy = {urllib.parse.unquote(p['foto']['stranka'].split('/wiki/')[1]).replace('_', ' '): p for p in fotky}
q = urllib.parse.urlencode({'action': 'query', 'titles': '|'.join(nazvy), 'prop': 'imageinfo', 'iiprop': 'extmetadata',
                            'format': 'json', 'formatversion': 2})
odp = get(f'https://commons.wikimedia.org/w/api.php?{q}')
normal = {n['to']: n['from'] for n in odp['query'].get('normalized', [])}
chyb = 0
for stranka in odp['query']['pages']:
    p = nazvy.get(stranka['title']) or nazvy.get(normal.get(stranka['title'], ''))
    if not p:
        print('?', stranka['title']); chyb += 1; continue
    m = (stranka.get('imageinfo') or [{}])[0].get('extmetadata', {})
    autor, lic = holy(m.get('Artist', {}).get('value')), holy(m.get('LicenseShortName', {}).get('value'))
    f = p['foto']
    try:
        st, typ, _ = get(f['url'], raw=True)
        nahled = st == 200 and typ.startswith('image/')
    except Exception as e:  # noqa: BLE001
        nahled, typ = False, str(e)[:40]
    # autor někdy píše do pole celý text s žádostí, jak ho uvádět („please credit me as: Mercy from Wikimedia Commons“)
    shoda_a = bool(f.get('autor')) and (f['autor'].strip() == autor or f['autor'].strip() in autor)
    shoda_l = f.get('licence', '').strip().lower() == lic.lower()
    ok = shoda_a and shoda_l and nahled
    chyb += not ok
    print(('✅' if ok else '❌'), p['nazev'][:34].ljust(34), '| karta:', f"{f.get('autor')} · {f.get('licence')}".ljust(38),
          '| Commons:', f'{autor} · {lic}' if not (shoda_a and shoda_l) else 'stejné', '' if nahled else f'| náhled: {typ}')
print(f'\n{len(fotky)} fotek, {chyb} k opravě')
