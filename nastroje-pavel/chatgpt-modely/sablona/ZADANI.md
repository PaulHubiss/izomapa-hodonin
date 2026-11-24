# Zadání: 3D modely staveb pro izometrickou mapu Hodonína (balíček `{BALIK}`)

Jsi modelář. Pro každou stavbu níž napiš **JavaScriptový model** do pixel-artové izometrické mapy města (styl SimCity 2000,
three.js). Dnes je stavba v mapě jen obecný kvádr z dat, tvůj model ji nahradí tak, aby ji lidé na mapě poznali.
Po tobě model zkontroluje a vykreslí další modelář a schválí ho autor mapy. **Musí běžet, sedět na půdorys a odpovídat
fotkám.** Pracuj samostatně až do konce všech staveb, na nic se neptej; co nevíš, napiš do poznámek.

## Stavby v tomto balíčku

{STAVBY}

**Nová** = model píšeš od začátku. **Oprava** = v kořeni balíčku už je `<slug>.js` (současná verze) a ve složce
`stavby/<slug>/oprava/` je komentář autora (`komentar.md`) a snímky z mapy (`*.png`, jak model vypadá ve skutečném
rendereru, s okny a stíny). Oprav přesně to, co komentář žádá, a zbytek modelu nech, jak je.

## Co máš v balíčku

| soubor | co to je |
|---|---|
| `ZADANI.md` | tohle zadání |
| `NAVOD.md` | návod nástroje: hlavně kapitoly **„Model: M a K“** a **„Pravidla pro modely“** |
| `_kit.js` | **stavebnice**: jediné funkce, které smíš použít (`K.box`, `K.hranol`, `K.okna`, `K.sedlo`…). Přečti ji celou. |
| `_drobne.js` | hotové drobné tvary (socha, kašna, kříž, pomník); import `import { socha } from './_drobne.js'` |
| `vzory/*.js` | **hotové schválené modely** jiných budov v tomtéž městě: nejlepší ukázka stylu, měřítka a stavebnice |
| `stavby/<slug>/data/M.json` | přesně ta data, která model dostane jako `M` (půdorys, terén, rám, sousedé) |
| `stavby/<slug>/data/pudorys.md` | **půdorys v souřadnicích rámce `K.F`** se stranami světa: podle něj stavíš |
| `stavby/<slug>/podklady/` | `podklad.md` (rozměry, výšky z laseru ČÚZK, adresa), `orto.jpg` (letecký snímek, **sever nahoře**, tyrkysově obrys), `fotky/` (Wikimedia Commons, autoři v `zdroje.json`) |
| `zkouska.mjs`, `nahled.py` | zkouška nanečisto a obrázek modelu (níž) |

## Jak postupovat (pro každou stavbu)

1. **Fotky:** prohlédni všechny. Některé můžou ukazovat **jinou budovu** (stejné jméno v jiné obci): porovnej s adresou
   a s tvarem na `orto.jpg` a do poznámek napiš, které fotky jsou opravdu tahle stavba.
2. **Chybí-li ti podstatný pohled** (hlavně od jihozápadu, odkud se dívá mapa), smíš hledat na webu, ale jen
   **Wikimedia Commons, oficiální weby** (obec, škola, firma, Památkový katalog pamatkovykatalog.cz) **a články o stavbě**.
   Fotky si jen prohlížej, do výsledku je nedávej. **Zakázané jsou mapové služby a jejich panoramata a 3D pohledy**
   (Google Maps / Street View / Earth, Mapy.cz, Apple Maps, Bing): jejich podmínky obkreslování zakazují.
   Každý zdroj, který jsi použil, uveď v poznámkách odkazem a ověř, že je to stejná budova. Co nenajdeš, napiš do „Co chybí“.
3. Napiš si krátký **popis stavby**: hmoty a jejich výšky, tvar a barva střech, počet pater, počet os oken a jejich tvar,
   římsy, vstup, sochy, barvy fasády. Co je vidět **od jihozápadu**, je nejdůležitější.
