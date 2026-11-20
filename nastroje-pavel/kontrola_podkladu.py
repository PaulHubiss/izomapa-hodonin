"""Kontrola podkladů mapy: sedí na aktuální mřížku, jsou v gitu celé a jak jsou čerstvé (Pavel 2026-11-18).

    .venv/bin/python nastroje-pavel/kontrola_podkladu.py            plný výpis (i síť: Overture, autor izomapy)
    .venv/bin/python nastroje-pavel/kontrola_podkladu.py --tise     jen problémy, bez sítě; nic = vše v pořádku
    .venv/bin/python nastroje-pavel/kontrola_podkladu.py razitko build/orto04    zapíše do mezipaměti, pro jakou mřížku je

Proč: 2026-11-18 na M5 dvě chyby stejného druhu, které nikdo nehlídal:
  1. obrázky masek lesa a zeleně šly do gitu bez své polohy (*.json) → stará poloha, les u zoo zmizel,
  2. mezipaměť ortofota (dlaždice pojmenované podle POLOHY V MAPĚ, ne na Zemi) zůstala ze staré mřížky →
     přepočet barev střech a zeleně poskládal špatné místo.
Obojí vzniká po posunu středu nebo změně čtverců (posun_stredu.py) a mezi M5 a M2 (git nepřenáší build/).

❌ = stavět ani nasazovat se nemá (návratový kód 1, aktualizuj.sh pak nenasadí). ⚠️ = stojí za obnovení.
Spouští se: při startu sezení (.claude/settings.json, --tise), před každou aktualizací webu (aktualizuj.sh, --tise)
a v plném výpisu přes `sh nastroje-pavel/aktualizuj.sh kontrola`.
"""
import datetime, glob, json, os, re, subprocess, sys, urllib.request
sys.path.insert(0, os.getcwd())
import geo

TISE = '--tise' in sys.argv
chyby, varovani, info = [], [], []


def mrizka():
    """otisk aktuální mřížky: střed, velikost čtverce a rozsah, pro který se staví masky a ortofoto"""
    return {'stred': geo.MESTO.get('stred'), 'polovina': geo.MESTO.get('polovina'),
            'rozsah': [round(float(v), 1) for v in geo.extent(geo.MARGIN + 20)]}


def git(*a):
    return subprocess.run(['git', *a], capture_output=True, text=True).stdout.strip()


if sys.argv[1:2] == ['razitko']:
    json.dump(mrizka(), open(os.path.join(sys.argv[2], '.mrizka.json'), 'w'))
    sys.exit()
if sys.argv[1:2] == ['plati']:                     # návratový kód 0 = mezipaměť má razítko aktuální mřížky
    r = os.path.join(sys.argv[2], '.mrizka.json')
    sys.exit(0 if os.path.exists(r) and json.load(open(r)) == mrizka() else 1)

M = mrizka()
X0, Y0, X1, Y1 = geo.extent(geo.MARGIN + 20)

# ── 1. masky lesa a zeleně: obrázek + poloha, obojí v gitu, poloha na aktuální mřížce ──
for n in ('les_maska', 'zelen_maska'):
    png, js = f'build/{n}.png', f'build/{n}.json'
    if not os.path.exists(png): varovani.append(f'{png} chybí (postaví se při stavbě)'); continue
    if not os.path.exists(js): chyby.append(f'{js} chybí – maska bez polohy'); continue
    x0, y1, m = json.load(open(js))['x0y1m']
    if abs(x0 - X0) > 1 or abs(y1 - Y1) > 1:
        chyby.append(f'{n}: poloha {x0:.0f} / {y1:.0f} m nesedí na mřížku ({X0:.0f} / {Y1:.0f}) – maska leží mimo mapu')
    from PIL import Image
    w, h = Image.open(png).size
    if (w, h) != (int((X1 - X0) / m), int((Y1 - Y0) / m)):
        chyby.append(f'{n}: rozměr {w}×{h} px nesedí na mřížku – maska je ze staré mřížky')
    for f in (png, js):
        if not git('ls-files', f): chyby.append(f'{f} není v gitu – druhý Mac ho nedostane (git add -f)')

