"""Zveřejní kód naší verze mapy do veřejného forku (licence AGPL-3.0, Pavel 2026-11-19).

    .venv/bin/python nastroje-pavel/zverejni_kod.py          nahraje změny (pouští ho aktualizuj.sh nasad)
    .venv/bin/python nastroje-pavel/zverejni_kod.py --seznam jen vypíše, co by šlo ven

Proč: autor v README (ř. 192) a licence AGPL chtějí, aby kdo upraví izomapu a pustí ji jako web, zveřejnil i úpravy.
Fork https://github.com/PaulHubiss/izomapa-hodonin dostane jen KÓD. Ven NEjdou deníky, poznámky, úkoly, návrhy,
podklady a data města (assets/, build/, texty míst), Pavlova ilustrace pro sdílení ani logo města – seznam SKRYT.
⚠️ Nový soukromý soubor nebo složka v kořeni → přidat do SKRYT dřív, než se pustí nasazení.
Klon forku leží v build/verejny-kod/ (mimo git). Selhání nenasazení nezastaví (aktualizuj.sh jen varuje).
"""
import re, shutil, subprocess, sys, datetime
from pathlib import Path

KOREN = Path(__file__).resolve().parent.parent
FORK = 'https://github.com/PaulHubiss/izomapa-hodonin.git'
KLON = KOREN / 'build' / 'verejny-kod'
SKRYT = re.compile(r'^(\.claude|archiv|assets|build|dokumenty|napady|navrhy|sessions|volby|ladeni|plakaty|videa|snimky|podklady|fotky)/'
                   r'|^(CHYBY-CLAUDA|POZNAMKY|PROJEKT|STRANKY|TESTY|UKOLY|ZKRATKY)\.md$'
                   r'|^(mista|poznamky)\.json$'
                   r'|^web/(og\.jpg|logo-hodonin\.svg)$')

POPIS = """# Izometrický Hodonín – kód upravené verze izomapy

Tohle je **zdrojový kód mapy [Izometrický Hodonín](https://hodonin.paulhubiss.cz)**, upravené verze nástroje
[izomapa](https://github.com/adamklatovsky/izomapa) od Adama Klatovského. Zveřejněný je kvůli licenci
**AGPL-3.0** (soubor `LICENSE`): kdo izomapu upraví a pustí jako web, zveřejní i svoje úpravy.

- Původní nástroj a návod: [adamklatovsky/izomapa](https://github.com/adamklatovsky/izomapa), ukázka [izomapa.fun](https://izomapa.fun).
- Úpravy pro Hodonín: Paul Hubiss. Hlavní části navíc: `web/nase.js` a `web/nase.css` (menu, nápověda, formulář),
  `worker/` (Cloudflare Worker: hlášení nepřesností, formulář, prostředníci z `functions/api/`), `nastroje-pavel/`.
- **Není tu:** data a podklady města (`assets/`, `build/`, texty míst), pracovní poznámky a obrázky. Mapu z tohoto
  kódu postavíte podle autorova README pro svoje město.

Aktualizuje se automaticky při každém nasazení webu. Poslední stav: {stav}.
"""


def git(*a, cwd=KOREN):
    return subprocess.run(['git', *a], cwd=cwd, capture_output=True, text=True, check=True).stdout


def seznam():
    return [f for f in git('ls-files', '-z').split('\0') if f and not SKRYT.search(f)]


def main():
    soubory = seznam()
    if '--seznam' in sys.argv:
        print('\n'.join(soubory)); print(f'\n{len(soubory)} souborů', file=sys.stderr); return
    if not (KLON / '.git').exists():
        KLON.parent.mkdir(parents=True, exist_ok=True)
        git('clone', '-q', FORK, str(KLON))
    git('pull', '-q', '--ff-only', cwd=KLON)
    chceme = set(soubory) | {'HODONIN.md'}
    for f in git('ls-files', '-z', cwd=KLON).split('\0'):        # co ve forku je, ale u nás ne (smazané, nebo SKRYT)
        if f and f not in chceme:
            (KLON / f).unlink(missing_ok=True)
    for f in soubory:
        z, c = KOREN / f, KLON / f
        if z.is_symlink() or not z.exists():
            continue
        c.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(z, c)
    nas = git('log', '-1', '--format=%h %cs').strip()
    (KLON / 'HODONIN.md').write_text(POPIS.format(stav=f'commit `{nas.split()[0]}` z {nas.split()[1]}'), encoding='utf-8')
    git('add', '-A', cwd=KLON)
    if not git('status', '--porcelain', cwd=KLON).strip():
        print('veřejný kód: beze změny'); return
    git('-c', 'user.name=Paul Hubiss', '-c', 'user.email=PaulHubiss@users.noreply.github.com',
        'commit', '-q', '-m', f'Izometrický Hodonín: stav k {nas} ({datetime.date.today()})', cwd=KLON)
    git('push', '-q', 'origin', 'HEAD', cwd=KLON)
    print(f'veřejný kód: nahráno ({len(soubory)} souborů) → {FORK[:-4]}')


if __name__ == '__main__':
    main()
