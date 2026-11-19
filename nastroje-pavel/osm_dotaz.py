"""Rychlý výpis prvků z OpenStreetMap v rozsahu mapy (průzkum pro trasy, místa…).

Použití: .venv/bin/python nastroje-pavel/osm_dotaz.py 'nwr["memorial"="plaque"]' 'relation["route"]' …
Každý argument je jeden výběr Overpass QL bez rámečku; rámeček = rozsah mapy (+ ~1 km). Přetížení řeší nastroje/overpass.py.
"""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'nastroje'))
from overpass import dotaz

S, J, Z, V = 48.825, 17.075, 48.888, 17.170          # mřížka B2 s rezervou
BB = f'({S},{J},{Z},{V})'
VYPIS = ('route', 'network', 'tourism', 'information', 'historic', 'memorial', 'inscription', 'board_type', 'amenity',
         'leisure', 'waterway', 'start_date', 'wikidata', 'website')

q = '[out:json][timeout:80];(' + ''.join(f'{v}{BB};' for v in sys.argv[1:]) + ');out center tags;'
for e in dotaz(q):
    c, t = e.get('center', e), e.get('tags', {})
    print(e['type'], e['id'], round(c.get('lat', 0), 5), round(c.get('lon', 0), 5), t.get('name', ''), '|',
          {k: v for k, v in t.items() if k in VYPIS})