# ── 2. mezipaměti pojmenované podle polohy v mapě (ortofoto): jen s razítkem aktuální mřížky ──
for d in ('build/orto04', 'build/orto'):
    if not os.path.isdir(d): continue
    r = os.path.join(d, '.mrizka.json')
    # bez razítka (vzniklo před 2026-11-18) = nejisté, nasazení ji nepoužívá → jen ⚠️; doplnky.sh ji před použitím zahodí
    if not os.path.exists(r):
        varovani.append(f'{d}/ nemá razítko mřížky (nejisté, odkud je) – doplnky.sh ji před použitím zahodí, nebo mv {d} ~/.Trash/')
    elif json.load(open(r)) != M:
        chyby.append(f'{d}/ je ze staré mřížky – dlaždice by poskládaly špatné místo; přesunout do Koše (mv {d} ~/.Trash/)')

# ── 3. data Overture stažená pro aktuální rozsah (fetch_data.py si ho pamatuje) ──
R = 'data_all/rozsah.json'
if os.path.exists(R) and json.load(open(R)) != [round(float(v), 6) for v in geo.bbox_lonlat(400)]:
    chyby.append('data Overture (data_all/) jsou pro jiný rozsah mapy – fetch_data.py --vse')

# ── 4. obrázek z build/ v gitu má v gitu i svou polohu se stejným jménem (x.png + x.json), i pro budoucí masky ──
for f in git('ls-files', 'build').splitlines():
    if not f.endswith(('.png', '.jpg', '.webp')): continue
    s = os.path.splitext(f)[0] + '.json'
    if os.path.exists(s) and not git('ls-files', s):
        chyby.append(f'{s} není v gitu, ale {f} ano – obrázek a jeho poloha by se mezi Macy rozešly')

# ── 5. všechny čtverce z mesto.json mají scénu a dlaždice ──
ctverce = [tuple(c) for c in geo.MESTO['ctverce']]
dlazdice = set((json.load(open('site/tiles.json')).get('chunks') or {})) if os.path.exists('site/tiles.json') else set()
for i, j in ctverce:
    k = f'c{i}_{j}'
    if not os.path.exists('build/scene.json' if (i, j) == (0, 0) else f'build/{k}/scene.json'): varovani.append(f'čtverec {i},{j} nemá scénu (./postav.sh)')
    elif (i, j) != (0, 0) and dlazdice and k not in dlazdice: varovani.append(f'čtverec {i},{j} nemá dlaždice (./postav.sh render)')

# ── 6. podklady změněné, ale nezacommitované (druhý Mac i nasazení by je minuly) ──
# název až za stavovým kódem: git() ořízne úvodní mezeru výstupu, takže první řádek „ M x“ přijde jako „M x“ (r[3:] pak ukousl písmeno)
zmeny = [r.split(None, 1)[-1] for r in git('status', '--porcelain', '--', 'assets', 'build', 'mesto.json', 'mista.json').splitlines()
         if not r.startswith('??')]
if zmeny: varovani.append('nezacommitované podklady: ' + ', '.join(zmeny[:6]) + (' …' if len(zmeny) > 6 else ''))

# ── 6b. automat zapnutý na TOMHLE Macu, ale od změny automat.sh ještě neběžel (2026-11-18: nová verze stahuje main;
#        stará by v neděli nahrála starou mapu) → připomenout ruční běh.
#        Od 2026-11-20 má automat běžet na OBOU Macích (Pavel: „zapínám/vypínám je různě“; nenasazuje sám, jen připraví),
#        takže Mac bez něj se ozve.
if not os.path.exists(os.path.expanduser('~/Library/LaunchAgents/cz.izomapa.aktualizace.plist')):
    varovani.append('automat na tomhle Macu není zapnutý (má běžet na M5 i M2) → sh nastroje-pavel/automat.sh zapnout')
else:
    zmena = git('log', '-1', '--format=%cs', '--', 'nastroje-pavel/automat.sh')
    LOG = 'build/aktualizace/automat.log'
    behy = re.findall(r'════ (\d{4}-\d{2}-\d{2})', open(LOG, encoding='utf-8').read()) if os.path.exists(LOG) else []
    # ruční běh píše do terminálu, ne do logu → od 2026-11-20 si čas běhu zapisuje i sám (posledni_beh)
    if os.path.exists('build/aktualizace/posledni_beh'): behy.append(open('build/aktualizace/posledni_beh').read()[:10])
    if zmena and (not behy or max(behy) < zmena):
        varovani.append(f'automat se změnil {zmena} a od té doby neběžel – spusť jednou ručně: sh nastroje-pavel/automat.sh beh '
                        '(stáhne main, přestaví mapu a připraví web k potvrzení; render jen změněných čtverců)')
