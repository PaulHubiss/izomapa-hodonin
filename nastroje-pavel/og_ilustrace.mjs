// Náhled pro sdílení (og:image, Facebook) s Pavlovou ilustrací v pozadí (Pavel 2026-11-18):
//   node nastroje-pavel/og_ilustrace.mjs [I1 I2 I3 I4] [--obr "podklady/….png"]   → snimky/og-<varianta>.jpg, 1200 × 630
// Ilustrace má jednobarevné tmavě modré pozadí, takže se do poměru 1,91 : 1 rozšíří stejnou barvou bez švu.
// I4 navíc přidá okno se skutečnou mapou (nafocenou z běžícího náhledu na :8000), ať náhled neslibuje jiný vzhled než mapa.
// Titulek se sází v HTML (Source Sans 3 jako web a plakát). Vybraná varianta patří do web/og.jpg (build_html.py ji zkopíruje).
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const KOREN = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const MESTO = JSON.parse(fs.readFileSync(path.join(KOREN, 'mesto.json'), 'utf8'));
const W = 1200, H = 630, WEB = 'hodonin.paulhubiss.cz';
const h1 = MESTO.h1 || ['Izometrický', MESTO.nazev];
const args = process.argv.slice(2);
const oi = args.indexOf('--obr');
const OBR = path.join(KOREN, oi >= 0 ? args[oi + 1] : 'podklady/Hodonínské náměstí s přístavištěm a sochou.png');
// barva pozadí ilustrace z rohu (ImageMagick), jí se plátno rozšíří
const roh = execFileSync('magick', [OBR, '-format', '%[pixel:p{5,5}]', 'info:']).toString().trim();
const bg = roh.replace(/^srgba?/, 'rgb');
const obr = `data:image/png;base64,${fs.readFileSync(OBR).toString('base64')}`;
const VARIANTY = ['I1', 'I2', 'I3', 'I4', 'I2a', 'I2b', 'I2c', 'I2d', 'I2e'];
const VYBRANA = 'I2c';   // ✅ Pavel 2026-11-18 („nechej I2c“)
const vybrane = args.filter((a) => VARIANTY.includes(a));

const b = await chromium.launch({ args: ['--use-angle=metal'] });
let mapa = null;
async function nafotMapu() {   // skutečná mapa: náměstí na podzim odpoledne, bez ovládání a ikonek
  const p = await (await b.newContext({ viewport: { width: 640, height: 400 } })).newPage();
  await p.clock.install({ time: new Date('2026-10-10T15:30:00+02:00') });
  await p.goto('http://localhost:8000/?og=I4#podzim@48.8487,17.1285,0.22', { waitUntil: 'load' });
  await p.addStyleTag({ content: 'body > *:not(#map) { display: none !important; } .pin, .here-pin { display: none !important; }' });
  for (let i = 0; i < 160; i++) { await p.clock.runFor(50); await p.waitForTimeout(40); }
  const png = await p.screenshot({ type: 'png' }); await p.close();
  return `data:image/png;base64,${png.toString('base64')}`;
}

// ikonky: Lucide globe a link (čára 2 px), kostička izomapy = ikona appky (site/favicon.svg)
const GLOBE = '<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>';
const LINK = '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>';
const ik = (s) => `<svg class="ik" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${s}</svg>`;
const kostka = (px) => `<svg class="kostka" style="width:${px}px;height:${px}px" viewBox="0 0 72 72"><rect width="72" height="72" rx="10" fill="#1b2333"/><path d="M36 15L61 27.5L36 40L11 27.5z" fill="#6fa84a"/><path d="M11 27.5L36 40L36 63L11 50.5z" fill="#8a6242"/><path d="M36 40L61 27.5L61 50.5L36 63z" fill="#684832"/></svg>`;
// pás dole: titulek přes celou šířku, pod ním podtitul vlevo a web vpravo na stejné účaří; volitelně ikona appky před titulkem
const pas2 = (web, predTitulkem = '') => `<img class="il" src="${obr}" style="height:${H}px;left:50%;top:0;transform:translateX(-50%)">
    <div class="pas2${predTitulkem ? ' s-ikonou' : ''}"><div class="t">${predTitulkem}${titulek(64)}</div><div class="pod">${MESTO.podtitul || ''}</div><div class="web2">${web}</div></div>`;
