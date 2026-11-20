# Izometrický Hodonín – kód upravené verze izomapy

Tohle je **zdrojový kód mapy [Izometrický Hodonín](https://hodonin.paulhubiss.cz)**, upravené verze nástroje
[izomapa](https://github.com/adamklatovsky/izomapa) od Adama Klatovského. Zveřejněný je kvůli licenci
**AGPL-3.0** (soubor `LICENSE`): kdo izomapu upraví a pustí jako web, zveřejní i svoje úpravy.

- Původní nástroj a návod: [adamklatovsky/izomapa](https://github.com/adamklatovsky/izomapa), ukázka [izomapa.fun](https://izomapa.fun).
- Úpravy pro Hodonín: Paul Hubiss. Hlavní části navíc: `web/nase.js` a `web/nase.css` (menu, nápověda, formulář),
  `worker/` (Cloudflare Worker: hlášení nepřesností, formulář, prostředníci z `functions/api/`), `nastroje-pavel/`.
- **Není tu:** data a podklady města (`assets/`, `build/`, texty míst), pracovní poznámky a obrázky. Mapu z tohoto
  kódu postavíte podle autorova README pro svoje město.

Aktualizuje se automaticky při každém nasazení webu. Poslední stav: commit `eeb879b` z 2026-11-20.
