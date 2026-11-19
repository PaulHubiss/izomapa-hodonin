"""Veřejná místa v mapě (Pavel 2026-11-16: „úřady, radnice, knihovny, veřejná místa s otevírací dobou“) -> assets/verejna_mista.json

    .venv/bin/python nastroje-pavel/verejna_mista.py             stáhne z OSM, spojí s ručními údaji, zapíše
    .venv/bin/python nastroje-pavel/verejna_mista.py --prehled   jen vypíše, co v datech je (počty, kolik má otevírací dobu)
    .venv/bin/python nastroje-pavel/verejna_mista.py --seznam    vypíše všechna místa (podklad pro ruční údaje)

Skupiny: urady (úřady a služby), kultura, zdravi, skoly (školy a sport). overlay.py je přidá do klikací vrstvy,
prohlížeč je ukáže jako ikonky s vlastními přepínači a ve skupinách sekce Místa.
Otevírací doby v OSM skoro chybí (2026-11-16: jen lékárny a pošta), proto assets/verejna_mista_rucne.json:
  {"<osm id nebo název>": {"oteviraci": "Mo,We 08:00-17:00; …", "zdroj": "https://…", "overeno": "2026-11-16", …}}
  klíče přepíšou údaje z OSM; "skryt": true místo vynechá; položka s "lat"/"lon" a bez OSM přidá místo, které v OSM není.
Lepší než ruční údaj je opravit OSM (příští běh ho převezme) – ruční mají přednost, tak je po opravě v OSM smazat.
"""
import collections, json, math, os, sys
sys.path.insert(0, '.')
sys.path.insert(0, 'nastroje')
import geo
from overpass import dotaz

# (klíč OSM, hodnota) → (kategorie, druh česky)
DRUHY = {
    ('amenity', 'townhall'): ('urady', 'Radnice, úřad'), ('office', 'government'): ('urady', 'Úřad'),
    ('amenity', 'courthouse'): ('urady', 'Soud'), ('amenity', 'police'): ('urady', 'Policie'),
    ('amenity', 'fire_station'): ('urady', 'Hasiči'), ('amenity', 'post_office'): ('urady', 'Pošta'),
    ('office', 'employment_agency'): ('urady', 'Úřad práce'), ('office', 'tax_advisor'): (None, None),
    ('amenity', 'library'): ('kultura', 'Knihovna'), ('tourism', 'museum'): ('kultura', 'Muzeum'),
    ('amenity', 'theatre'): ('kultura', 'Divadlo'), ('amenity', 'cinema'): ('kultura', 'Kino'),
    ('amenity', 'arts_centre'): ('kultura', 'Kulturní centrum'), ('amenity', 'community_centre'): ('kultura', 'Komunitní centrum'),
    ('tourism', 'gallery'): ('kultura', 'Galerie'), ('tourism', 'information'): ('kultura', 'Informační centrum'),
    ('tourism', 'zoo'): ('kultura', 'Zoo'),
    ('amenity', 'hospital'): ('zdravi', 'Nemocnice'), ('amenity', 'clinic'): ('zdravi', 'Poliklinika'),
    ('amenity', 'doctors'): ('zdravi', 'Lékař'), ('amenity', 'dentist'): ('zdravi', 'Zubař'),
    ('amenity', 'pharmacy'): ('zdravi', 'Lékárna'), ('amenity', 'veterinary'): ('zdravi', 'Veterinář'),
    ('amenity', 'school'): ('skoly', 'Škola'), ('amenity', 'kindergarten'): ('skoly', 'Mateřská škola'),
    ('amenity', 'college'): ('skoly', 'Vyšší škola'), ('amenity', 'university'): ('skoly', 'Vysoká škola'),
    ('leisure', 'sports_centre'): ('sport', 'Sportovní centrum'), ('leisure', 'swimming_pool'): ('sport', 'Bazén'),
    ('leisure', 'stadium'): ('sport', 'Stadion'), ('leisure', 'ice_rink'): ('sport', 'Zimní stadion'),
    ('leisure', 'fitness_centre'): ('sport', 'Fitness'),
    ('amenity', 'bank'): ('sluzby', 'Banka'), ('amenity', 'atm'): (None, None),
    ('amenity', 'recycling'): ('sluzby', 'Sběrný dvůr'), ('amenity', 'toilets'): ('sluzby', 'Veřejné WC'),
    ('amenity', 'marketplace'): ('sluzby', 'Tržiště'), ('amenity', 'social_facility'): ('sluzby', 'Sociální služby'),
    # Pavel 2026-11-16: doprava, příroda a volný čas, ubytování, kostely
    ('railway', 'station'): ('doprava', 'Nádraží'), ('railway', 'halt'): ('doprava', 'Zastávka vlaku'),
    ('amenity', 'bus_station'): ('doprava', 'Autobusové nádraží'), ('amenity', 'parking'): ('doprava', 'Parkoviště'),
    ('amenity', 'charging_station'): ('doprava', 'Nabíjecí stanice'), ('amenity', 'fuel'): ('doprava', 'Čerpací stanice'),
    ('amenity', 'bicycle_rental'): ('doprava', 'Půjčovna kol'),
    ('leisure', 'park'): ('priroda', 'Park'), ('leisure', 'playground'): ('priroda', 'Dětské hřiště'),
    ('tourism', 'viewpoint'): ('priroda', 'Vyhlídka'), ('leisure', 'nature_reserve'): ('priroda', 'Přírodní rezervace'),
    ('leisure', 'garden'): ('priroda', 'Zahrada'), ('tourism', 'picnic_site'): (None, None),
    ('tourism', 'hotel'): ('ubytovani', 'Hotel'), ('tourism', 'guest_house'): ('ubytovani', 'Penzion'),
    ('tourism', 'hostel'): ('ubytovani', 'Hostel'), ('tourism', 'motel'): ('ubytovani', 'Motel'),
    ('tourism', 'camp_site'): ('ubytovani', 'Kemp'), ('tourism', 'apartment'): ('ubytovani', 'Apartmány'),
    ('amenity', 'place_of_worship'): ('kostely', 'Kostel'), ('landuse', 'cemetery'): ('kostely', 'Hřbitov'),
    ('amenity', 'grave_yard'): ('kostely', 'Hřbitov'),
}
KLICE_OSM = ('amenity', 'office', 'tourism', 'leisure', 'railway', 'landuse')
# bez jména v OSM dostanou název podle druhu (jinak by v seznamu chyběla); ostatní bezejmenná se vynechají
BEZ_JMENA = ('Veřejné WC', 'Sběrný dvůr', 'Hřbitov', 'Nabíjecí stanice')
lo0, lo1, la0, la1 = geo.bbox_lonlat(0)
klice = collections.defaultdict(list)
for (k, v), (kat, _) in DRUHY.items():
    if kat: klice[k].append(v)