4. Přečti `_kit.js`, `NAVOD.md` (Model: M a K) a aspoň dva modely ve `vzory/`.
5. Napiš `<slug>.js` **do kořene balíčku** (vedle `_kit.js`): `export default function (M, K) { … }`.
6. **Zkoušej:** `node zkouska.mjs <slug>` (chyby, počet trojúhelníků, přesahy mimo půdorys a do sousedů, výška proti laseru),
   pak `python3 nahled.py <slug>` → `vystup/<slug>/nahled.png` (shora s obrysem půdorysu a ze čtyř stran). **Obrázek si
   opravdu prohlédni** a porovnej s fotkami ze stejné strany. Oprav a opakuj, dokud zkouška nehlásí ❌ a obrázek odpovídá
   fotkám (2–4 kola). Když `node` nemáš, napiš to do poznámek a model pečlivě zkontroluj čtením.
7. Projdi **kontrolní seznam** (níž) a napiš **poznámky** `<slug>.md`.

## Pravidla

- **Jen funkce ze `_kit.js`** (a `_drobne.js`). Nevymýšlej funkce, které tam nejsou; chybí-li ti něco, napiš si pomocnou
  funkci v modelu z `K.quad` / `K.tri` / `K.box`. Žádné jiné importy, žádné `fetch`, `window`, `document`, `eval`.
- **Souřadnice:** `K.F` je hlavní rámec, střed opsaného obdélníku, `s` podél delší strany (−L/2…L/2), `t` napříč, `h` výška
  nad terénem v metrech. Která strana rámce míří kam, je v `pudorys.md`. Zdi začínají na `K.dno` (pod terénem).
- **Zeď z bodu A do B má vnějšek VPRAVO od směru A → B** (polygon proti směru hodinových ručiček = vnějšek vpravo).
  Okna a dveře `K.okna(F, A, B, …)` na obrácené zdi skončí uvnitř budovy, kde nejsou vidět.
- **Body a hrany půdorysu hledej podle polohy a směru, ne podle pořadí.** Žádné `P[17]`: data z OpenStreetMap se mění
  a pořadí bodů s nimi. Použij `K.hrany(F, P)` (každá hrana má `sv` = strana světa, `L` délku, `divak` viditelnost,
  `soused` štítovou zeď) a vybírej třeba „nejdelší hrana s `sv` = 'JV'“ nebo bod nejblíž zadanému [s, t].
  Pevná čísla v metrech (výšky, odsazení, poloha vstupu podle fotky) jsou v pořádku.
- **Vyplň půdorys z dat** (`K.pudorys(0, F)`) a nezasahuj do sousedů (`M.okoli`). Přes půdorys smí přečnívat jen
  římsy, stříšky, schody, sochy.
- **Drobná památka bez budovy** (socha, pomník, kříž; v `M.json` je `budovy` prázdné): použij tvary z `_drobne.js`
  (`socha`, `pomnik`, `kriz`, `sokl`…), stojí v bodě `M.bod`. Bod z Wikidat bývá o pár metrů vedle: najdi památku na
  `orto.jpg` (červený křížek = bod, sever nahoře, měřítko vlevo dole) a posuň ji přes `o.ds` (m na východ) a `o.dt`
  (m na sever). Natoč ji `o.a` lícem ke skutečné straně (výchozí je k jihozápadu). Posun a jeho důvod napiš do poznámek.
  Laser drobné památky nezachytí, výšku odhadni z fotek (lidé na fotce ≈ 1,7 m).
- **Výška podle laseru** (`podklad.md`: p90/p98 ≈ hřeben nebo atika, medián ≈ okap u šikmé střechy); věže podle fotek.
- **Měřítko mapy {ROZLISENI}.** Rozhoduje silueta, tvar a barva střech, rytmus oken a říms, štíty, vstup, věžičky.
  Detaily pod ~{DETAIL} na mapě zmizí, nemodeluj je.
