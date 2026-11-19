// Tiskový plakát z mapy: node nastroje-pavel/plakat.mjs [--var autumn] [--pozadi svetle|tmave] [--sirka 700 --vyska 500]
// Vstup: build/plakat/mapa_<var>_4.png (nastroje-pavel/plakat_mapa.py). Výstup: plakaty/hodonin-<var>-<pozadi>-<š>x<v>.pdf
// (+ náhled .png). plakaty/ = zástupce na Google Disk.
//
// Sazba v HTML, PDF vytiskne Chromium: text zůstane vektorový (Source Sans 3 jako na webu), mapa se vloží bez
// převzorkování. Rozměry v mm, kolem dokola 3 mm spadávka (pozadí do ní přesahuje), obsah 30 mm od ořezu.
// Mapa je široká přesně jako sazební obrazec, titulek a patička začínají a končí na jejích hranách.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : d; };
const VAR = arg('var', 'autumn'), POZADI = arg('pozadi', 'svetle'), SIRKA = +arg('sirka', 700), VYSKA = +arg('vyska', 500);
const SPAD = 3, OKRAJ = 30;
const KOREN = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const MAPA = path.join(KOREN, 'build', 'plakat', `mapa_${VAR}_4.png`);
const MESTO = JSON.parse(fs.readFileSync(path.join(KOREN, 'mesto.json'), 'utf8'));
const OBDOBI = { spring: 'jaro', summer: 'léto', autumn: 'podzim', winter: 'zima' }[VAR] || VAR;
const BARVY = { svetle: { pozadi: '#f1ece2', text: '#1d2230', tlumene: '#6c6a66' }, tmave: { pozadi: '#1b2333', text: '#f3efe6', tlumene: '#9aa3b5' } }[POZADI];

// střed mapy jako zeměpisné souřadnice (stupně, minuty, vteřiny)
const dms = (v) => { const d = Math.floor(v), m = Math.floor((v - d) * 60), s = Math.round(((v - d) * 60 - m) * 60); return `${d}° ${String(m).padStart(2, '0')}′ ${String(s).padStart(2, '0')}″`; };
const [lon0, lat0] = MESTO.stred;                                       // mesto.json "stred" = [lon, lat] (jako geo.py)
const h1 = MESTO.h1 || ['Izometrický', MESTO.nazev];
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

const html = `<!doctype html><html lang="cs"><head><meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Source+Sans+3:wght@300;400;600;700&display=swap">
<style>
  @page { size: ${SIRKA + 2 * SPAD}mm ${VYSKA + 2 * SPAD}mm; margin: 0; }
  html, body { margin: 0; padding: 0; }
  body { width: ${SIRKA + 2 * SPAD}mm; height: ${VYSKA + 2 * SPAD}mm; background: ${BARVY.pozadi}; color: ${BARVY.text};
    font-family: 'Source Sans 3', sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .obrazec { position: absolute; left: ${SPAD + OKRAJ}mm; top: ${SPAD + OKRAJ}mm; width: ${SIRKA - 2 * OKRAJ}mm; height: ${VYSKA - 2 * OKRAJ}mm;
    display: flex; flex-direction: column; }
  header { display: flex; justify-content: space-between; align-items: baseline; }
  h1 { margin: 0; font-size: 26mm; line-height: 1; font-weight: 300; letter-spacing: -0.01em; }
  h1 b { font-weight: 700; }
  .podtitul { margin-top: 4mm; font-size: 6.5mm; color: ${BARVY.tlumene}; }
  .souradnice { font-size: 6.5mm; color: ${BARVY.tlumene}; text-align: right; font-variant-numeric: tabular-nums; }
  main { flex: 1; display: flex; align-items: center; }
  main img { width: 100%; height: auto; display: block; }
  footer { display: flex; justify-content: space-between; align-items: baseline; gap: 20mm; font-size: 3.4mm; line-height: 1.35; color: ${BARVY.tlumene}; }
  footer .web { font-size: 5mm; color: ${BARVY.text}; font-weight: 600; white-space: nowrap; }
</style></head><body><div class="obrazec">
  <header><div><h1>${esc(h1[0])} <b>${esc(h1[1])}</b></h1><div class="podtitul">${esc(MESTO.podtitul || '')} · ${OBDOBI}</div></div>
    <div class="souradnice">${dms(lat0)} s. š.<br>${dms(lon0)} v. d.</div></header>
  <main><img src="file://${MAPA}" alt=""></main>
  <footer><div>Mapová data © přispěvatelé OpenStreetMap (ODbL) a Overture Maps, terén Terrarium (AWS Open Data),
    výšky budov a stromů, ortofoto, ZABAGED a RÚIAN © ČÚZK (CC BY 4.0).<br>Vytvořeno nástrojem izomapa od Adama Klatovského (github.com/adamklatovsky/izomapa).</div>
    <div class="web">${esc((MESTO.url || 'hodonin.paulhubiss.cz').replace(/^https?:\/\//, '').replace(/\/$/, ''))}</div></footer>
</div></body></html>`;

const tmp = path.join(KOREN, 'build', 'plakat', 'plakat.html');
fs.writeFileSync(tmp, html);
const OUTDIR = path.join(KOREN, 'plakaty'); fs.mkdirSync(OUTDIR, { recursive: true });
const jmeno = path.join(OUTDIR, `hodonin-${VAR}-${POZADI}-${SIRKA}x${VYSKA}`);
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1400, height: 1000 } });
await p.goto(`file://${tmp}`, { waitUntil: 'networkidle' });
await p.evaluate(() => document.fonts.ready);
const pxMapy = await p.evaluate(() => document.querySelector('main img').naturalWidth);
await p.pdf({ path: `${jmeno}.pdf`, preferCSSPageSize: true, printBackground: true });
// náhled: celá strana na šířku 1600 px
const mm = 1600 / (SIRKA + 2 * SPAD);
await p.setViewportSize({ width: 1600, height: Math.round((VYSKA + 2 * SPAD) * mm) });
await p.addStyleTag({ content: `body { zoom: ${(mm / (96 / 25.4)).toFixed(4)}; }` });
await p.screenshot({ path: `${jmeno}-nahled.png` });
await b.close();
const dpi = Math.round(pxMapy / ((SIRKA - 2 * OKRAJ) / 25.4));
console.log(path.relative(KOREN, `${jmeno}.pdf`), (fs.statSync(`${jmeno}.pdf`).size / 1e6).toFixed(0), 'MB · mapa ~', dpi, 'dpi');
