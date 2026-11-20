# restaurace, kavárny, hospody, bistra a cukrárny v mapě -> assets/podniky.json; overlay.py je přidá do klikací vrstvy,
# prohlížeč je ukáže v kartě (název, druh, adresa, otevírací doba, „teď otevřeno“, kuchyně, web, telefon).
# Zdroje: OpenStreetMap (ODbL) celý + Overture places (data/places.parquet z fetch_data.py) jen to, co člověk potvrdil.
#   Overture najde skoro všechno (hlavně stránky z Facebooku), ale zavřené podniky v něm zůstávají a nemá otevírací doby.
#   Proto podniky, které jsou jen v Overture, jdou do navrhy/podniky-kandidati.json a do mapy až po potvrzení
#   ve výběru (navrhy/podniky.html, výsledek volby/podniky.json: ✓ existuje = do mapy, ✕ zavřeno, ? nevím = zatím ne).
# Zavřený nebo chybějící podnik se nejlépe opraví přímo v OpenStreetMap, příští běh ho převezme.
# spouštět z kořene repa: python nastroje/podniky.py   (--prehled jen vypíše, co v datech je, a nic nezapíše)
import collections, json, math, os, re, sys, unicodedata
sys.path.insert(0, '.')
sys.path.insert(0, 'nastroje')
import geo
from overpass import dotaz

DRUHY = {'restaurant': 'Restaurace', 'cafe': 'Kavárna', 'pub': 'Hospoda', 'bar': 'Bar', 'biergarten': 'Pivní zahrádka',
         'fast_food': 'Bistro', 'ice_cream': 'Zmrzlina', 'confectionery': 'Cukrárna', 'pastry': 'Cukrárna'}
OVERTURE = {'restaurant': 'restaurant', 'bar': 'bar', 'pub': 'pub', 'brewery': 'pub', 'coffee_shop': 'cafe', 'cafe': 'cafe',
            'casual_eatery': 'fast_food', 'fast_food_restaurant': 'fast_food', 'ice_cream_shop': 'ice_cream', 'dessert_shop': 'confectionery'}
MIN_JISTOTA = 0.4                      # pod tím je v Overture hlavně šum (herny, obchody s kategorií „bar“)
KANDIDATI, VOLBY = 'navrhy/podniky-kandidati.json', 'volby/podniky.json'
v_mape = lambda lat, lon: tuple(geo.chunk_of(*geo.to_local(lon, lat))) in geo.CHUNKS
m = lambda a, b: math.hypot((a['lat'] - b['lat']) * 111320, (a['lon'] - b['lon']) * 111320 * math.cos(math.radians(a['lat'])))

# ---------- OpenStreetMap ----------
lo0, lo1, la0, la1 = geo.bbox_lonlat(0)
EL = dotaz(f'''[out:json][timeout:90];
( nwr["amenity"~"^(restaurant|cafe|pub|bar|biergarten|fast_food|ice_cream)$"]({la0},{lo0},{la1},{lo1});
  nwr["shop"~"^(confectionery|pastry)$"]({la0},{lo0},{la1},{lo1}); );
out center tags;''')


def adresa(t):
    ulice = t.get('addr:street') or t.get('addr:place')
    cislo = '/'.join(x for x in (t.get('addr:conscriptionnumber'), t.get('addr:streetnumber')) if x) or t.get('addr:housenumber')
    return ' '.join(x for x in (ulice, cislo) if x) or None


def web_url(w):
    return w if not w or w.startswith('http') else 'https://' + w


osm = []
for e in EL:
    t = e.get('tags', {})
    lat, lon = (e['lat'], e['lon']) if 'lat' in e else (e['center']['lat'], e['center']['lon'])
    if not v_mape(lat, lon) or not t.get('name') or t.get('opening_hours') == 'closed': continue
    osm.append({k: v for k, v in {
        'nazev': t['name'], 'druh': t.get('amenity') if t.get('amenity') in DRUHY else t.get('shop'),
        'lat': round(lat, 6), 'lon': round(lon, 6), 'adresa': adresa(t), 'oteviraci': t.get('opening_hours'),
        'kuchyne': t.get('cuisine'), 'web': web_url(t.get('website') or t.get('contact:website') or t.get('url')),
        'telefon': t.get('phone') or t.get('contact:phone'), 'zdroj': 'osm', 'osm': f"https://www.openstreetmap.org/{e['type']}/{e['id']}",
    }.items() if v})

