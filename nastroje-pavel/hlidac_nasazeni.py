"""Hlídač nasazení mezi M5 a M2: nepustí na web starší stav, než jaký tam už je.
    .venv/bin/python nastroje-pavel/hlidac_nasazeni.py        kontrola + zapíše site/nasazeno.json (volá aktualizuj.sh nasad)
    .venv/bin/python nastroje-pavel/hlidac_nasazeni.py stav   jen ukáže, co je na webu

Proč (Pavel 2026-11-21: „hlídej, aby M2 a M5 nedělaly kolize, protože jsou různě aktivní a zapínají se různě“):
2026-11-20 nasadil M2 starý stav přes novější web z M5. automat.sh nasad už porovnává s GitHubem, ruční nasazení ne.
Pravidla (obejití: POVOL_NASAZENI=1):
  1. čistý pracovní strom (nasazený stav = commit, jinak se nedá zjistit, co na webu je),
  2. HEAD není pozadu za origin/main (druhý Mac mezitím něco poslal → nejdřív git pull a přestavět),
  3. HEAD je na GitHubu (jinak druhý Mac o nasazeném stavu neví a příště by ho přepsal) → nejdřív git push,
  4. commit, který je teď na webu (site/nasazeno.json na webu), je předkem HEAD – web není novější než tenhle Mac.
"""
import json, os, subprocess, sys, socket, urllib.request
from datetime import datetime

URL = 'https://hodonin.paulhubiss.cz/nasazeno.json'


def git(*a):
    return subprocess.run(['git', *a], capture_output=True, text=True)


def mac():
    jm = subprocess.run(['scutil', '--get', 'ComputerName'], capture_output=True, text=True).stdout.strip() or socket.gethostname()
    return 'M5' if 'M5' in jm else 'M2' if 'M2' in jm else jm


def na_webu():
    try:
        # bez vlastní hlavičky vrací Cloudflare výchozímu klientovi Pythonu 403
        rq = urllib.request.Request(f'{URL}?t={datetime.now().timestamp():.0f}', headers={'User-Agent': 'izomapa-hlidac/1.0'})
        with urllib.request.urlopen(rq, timeout=15) as r:
            return json.load(r)
    except urllib.error.HTTPError as e:
        if e.code == 404: return None              # první nasazení s hlídačem
        raise
    # síť nedostupná → výjimka, nasazení stejně neprojde


web = na_webu()
if len(sys.argv) > 1 and sys.argv[1] == 'stav':
    print('na webu:', json.dumps(web, ensure_ascii=False) if web else 'bez záznamu (nasazeno před hlídačem)'); sys.exit(0)

chyby = []
if git('status', '--porcelain').stdout.strip(): chyby.append('necommitnuté změny – nejdřív commit')
git('fetch', '-q', 'origin')
head = git('rev-parse', 'HEAD').stdout.strip()
pozadu = git('rev-list', '--count', 'HEAD..origin/main').stdout.strip()
if pozadu not in ('', '0'): chyby.append(f'GitHub má o {pozadu} commitů víc (druhý Mac) – nejdřív git pull a přestavět')
if git('branch', '-r', '--contains', head).stdout.strip() == '': chyby.append('commit není na GitHubu – nejdřív git push')
if web and web.get('commit'):
    c = web['commit']
    if git('cat-file', '-e', c + '^{commit}').returncode:
        chyby.append(f'na webu je commit {c[:8]} z {web.get("mac")} ({web.get("cas")}), který tenhle Mac nezná – nejdřív git pull')
    elif git('merge-base', '--is-ancestor', c, head).returncode:
        chyby.append(f'na webu je novější stav z {web.get("mac")} ({web.get("cas")}, {c[:8]}) – tenhle Mac by ho přepsal')

print('na webu:', f'{web.get("commit", "")[:8]} z {web.get("mac")} ({web.get("cas")})' if web else 'bez záznamu')
if chyby:
    print('❌ nasazení zastaveno:'); [print('   ' + c) for c in chyby]
    if os.environ.get('POVOL_NASAZENI') != '1': sys.exit(1)
    print('⚠️ POVOL_NASAZENI=1 → nasazuji přesto')
z = {'commit': head, 'mac': mac(), 'cas': datetime.now().strftime('%Y-%m-%d %H:%M')}
json.dump(z, open('site/nasazeno.json', 'w'), ensure_ascii=False)
print(f'✅ nasazuji {head[:8]} z {z["mac"]}')