# ── 6c. automat připravil nový web a čeká na Pavlovo potvrzení (2026-11-20: nenasazuje sám) ──
if os.path.exists('build/aktualizace/pripraveno'):
    kdy = open('build/aktualizace/pripraveno', encoding='utf-8').readline().strip()
    varovani.append(f'automat připravil nový web ({kdy}) a čeká na potvrzení – zeptej se Pavla, pak: sh nastroje-pavel/automat.sh nasad')

# ── 7. aktuálnost (jen v plném výpisu) ──
if not TISE:
    dnes = datetime.date.today()
    if os.path.exists('site/mhd.json'):
        s = json.load(open('site/mhd.json', encoding='utf-8'))['services']
        for vlak, jm in ((False, 'MHD (GTFS IDS JMK)'), (True, 'vlaky (CIS JŘ)')):
            do = max((v[2] for k, v in s.items() if k.startswith('V') == vlak), default=0)
            if not do: continue
            d = datetime.datetime.strptime(str(do), '%Y%m%d').date(); zb = (d - dnes).days
            (varovani if zb < 14 else info).append(f'{jm} platí do {d.day}. {d.month}. {d.year} (zbývá {zb} dní)'
                                                    + (' – sh nastroje-pavel/aktualizuj.sh' if zb < 14 else ''))
    try:
        sys.path.insert(0, 'nastroje'); import overture
        x = urllib.request.urlopen('https://overturemaps-us-west-2.s3.amazonaws.com/?list-type=2&prefix=release/&delimiter=/', timeout=30).read().decode()
        nove = sorted(set(re.findall(r'release/([0-9.-]+)/', x)))[-1]
        (info if nove == overture.VYDANI else varovani).append(
            f'Overture: nejnovější {nove}, šablona staví z {overture.VYDANI}'
            + ('' if nove == overture.VYDANI else ' – novější vydání: nové budovy a adresy (fetch_data.py --vse a ./postav.sh)'))
    except Exception as e:
        varovani.append(f'Overture: seznam vydání nejde načíst ({e})')
    if git('remote').count('upstream'):
        subprocess.run(['git', 'fetch', '-q', 'upstream'], capture_output=True)
        n = int(git('rev-list', '--count', 'HEAD..upstream/main') or 0)
        (varovani if n > 10 else info).append(f'autor izomapy: {n} nových commitů' + (' – sloučit (git merge upstream/main)' if n else ''))
    # podklady z OSM a dalších živých zdrojů: kdy se naposledy obnovily (datum posledního commitu)
    ZIVE = {'podniky.json': 'nastroje/podniky.py', 'verejna_mista.json': 'nastroje-pavel/verejna_mista.py',
            'pamatky.json': 'nastroje/pamatky.py', 'kominy.json': 'nastroje/kominy.py', 'prejezdy.json': 'nastroje/prejezdy.py',
            'hriste.json': 'nastroje/hriste.py', 'semafory.json': 'nastroje/semafory.py', 'zoo.json': 'nastroje-pavel/zoo.py',
            'ruian_budovy.json': 'nastroje/ruian.py'}
    for f, nastroj in ZIVE.items():
        p = f'assets/{f}'
        if not os.path.exists(p): continue
        kdy = git('log', '-1', '--format=%cs', '--', p) or datetime.date.fromtimestamp(os.path.getmtime(p)).isoformat()
        stari = (dnes - datetime.date.fromisoformat(kdy)).days
        (varovani if stari > 30 else info).append(f'{f}: obnoveno {kdy} ({stari} dní)' + (f' – {nastroj}' if stari > 30 else ''))

if TISE:
    for c in chyby: print('❌ podklady:', c)
    for v in varovani: print('⚠️ podklady:', v)
else:
    print('── Podklady mapy ──')
    for c in chyby: print('  ❌', c)
    for v in varovani: print('  ⚠️', v)
    for i in info: print('  ✅', i)
    if not chyby and not varovani: print('  ✅ mřížka, masky, mezipaměti a git v pořádku')
sys.exit(1 if chyby else 0)
