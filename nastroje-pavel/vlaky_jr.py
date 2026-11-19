"""Vlaky z celostátního jízdního řádu přes přelom roků: stáhne platné JR<rok>.zip a spojí je do build/vlaky/vlaky.json.

    .venv/bin/python nastroje-pavel/vlaky_jr.py

Proč: autorův nastroje/vlaky_vyber.py bere jen jeden (nejnovější) JR*.zip. Nový jízdní řád ale vychází na portálu
několik týdnů před platností (JR2027 platí od 13. 12. 2026) – kdyby se vzal jen ten, zmizely by z mapy vlaky do 12. 12.
Každý vlak má vlastní kalendář (bitmapa dnů), takže stačí výběry z obou ročníků spojit; prohlížeč si vybere podle data.

Co dělá:
  1. zjistí na portal.cisjr.cz ročníky, stáhne chybějící JR<rok>.zip pro letošek a dál (prázdná složka = ještě nevyšel),
  2. pro každý ročník, který ještě neskončil, pustí nastroje/vlaky_vyber.py a výběry spojí,
  3. pustí nastroje/vlaky.py (→ build/vlaky/vlaky_mhd.json, mhd.py ho přidá k autobusům).
Ročník Y končí druhou sobotou v prosinci Y (změna jízdních řádů), pak se vynechá.

⚠️ Změny během roku (PA_*.xml v měsíčních složkách portálu) vlaky_vyber.py nezapočítává (výluky, nové spoje).
"""
import datetime, glob, json, os, re, subprocess, sys

PORTAL = 'https://portal.cisjr.cz/pub/draha/celostatni/szdc/'
D = 'build/vlaky/'
PY = sys.executable
dnes = datetime.date.today()


def konec_rocniku(rok):
    """Poslední den platnosti JR<rok>: sobota po druhé neděli v prosinci (JR2026 končí 12. 12. 2026)."""
    d = datetime.date(rok, 12, 1)
    nedele = d + datetime.timedelta(days=(6 - d.weekday()) % 7)        # první neděle v prosinci
    return nedele + datetime.timedelta(days=6)                          # sobota před druhou nedělí


def curl(url, *args):
    return subprocess.run(['curl', '-sfL', '-m', '600', '--retry', '3', *args, url], capture_output=True, text=not args, check=False)


os.makedirs(D, exist_ok=True)
r = curl(PORTAL)
roky = sorted({int(y) for y in re.findall(r'/szdc/(\d{4})/', r.stdout or '')}) if r.returncode == 0 else []
if not roky: print('⚠️ portál CIS JŘ neodpověděl, beru jen stažené ročníky')
for rok in roky:
    if rok < dnes.year or os.path.exists(f'{D}JR{rok}.zip'): continue
    if f'JR{rok}.zip' not in (curl(f'{PORTAL}{rok}/').stdout or ''):
        print(f'JR{rok}: na portálu zatím není'); continue
    print(f'JR{rok}: stahuji…', flush=True)
    if curl(f'{PORTAL}{rok}/JR{rok}.zip', '-o', f'{D}JR{rok}.zip.tmp').returncode: sys.exit(f'JR{rok}: stažení selhalo')
    os.replace(f'{D}JR{rok}.zip.tmp', f'{D}JR{rok}.zip')

platne = [z for z in sorted(glob.glob(f'{D}JR*.zip')) if konec_rocniku(int(re.search(r'JR(\d{4})', z)[1])) >= dnes]
if not platne: sys.exit('⚠️ žádný platný jízdní řád vlaků – stáhni JR<rok>.zip z ' + PORTAL)
vse = []
for z in platne:
    subprocess.run([PY, 'nastroje/vlaky_vyber.py', z], check=True, stdout=subprocess.DEVNULL)
    v = json.load(open(f'{D}vlaky.json', encoding='utf-8'))
    print(f'{os.path.basename(z)}: {len(v)} vlaků přes mapu (platí do {konec_rocniku(int(re.search(r"JR(\d{4})", z)[1])):%-d. %-m. %Y})')
    vse += v
json.dump(vse, open(f'{D}vlaky.json', 'w', encoding='utf-8'), ensure_ascii=False)
subprocess.run([PY, 'nastroje/vlaky.py'], check=True, stdout=subprocess.DEVNULL)
print('vlaky_mhd.json hotové,', len(vse), 'vlaků celkem')