# ---------- ruční opravy (assets/podniky_rucne.json, Pavel 2026-11-20: Westy → Stejkárna Na Budvarce) ----------
# klíč = OSM id ("node/…", "way/…"): údaje přepíšou ty z OSM, "skryt": true podnik vynechá. Po opravě v OSM položku smazat.
RUCNE = 'assets/podniky_rucne.json'
rucne = {k: v for k, v in json.load(open(RUCNE, encoding='utf-8')).items() if not k.startswith('_')} if os.path.exists(RUCNE) else {}
for p in osm:
    r = rucne.get(p['osm'].split('openstreetmap.org/')[1], {})
    p.update({k: v for k, v in r.items() if not k.startswith('_')})
osm = [p for p in osm if not p.pop('skryt', False)]

# ---------- Overture: jen co v OSM chybí ----------
SLOVA = {'restaurace', 'restaurant', 'pivnice', 'hospoda', 'hospudka', 'hostinec', 'bar', 'cafe', 'caffe', 'kafe', 'kavarna', 'bistro',
         'hodonin', 'pizzeria', 'pizzerie', 'pizza', 'pub', 'na', 'u', 'a', 'the', 'minipivovar', 'minibrewery', 'pivovar', 'club', 'klub'}


def slova(n):
    n = unicodedata.normalize('NFD', n.lower()); n = ''.join(c for c in n if unicodedata.category(c) != 'Mn')
    return {w for w in re.findall(r'[a-z0-9]+', n) if w not in SLOVA} or set(re.findall(r'[a-z0-9]+', n))


def stejny(a, b):
    """stejný podnik: blízko a podobné jméno (Overture a OSM mívají špendlík i desítky metrů od sebe), nebo skoro na stejném místě"""
    d = m(a, b)
    if d < 12: return True
    sa, sb = slova(a['nazev']), slova(b['nazev'])
    podobne = bool(sa & sb) and len(sa & sb) / min(len(sa), len(sb)) >= 0.5
    return podobne and (d < 150 or bool(a.get('adresa')) and a.get('adresa') == b.get('adresa'))


over = []
if os.path.exists('data/places.parquet'):
    import pyarrow.parquet as pq
    for r in pq.read_table('data/places.parquet').to_pylist():
        druh = OVERTURE.get(r.get('basic_category'))
        nazev = (r.get('names') or {}).get('primary')
        if not druh or not nazev or (r.get('confidence') or 0) < MIN_JISTOTA or r.get('operating_status') in ('permanently_closed', 'closed'): continue
        g = r['bbox']; lat, lon = (g['ymin'] + g['ymax']) / 2, (g['xmin'] + g['xmax']) / 2
        if not v_mape(lat, lon): continue
        adr = ((r.get('addresses') or [{}])[0] or {}).get('freeform')
        over.append({k: v for k, v in {
            'id': r['id'], 'nazev': nazev, 'druh': druh, 'lat': round(lat, 6), 'lon': round(lon, 6), 'adresa': adr,
            'web': web_url((r.get('websites') or [None])[0]), 'facebook': (r.get('socials') or [None])[0],
            'telefon': (r.get('phones') or [None])[0], 'jistota': round(r.get('confidence') or 0, 2), 'zdroj': 'overture',
        }.items() if v})
navic, duplicit = [], 0
for o in sorted(over, key=lambda o: -o['jistota']):
    if any(stejny(o, x) for x in osm) or any(stejny(o, x) for x in navic): duplicit += 1; continue
    navic.append(o)

# ---------- potvrzené z výběru ----------
volby = (json.load(open(VOLBY, encoding='utf-8')).get('polozky', {}) if os.path.exists(VOLBY) else {})
potvrzene = [{k: v for k, v in o.items() if k not in ('id', 'jistota')} for o in navic if volby.get(o['id'], {}).get('rozhodnuti') == 'pouzit']
out = sorted(osm + potvrzene, key=lambda p: unicodedata.normalize('NFD', p['nazev'].lower()))

pocet = collections.Counter(p['druh'] for p in osm)
print(f'OSM {len(osm)} ({", ".join(f"{DRUHY[k]} {n}" for k, n in pocet.most_common())})')
print(f'Overture {len(over)} s jistotou ≥ {MIN_JISTOTA}: {duplicit} už je v OSM, {len(navic)} navíc → ke kontrole, potvrzeno {len(potvrzene)}')
print(f'v mapě {len(out)} · s otevírací dobou {sum("oteviraci" in p for p in out)} · s webem {sum("web" in p for p in out)}')
if '--prehled' in sys.argv:
    for o in navic: print(f"  {o['jistota']:.2f} {DRUHY[o['druh']][:10]:10} {o['nazev'][:40]:40} {o.get('adresa', '')[:40]}")
else:
    json.dump(navic, open(KANDIDATI, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    json.dump(out, open('assets/podniky.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(f'zapsáno assets/podniky.json a {KANDIDATI}')
