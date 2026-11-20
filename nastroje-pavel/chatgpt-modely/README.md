# Modely památek přes ChatGPT (od 2026-11-20)

**Proč:** šetřit limit Claude. ChatGPT napíše modely (i opravy) podle podkladů, Claude jen přečte kód, vykreslí ho
v našem rendereru a pošle do dashboardu. Schvaluje dál jen Pavel.

## Postup

| krok | kdo | co |
|---|---|---|
| 1 | Claude | nové stavby: `pamatky/sestav.py --novy <slug> …`, `podklady_orto/laser/fotky/md.py <slug>` |
| 2 | Claude | `node nastroje-pavel/chatgpt-modely/zabal.mjs <slug> [<slug> …] [--oprava=a,b]` → `predani/chatgpt/<balik>.zip`, text k vložení, Finder |
| 3 | Pavel | zip do ChatGPT + text zadání, nechat pracovat, stáhnout `<balik>-od-chatgpt.zip` do Stažených souborů, napsat „hotovo“ |
| 4 | Claude | `node nastroje-pavel/chatgpt-modely/prevezmi.mjs <balik>` (rozbalí, zkouška každé stavby), **přečte kód** |
| 5 | Claude | `prevezmi.mjs <balik> --pouzij` → modely do `pamatky/`, poznámky jako `model.md`, náhled, snímky do dashboardu |
| 6 | Pavel | dashboard: Schváleno / Předělat s komentářem / Později |
| 7 | Claude | „Předělat“ → `zabal.mjs --oprava=<slug>` (komentář z dashboardu + snímky z rendereru) a znovu od kroku 3 |

**Balík** = jméno zipu: u jedné nové stavby její slug, u jedné opravy `<slug>-oprava`, jinak `davka-RRRR-MM-DD`
(nebo `--nazev=`). Dávka 3–5 staveb = jedno předání pro Pavla.

## Co je v balíčku

- Společné: `ZADANI.md` (šablona `sablona/ZADANI.md`: postup, pravidla, kontrolní seznam, formát poznámek, mantinely
  pro hledání fotek), `NAVOD.md` (= `pamatky/README.md`), `_kit.js`, `_drobne.js`, `vzory/` (schválené modely),
  `zkouska.mjs`, `nahled.py`.
- `stavby/<slug>/data/`: `M.json` a `teren.json` **přímo z rendereru** (Playwright místo modelu podstrčí výpis přes
  `page.route`), `pudorys.md` (půdorys v rámci `K.F`, strany světa, viditelnost, štítové zdi), `limity.json`.
- `stavby/<slug>/podklady/`: `podklad.md`, `orto.jpg`, `laser.json`, fotky z Commons. Vlastní fotky jen na Pavlův pokyn
  (`--fotky-navic=složka`, jen u jedné stavby).
- U opravy navíc `stavby/<slug>/oprava/`: `komentar.md` (z `rozhodnuti.json`, jinak `--komentar="…"`),
  `mapa_az225.png` atd. (náš renderer, `nahled.mjs --velky --zoom=1.6`), `predchozi-poznamky.md`; současný model v kořeni.
- `zkouska.mjs <slug>` (bez argumentu všechny): pád, NaN, trojúhelníky, body > 1 m mimo půdorys, zásah do souseda
  (tolerance 0,3 m), výška proti laseru, `K.dno`, **pevná čísla bodů půdorysu** (`P[17]`). `nahled.py <slug>`: shora
  s obrysem a ze čtyř stran (matplotlib, orientační, bez oken).

## Co smí ChatGPT na webu (zadání, Pavel 2026-11-20)

Commons, oficiální weby, Památkový katalog, články, **jen prohlížet**, ověřit, že jde o tutéž budovu, zdroje odkazem
v poznámkách. **Zakázané mapové služby** a jejich panoramata a 3D (Google, Mapy.cz, Apple, Bing). Co chybí, napíše.

## Pojistky

- Kód od ChatGPT je cizí program (spouští se při renderu). **`kontrola_kodu.mjs`** (pouští ho `prevezmi.mjs` sám) hlídá,
  že model používá jen M, K a matematiku: žádná síť, stránka, `eval`, cizí importy, nebezpečná jména v řetězcích.
  Celé Claude čte jen modely s ❌ a ty, u kterých zkouška hlásí něco divného (výška, přesahy). Kontrola je ověřená na
  schválně zlém souboru; první verze ho propustila (`//` v adrese uřízlo zbytek řádku jako komentář), opraveno 2026-11-20.
- `--pouzij` nic nepřepíše natvrdo: starý model a `model.md` zálohuje do `predani/chatgpt/<balik>/zalohy/`.
- `predani/` je mimo git (fotky z Commons, vše se vyrobí znovu `zabal.mjs`). Matplotlib je v `.venv` jen kvůli
  ověření `nahled.py` u nás.

## Zkušenosti

- **2026-11-20, ZŠ Mírové náměstí (`zakladni-skola`)** – první pilot (ještě stará verze balíčku, jedna stavba):
  ChatGPT 11 min, ani jednou „pokračuj“, sám 3 kola oprav podle `nahled.py`. Zkouška u nás bez chyb, v rendereru napoprvé
  dobrý model (10 329 trojúhelníků), Claude jen četl kód a pustil náhled. Slabina: pevná čísla bodů půdorysu (`P[17]`)
  → od té doby pravidlo v zadání a varování ve zkoušce. Pavlovi se model líbí.
- **2026-11-20, dávky B, C, D (17 staveb)** – všechny tři vráceny za ~1 h souběžně, zkouška bez chyb. ChatGPT u smuteční
  síně dohledal projektovou dokumentaci města (řez se špicí 18,5 m) a sám poznal, že fotky ze Commons jsou z Kyjova.
  Zkouška u soch hlásila nesmyslné přesahy (drobná památka nemá půdorys) → opraveno v šabloně.
- Po pilotu (Pavel): dávky víc staveb, opravné kolo přes ChatGPT, poznámky rovnou jako `model.md` s kontrolním
  seznamem, hledání fotek s mantinely.