- **Nejvýš ~{LIMIT} trojúhelníků** na stavbu.
- **Barvy podle fotek, ale tlumené** (paleta mapy, ne syté). Tašky `#9c4a30`, břidlice `#4c535c`, plech `#7d8389`.
- Hlavní úsilí do jižní a západní fasády a střechy; odvrácené strany věrohodně a jednodušeji.

- **Stavba z víc budov** (`M.budovy` jich má víc): je to jedna stavba jednoho modelu. Projdi **všechny** budovy
  v `M.budovy` (cyklus, ne jen `K.pudorys(0)`), u každé si délku, počet sekcí a výšku vezmi z jejího půdorysu a laseru.
  Mapa se kreslí po čtvercích a v některém nemusí být v `M.budovy` všechny domy: nespoléhej na jejich počet ani pořadí
  a chybějící dům prostě vynech (model nesmí spadnout).
  Domy téhož typu mají stejné barvy, rytmus oken a lodžií; co se opravdu liší (barva po zateplení, tvar), rozliš podle fotek.
- **Vzory ze stejného sídliště:** je-li ve `vzory/` schválený model téhož typu domu ve stejném sídlišti, drž jeho podání
  (výška podlaží, okna, lodžie, atika, strojovny výtahů), ať sídliště působí jednotně. Barvy dál podle fotek.
- **Ověř, že půdorys patří k názvu stavby** (adresa, ortofoto, fotky). Když je přiřazená **jiná budova**, nebo stavbě
  **zjevně chybí část**, vymodeluj, co v datech je, a na **první řádek poznámek hned pod nadpis** napiš
  `⚠️ PÁROVÁNÍ: ` a jednou větou co je špatně a která budova (adresa, oid z `podklad.md`) je správně.

## Kontrolní seznam (před odevzdáním každé stavby)

1. `node zkouska.mjs <slug>` nehlásí ❌; každé ⚠️ je vysvětlené v poznámkách (např. „přesah = stříška vstupu“).
2. Žádná pevná čísla bodů půdorysu (`P[17]`), hrany vybrané podle směru a polohy.
3. Zdi od `K.dno`; štítové zdi u sousedů (`soused` > 0,5) bez oken.
4. Okna a dveře jsou na vnější straně zdí (v `nahled.png` vidět zvenku).
5. Výška sedí na laser; střecha má tvar a barvu jako na fotkách a ortofotu.
6. Fasáda od jihozápadu odpovídá fotkám (počet pater, rytmus oken, vstup).
7. U opravy: splněno vše z `komentar.md`, nic jiného se nerozbilo.

## Poznámky `<slug>.md` (formát pro schvalovací dashboard)

```markdown
# <Název stavby> – verze <1 nebo číslo opravy> (ChatGPT)

**Podle čeho:** které fotky z balíčku (a které NEJSOU tahle stavba), webové zdroje s odkazy, ortofoto, laser.
**Co je vymodelováno:** hmoty, výšky (okap, hřeben proti laseru), střechy, fasády, vstup, detaily. U opravy: co se změnilo.
**Co je nejisté:** co je odhad a proč.
**Co chybí:** pohledy nebo údaje, které by model zlepšily (např. „fotka ze severu“).
**Kontrolní seznam:** všechny body splněny / co ne a proč.
**Trojúhelníků:** číslo.

Výstup zkoušky:
(sem celý poslední výstup `node zkouska.mjs <slug>`)
```

## Co vrátit

**Jeden zip ke stažení `{BALIK}-od-chatgpt.zip`**, v něm pro každou stavbu dva soubory vedle sebe (bez složek):
`<slug>.js` a `<slug>.md`. Nic jiného. Když zip vytvořit nejde, vypiš všechny soubory celé do odpovědi, každý ve vlastním
bloku kódu s názvem souboru nad ním. Když tě omezí délka odpovědi, odevzdej hotové stavby a napiš, které zbývají.
