# Jsou dlaždice v site/tiles vykreslené z TOHO, co je teď v gitu? Pojistka před nasazením.
#   .venv/bin/python nastroje-pavel/kontrola_dlazdic.py     ✅ / ❌ + které čtverce; při ❌ končí kódem 1
#
# Proč (2026-11-20): automat na M2 nasadil dlaždice z 15. 11. přes čerstvý web z M5 s 29 památkami. Dlaždice
# nejsou v gitu, takže každý Mac má svoje – a nasazení z Macu, který nevykreslil to, co je v gitu, vrátí web zpátky.
#
# Dvě zkoušky na čtverec:
#  1. otisk renderu (nastroje/otisk.py: scéna, kód renderu, rozlišení, schválené modely památek) = otisk uložený
#     u dlaždic (build/…/otisk_renderu). Nesedí, nebo chybí = dlaždice jsou z jiných vstupů.
#  2. scéna není starší než vstupy prep.py (prep.py, geo.py, mesto.json, assets/, vršky památek). Po git pull mají
#     změněné soubory čas stažení, takže novější vstup = scéna se po stažení nepřestavěla a otisk by ji nepoznal.
#     Může hlásit planě (změna souboru, který scénu neovlivní); pak ./postav.sh render nic nekreslí a je hotovo za pár minut.
# Oprava v obou případech: ./postav.sh render (kreslí jen čtverce, které to potřebují).
# Vědomé obejití: POVOL_STARE_DLAZDICE=1 sh nastroje-pavel/aktualizuj.sh nasad
import glob, os, subprocess, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import geo

# soubory v assets/, které čte až overlay.py nebo prohlížeč, ne prep.py (jejich změna scénu nemění)
JEN_PROHLIZEC = {'assets/podniky.json', 'assets/verejna_mista.json', 'assets/verejna_mista_rucne.json',
                 'assets/pamatky.json', 'assets/zoo.json', 'assets/semafory.json', 'assets/prejezdy.json'}
vstupy = ['prep.py', 'geo.py', 'mesto.json', 'pamatky/vrsky.json', 'pamatky/schvalene.json']
vstupy += [f for f in glob.glob('assets/**/*', recursive=True) if os.path.isfile(f) and f not in JEN_PROHLIZEC]
vstupy = [f for f in vstupy if os.path.exists(f)]
nejnovejsi = max(vstupy, key=os.path.getmtime)

vady = []
for i, j in (tuple(c) for c in geo.MESTO['ctverce']):
    d = 'build' if (i, j) == (0, 0) else f'build/c{i}_{j}'
    scena, ulozeny = f'{d}/scene.json', f'{d}/otisk_renderu'
    if not os.path.exists(scena):
        vady.append(f'{i},{j}: chybí scéna'); continue
    if not os.path.exists(ulozeny):
        vady.append(f'{i},{j}: dlaždice bez otisku (nevykreslené celé, nebo nevíme z čeho)'); continue
    if os.path.getmtime(nejnovejsi) > os.path.getmtime(scena):
        vady.append(f'{i},{j}: scéna je starší než {nejnovejsi} (po stažení se nepřestavěla)'); continue
    otisk = subprocess.run([sys.executable, 'nastroje/otisk.py', f'{i},{j}'], capture_output=True, text=True, check=True).stdout.strip()
    if open(ulozeny, encoding='utf-8').read().strip() != otisk:
        vady.append(f'{i},{j}: dlaždice jsou z jiných vstupů, než jsou teď v gitu (kód renderu, modely památek, scéna)')

if vady:
    print('❌ dlaždice neodpovídají gitu – nenasazovat, nejdřív ./postav.sh render:')
    for v in vady: print('   ' + v)
    sys.exit(1)
print(f'✅ dlaždice odpovídají gitu ({len(geo.MESTO["ctverce"])} čtverců)')
