# kulturní památky v mapě z Wikidat (CC0): název, číslo ÚSKP, odkaz do Památkového katalogu NPÚ, fotka z Wikimedia Commons
# (s autorem a licencí, které je potřeba uvést) a článek na české Wikipedii
# -> assets/pamatky.json; overlay.py je přidá do klikací vrstvy, prohlížeč je ukáže v kartě
# spouštět z kořene repa: python nastroje/pamatky.py
import html, json, os, re, sys, urllib.parse, urllib.request
sys.path.insert(0, '.')
import geo

UA = {'User-Agent': 'izomapa-hodonin/1.0 (+https://github.com/PaulHubiss/izomapa-hodonin)'}
KATALOG = 'https://pamatkovykatalog.cz/soupis/podle-relevance/1/seznam/?katCislo={}'   # formátovací URL vlastnosti P4075 ve Wikidatech


def autor(t):
    """jméno autora fotky; když autor v popisu žádá konkrétní uvedení („please credit me as: …“), použije se to"""
    t = ' '.join(t.split()); m = re.search(r'credit (?:me|the author) as:?\s*(.+)', t, re.I)
    return (m.group(1).split('. ')[0] if m else t).strip(' .')[:100]


def get(url, params):
    return json.loads(urllib.request.urlopen(urllib.request.Request(url + '?' + urllib.parse.urlencode(params), headers=UA), timeout=120).read())


lo0, lo1, la0, la1 = geo.bbox_lonlat(0)
Q = f'''SELECT ?p ?pLabel ?uskp ?kat ?img ?coord ?wiki WHERE {{
  SERVICE wikibase:box {{ ?p wdt:P625 ?coord. bd:serviceParam wikibase:cornerSouthWest "Point({lo0} {la0})"^^geo:wktLiteral.
                                           bd:serviceParam wikibase:cornerNorthEast "Point({lo1} {la1})"^^geo:wktLiteral. }}
  ?p wdt:P762 ?uskp.
  OPTIONAL {{ ?p wdt:P4075 ?kat. }} OPTIONAL {{ ?p wdt:P18 ?img. }}
  OPTIONAL {{ ?wiki schema:about ?p; schema:isPartOf <https://cs.wikipedia.org/>. }}
  SERVICE wikibase:label {{ bd:serviceParam wikibase:language "cs". }} }}'''
rows = get('https://query.wikidata.org/sparql', {'query': Q, 'format': 'json'})['results']['bindings']

P = {}
for r in rows:                                     # jedna památka může mít víc fotek nebo souřadnic: první vyhrává
    qid = r['p']['value'].rsplit('/', 1)[1]
    if qid in P: continue
    lon, lat = map(float, re.findall(r'[-\d.]+', r['coord']['value'])[:2])
    n = r['pLabel']['value']                     # „kostel svatého Vavřince“ → nadpis karty velkým
    P[qid] = {'qid': qid, 'nazev': n[:1].upper() + n[1:], 'lat': round(lat, 6), 'lon': round(lon, 6), 'uskp': r['uskp']['value'],
              'katalog': KATALOG.format(r['kat']['value']) if 'kat' in r else None,
              'wiki': r['wiki']['value'] if 'wiki' in r else None,
              'soubor': urllib.parse.unquote(r['img']['value'].rsplit('/', 1)[1]) if 'img' in r else None}
P = {k: v for k, v in P.items() if tuple(geo.chunk_of(*geo.to_local(v['lon'], v['lat']))) in geo.CHUNKS}

# fotky: náhled 480 px, autor a licence z Commons (extmetadata)
soubory = [p['soubor'] for p in P.values() if p['soubor']]
INFO = {}
for i in range(0, len(soubory), 40):
    d = get('https://commons.wikimedia.org/w/api.php', {'action': 'query', 'format': 'json', 'prop': 'imageinfo', 'iiprop': 'url|extmetadata',
                                                         'iiurlwidth': 480, 'titles': '|'.join('File:' + s for s in soubory[i:i + 40])})
    norm = {n['to']: n['from'] for n in d['query'].get('normalized', [])}
    for pg in d['query']['pages'].values():
        if 'imageinfo' not in pg: continue
        ii = pg['imageinfo'][0]; m = ii.get('extmetadata', {})
        bez_html = lambda k: html.unescape(re.sub(r'<[^>]+>', '', m.get(k, {}).get('value', ''))).strip()
        INFO[norm.get(pg['title'], pg['title'])[5:]] = {'url': ii.get('thumburl') or ii['url'], 'stranka': ii['descriptionurl'],
                                                       # autor může v „Attribution“ žádat konkrétní znění uvedení → to má přednost
                                                       'autor': autor(bez_html('Attribution') or bez_html('Artist')),
                                                       'licence': bez_html('LicenseShortName')}
for p in P.values():
    f = p.pop('soubor')
    if f and f in INFO: p['foto'] = INFO[f]
out = sorted(P.values(), key=lambda p: p['nazev'])
json.dump(out, open('assets/pamatky.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('památek', len(out), '· s fotkou', sum('foto' in p for p in out), '· s článkem', sum(bool(p['wiki']) for p in out))