const titulek = (velikost) => `<h1 style="font-size:${velikost}px">${h1[0]} <b>${h1[1]}</b></h1>`;
const SABLONY = {
  // celá ilustrace na výšku, titulek a web v jednom řádku na tmavé obloze nahoře
  I1: () => `<img class="il" src="${obr}" style="height:560px;left:50%;bottom:0;transform:translateX(-50%)">
    <div class="radek" style="top:34px">${titulek(54)}<div class="web">${WEB}</div></div>`,
  // celá ilustrace, dole tmavý pás s titulkem a podtitulem jako vybraná varianta B
  I2: () => `<img class="il" src="${obr}" style="height:${H}px;left:50%;top:0;transform:translateX(-50%)">
    <div class="pas"><div>${titulek(64)}<div class="pod">${MESTO.podtitul || ''}</div></div><div class="web">${WEB}</div></div>`,
  // ilustrace vpravo, vlevo sloupec s titulkem pod sebou
  I3: () => `<img class="il" src="${obr}" style="height:480px;right:-10px;top:75px">
    <div class="sloupec"><h1 class="dva">${h1[0]}<br><b>${h1[1]}</b></h1><div class="pod">${MESTO.podtitul || ''}</div><div class="web">${WEB}</div></div>`,
  // I2a–e (Pavel 2026-11-18: „I2 nejvíc“): web na lince podtitulu („Město z…“), před ním ikonka odkazu a/nebo appky
  I2a: () => pas2(`${ik(GLOBE)}${WEB}`),
  I2b: () => pas2(`${ik(LINK)}${WEB}`),
  I2c: () => pas2(`${kostka(30)}${WEB}`),
  I2d: () => pas2(`${ik(GLOBE)}${WEB}`, `${kostka(56)}`),
  I2e: () => pas2(`${kostka(30)}${ik(GLOBE)}${WEB}`),
  // jako I1, navíc okno se skutečnou mapou vpravo dole
  I4: () => `<img class="il" src="${obr}" style="height:560px;left:50%;bottom:0;transform:translateX(-50%)">
    <div class="radek" style="top:34px">${titulek(54)}<div class="web">${WEB}</div></div>
    <figure class="okno"><img src="${mapa}"><figcaption>Takhle vypadá mapa</figcaption></figure>`,
};

for (const k of vybrane.length ? vybrane : VARIANTY) {
  if (k === 'I4' && !mapa) mapa = await nafotMapu();
  const s = await b.newPage({ viewport: { width: W, height: H } });
  await s.setContent(`<!doctype html><html lang="cs"><head><meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Source+Sans+3:wght@300;400;600;700&display=swap">
<style>
  html, body { margin: 0; width: ${W}px; height: ${H}px; overflow: hidden; background: ${bg}; font-family: 'Source Sans 3', sans-serif; color: #f3efe6; position: relative; }
  .il { position: absolute; display: block; }
  h1 { margin: 0; line-height: 1; font-weight: 300; letter-spacing: -0.01em; white-space: nowrap; }
  h1 b { font-weight: 700; }
  .web { font-size: 24px; font-weight: 600; white-space: nowrap; }
  .pod { margin-top: 10px; font-size: 23px; color: #c9cdd6; }
  .radek { position: absolute; left: 56px; right: 56px; display: flex; justify-content: space-between; align-items: baseline; gap: 40px;
    text-shadow: 0 2px 12px ${bg}; }
  .pas { position: absolute; left: 0; right: 0; bottom: 0; padding: 120px 56px 40px; display: flex; justify-content: space-between; align-items: baseline; gap: 40px;
    background: linear-gradient(to top, rgba(7,16,44,.92) 0%, rgba(7,16,44,.65) 55%, rgba(7,16,44,0) 100%); }
  .pas2 { position: absolute; left: 0; right: 0; bottom: 0; padding: 120px 56px 40px; display: grid; grid-template-columns: 1fr auto;
    align-items: baseline; column-gap: 40px;
    background: linear-gradient(to top, rgba(7,16,44,.92) 0%, rgba(7,16,44,.65) 55%, rgba(7,16,44,0) 100%); }
  .pas2 .t { grid-column: 1 / -1; display: flex; align-items: center; gap: 18px; }
  .pas2 .pod { font-size: 24px; margin-top: 12px; }
  .pas2.s-ikonou .pod { padding-left: 74px; }   /* pod text nadpisu, ne pod ikonu appky (56 px + mezera 18 px) */
  .web2 { font-size: 24px; font-weight: 600; white-space: nowrap; color: #f3efe6; }
  .web2 svg { vertical-align: -0.22em; margin-right: 9px; }
  .web2 .ik { width: 24px; height: 24px; }
  .web2 .kostka { vertical-align: -0.3em; }
  .sloupec { position: absolute; left: 56px; top: 0; bottom: 0; width: 360px; display: flex; flex-direction: column; justify-content: center; text-shadow: 0 2px 14px ${bg}; }
  .sloupec h1.dva { font-size: 66px; line-height: 1.02; }
  .sloupec .pod { font-size: 22px; margin-top: 16px; white-space: normal; max-width: 270px; }
  .sloupec .web { margin-top: 26px; font-size: 22px; color: #f2c94c; }
  .okno { position: absolute; right: 36px; bottom: 32px; margin: 0; width: 360px; border-radius: 10px; overflow: hidden;
    border: 3px solid #f3efe6; box-shadow: 0 10px 30px rgba(0,0,0,.55); background: #000; }
  .okno img { display: block; width: 100%; }
  .okno figcaption { position: absolute; left: 0; right: 0; bottom: 0; padding: 18px 12px 8px; font-size: 17px; font-weight: 600;
    background: linear-gradient(to top, rgba(7,16,44,.9), rgba(7,16,44,0)); }
</style></head><body>${SABLONY[k]()}</body></html>`);
  await s.evaluate(() => document.fonts.ready);
  await s.waitForTimeout(300);
  const out = path.join(KOREN, 'snimky', `og-${k}.jpg`);
  await s.screenshot({ path: out, type: 'jpeg', quality: 88 });
  await s.close();
  console.log(path.relative(KOREN, out));
  // vybraná varianta jde do web/og.jpg (v gitu, build_html.py ji zkopíruje do site/); Pavel 2026-11-18 vybral I2c
  if (k === VYBRANA) { fs.copyFileSync(out, path.join(KOREN, 'web/og.jpg')); console.log('→ web/og.jpg'); }
}
await b.close();