dotazy = ''.join(f'nwr["{k}"~"^({"|".join(v)})$"]({la0},{lo0},{la1},{lo1});\n' for k, v in klice.items())
EL = dotaz(f'[out:json][timeout:120];\n(\n{dotazy});\nout center tags;')
v_mape = lambda lat, lon: tuple(geo.chunk_of(*geo.to_local(lon, lat))) in geo.CHUNKS

def adresa(t):
    ulice = t.get('addr:street') or t.get('addr:place')
    cislo = '/'.join(x for x in (t.get('addr:conscriptionnumber'), t.get('addr:streetnumber')) if x) or t.get('addr:housenumber')
    return ' '.join(x for x in (ulice, cislo) if x) or None


web_url = lambda w: w if not w or w.startswith('http') else 'https://' + w
mista = []
for e in EL:
    t = e.get('tags', {}); lat = e.get('lat') or e.get('center', {}).get('lat'); lon = e.get('lon') or e.get('center', {}).get('lon')
    if lat is None or not v_mape(lat, lon): continue
    if t.get('amenity') == 'recycling' and t.get('recycling_type') != 'centre': continue   # kontejnery na tříděný odpad ne
    if t.get('tourism') == 'information' and t.get('information') != 'office': continue   # tabule, rozcestníky, mapy ne
    druh = next((DRUHY[(k, t[k])] for k in KLICE_OSM if (k, t.get(k)) in DRUHY), (None, None))
    if not druh[0]: continue
    if druh[1] == 'Kostel' and t.get('religion') not in (None, 'christian'): druh = ('kostely', 'Modlitebna')
    if druh[1] == 'Parkoviště' and t.get('access') in ('private', 'customers', 'no'): continue   # firemní a pro zákazníky ne
    if druh[1] == 'Dětské hřiště' and t.get('access') in ('private', 'no'): continue
    nazev = t.get('name') or (druh[1] if druh[1] in BEZ_JMENA else None)
    if not nazev: continue                                    # bezejmenné (budovy policie, školní hřiště…) by v seznamu nic neřekly
    mista.append({'id': f"{e['type']}/{e['id']}", 'kat': druh[0], 'druh': druh[1], 'nazev': nazev, 'oh': t.get('opening_hours'),
                  'web': web_url(t.get('website') or t.get('contact:website')), 'tel': t.get('phone') or t.get('contact:phone'),
                  'adresa': adresa(t), 'lat': round(lat, 6), 'lon': round(lon, 6)})
# tentýž objekt jako bod i jako budova: stejný druh a název do 80 m → nechat ten s víc údaji
vzd = lambda a, b: math.hypot((a['lat'] - b['lat']) * 111320, (a['lon'] - b['lon']) * 72900)
skore = lambda m: sum(1 for k in ('oh', 'web', 'tel', 'adresa') if m.get(k))
mista.sort(key=skore, reverse=True)
jedinecna = []
for m in mista:
    if any(o['druh'] == m['druh'] and o['nazev'] == m['nazev'] and vzd(o, m) < 80 for o in jedinecna): continue
    jedinecna.append(m)
mista = sorted(jedinecna, key=lambda m: (m['kat'], m['druh'], m['nazev']))

