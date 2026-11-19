# společný dotaz na Overpass API (OpenStreetMap) pro nastroje/kominy.py a nastroje/prejezdy.py
# Veřejný overpass-api.de bývá přetížený: vrací 502/429 („All query workers are busy … retry using exponential
# backoff“) a curl -f to přes HTTP/2 hlásí jako exit 56. Proto: opakovat s rostoucím čekáním, pak zkusit zrcadlo.
# Jiný server: proměnná prostředí OVERPASS_URL (např. vlastní instance).
import json, os, subprocess, time

SERVERY = [os.environ['OVERPASS_URL']] if os.environ.get('OVERPASS_URL') else [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.private.coffee/api/interpreter',
]


def dotaz(q, pokusu=5):
    """Pošle dotaz Overpass QL, vrátí seznam 'elements'. Při přetížení čeká 5, 10, 20, 40 s, pak další server."""
    chyba = None
    for url in SERVERY:
        for k in range(pokusu):
            r = subprocess.run(['curl', '-s', '-m', '120', '-A', 'izomapa-tools/1.0', '-w', '\n%{http_code}',
                                '--data-urlencode', f'data={q}', url], capture_output=True, text=True)
            telo, _, kod = r.stdout.rpartition('\n')
            if r.returncode == 0 and kod == '200':
                return json.loads(telo)['elements']
            chyba = f'{url}: curl {r.returncode}, HTTP {kod or "-"}'
            if kod in ('400',):                      # chybný dotaz – opakování nepomůže
                raise RuntimeError(chyba + '\n' + telo[:500])
            if k < pokusu - 1:
                print(f'Overpass nedostupný ({chyba}), zkusím znovu za {5 * 2 ** k} s')
                time.sleep(5 * 2 ** k)
    raise RuntimeError(f'Overpass nedostupný ani po opakování: {chyba}')