if '--seznam' in sys.argv:
    for m in mista: print(f"{m['kat']:8} {m['druh'][:16]:16} {m['nazev'][:44]:44} {m['id']:18} {'⏰' if m['oh'] else '  '} {(m['adresa'] or '')[:24]:24} {(m['web'] or '')[:50]}")
    sys.exit()

if '--prehled' not in sys.argv:
    # skupina v mapě = kategorie (Pavel 2026-11-16 večer: úřady a služby i školy a sport zvlášť); pořadí a vzhled web/kategorie.js
    SKUPINA = {k: k for k in ('urady', 'sluzby', 'kultura', 'zdravi', 'skoly', 'sport', 'doprava', 'priroda', 'ubytovani', 'kostely')}
    RUCNE = 'assets/verejna_mista_rucne.json'
    rucne = {k: v for k, v in json.load(open(RUCNE, encoding='utf-8')).items() if not k.startswith('_')} if os.path.exists(RUCNE) else {}
    podle_id = {m['id']: m for m in mista}
    out = []
    for m in mista:
        r = rucne.get(m['id'], {})
        if r.get('skryt'): continue
        o = {'nazev': m['nazev'], 'skupina': SKUPINA[m['kat']], 'druh': m['druh'], 'lat': m['lat'], 'lon': m['lon'], 'adresa': m['adresa'],
             'oteviraci': m['oh'], 'web': m['web'], 'telefon': m['tel'], 'osm': f"https://www.openstreetmap.org/{m['id']}"}
        o.update({k: v for k, v in r.items() if not k.startswith('_')})
        out.append(o)
    for nazev, r in rucne.items():                             # místa, která v OSM nejsou
        if '/' in nazev or r.get('skryt'): continue
        o = {'nazev': nazev, **{k: v for k, v in r.items() if not k.startswith('_') and k != 'vedle'}}
        if r.get('vedle'):                                     # ve stejném domě jako jiné místo: kousek vedle, ať se ikonky nepřekryjí
            v = podle_id[r['vedle']]; o['lat'], o['lon'] = v['lat'], round(v['lon'] + 0.00012, 6)
        out.append(o)
    # stejný název víckrát ve skupině (4× Veřejné WC, 3× Dr. Max): seznam Míst za něj připíše ulici ("ulice"),
    # z adresy, jinak z nejbližší adresy v OSM do 80 m, jinak z nejbližší pojmenované silnice
    import re
    ulice_z = lambda a: re.sub(r'\s+[\d/ ]+[a-zA-Z]?$', '', a).strip() if a else None
    pocty = collections.Counter((o['skupina'], o['nazev']) for o in out)
    dvojnici = [o for o in out if pocty[(o['skupina'], o['nazev'])] > 1]
    bez = [o for o in dvojnici if not o.get('adresa')]
    okoli = dotaz('[out:json][timeout:60];\n(\n' + ''.join(
        f'nwr(around:80,{o["lat"]},{o["lon"]})["addr:street"];\nway(around:60,{o["lat"]},{o["lon"]})["highway"]["name"];\n' for o in bez)
        + ');\nout center tags;') if bez else []
    for o in dvojnici:
        if o.get('adresa'): o['ulice'] = ulice_z(o['adresa']); continue
        kand = []
        for e in okoli:
            t = e.get('tags', {}); la = e.get('lat') or e.get('center', {}).get('lat'); lo = e.get('lon') or e.get('center', {}).get('lon')
            if la is None: continue
            jm, vaha = (t['addr:street'], 0) if t.get('addr:street') else (t.get('name'), 25)   # adresa má přednost před osou silnice
            kand.append((vzd(o, {'lat': la, 'lon': lo}) + vaha, jm))
        if kand: o['ulice'] = min(kand)[1]
    out = [{k: v for k, v in o.items() if v not in (None, '', [])} for o in out]
    json.dump(out, open('assets/verejna_mista.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    s = collections.Counter(o['skupina'] for o in out)
    print(f"assets/verejna_mista.json: {len(out)} míst ({', '.join(f'{k} {n}' for k, n in s.items())}), "
          f"s otevírací dobou {sum(1 for o in out if o.get('oteviraci') or o.get('sezony'))}")

if '--prehled' in sys.argv:
    for kat in ('urady', 'sluzby', 'kultura', 'zdravi', 'skoly', 'sport', 'doprava', 'priroda', 'ubytovani', 'kostely'):
        mm = [m for m in mista if m['kat'] == kat]
        print(f'\n== {kat}: {len(mm)} (jméno {sum(1 for m in mm if m["nazev"])}, otevírací doba {sum(1 for m in mm if m["oh"])}, web {sum(1 for m in mm if m["web"])})')
        for d, n in collections.Counter(m['druh'] for m in mm).most_common():
            s_oh = sum(1 for m in mm if m['druh'] == d and m['oh'])
            print(f'   {d:22} {n:3}   s otevírací dobou {s_oh}')
        for m in [m for m in mm if m['nazev']][:6]: print(f'     · {m["nazev"][:50]:50} {"⏰" if m["oh"] else "  "} {(m["web"] or "")[:40]}')
