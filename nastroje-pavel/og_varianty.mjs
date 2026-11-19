// Náhled pro sdílení (og:image, Facebook) ve variantách k výběru (Pavel 2026-11-17):
//   node nastroje-pavel/og_varianty.mjs [A B C]      (běžící náhled na :8000) → snimky/og-<varianta>.jpg, 1200 × 630
// Mapa se nafotí z živé stránky (auta, lidé, v noci světla), bez ovládání a ikonek míst; titulek se sází v HTML
// (Source Sans 3 jako plakát a web) přes výřez a fotí se znovu. Vybraná varianta pak patří do site/og.jpg
// (build_html.py vlastní og.jpg nepřepíše), viz PROJEKT.md.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const KOREN = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const MESTO = JSON.parse(fs.readFileSync(path.join(KOREN, 'mesto.json'), 'utf8'));
const W = 1200, H = 630, WEB = 'hodonin.paulhubiss.cz';
const h1 = MESTO.h1 || ['Izometrický', MESTO.nazev];
// varianta: období a denní doba (token do adresy), střed, šířka výřezu v km, titulek ano/ne
const VARIANTY = {
  A: { kde: 'leto@48.8490,17.1282,0.75', titulek: false, cas: '2026-07-15T10:30:00+02:00' },
  B: { kde: 'podzim@48.8515,17.1255,1.25', titulek: true, cas: '2026-10-10T15:30:00+02:00' },
  C: { kde: 'leto-noc@48.8490,17.1282,0.85', titulek: true, cas: '2026-07-15T22:30:00+02:00' },
};
const vybrane = process.argv.slice(2).filter((v) => VARIANTY[v]);
const b = await chromium.launch({ args: ['--use-angle=metal'] });
for (const k of vybrane.length ? vybrane : Object.keys(VARIANTY)) {
  const v = VARIANTY[k];
  const p = await (await b.newContext({ viewport: { width: W, height: H } })).newPage();
  await p.clock.install({ time: new Date(v.cas) });                         // stejný okamžik = stejná auta a lidé při opakování
  await p.goto(`http://localhost:8000/?og=${k}#${v.kde}`, { waitUntil: 'load' });
  await p.addStyleTag({ content: 'body > *:not(#map) { display: none !important; } .pin, .here-pin { display: none !important; }' });
  for (let i = 0; i < 160; i++) { await p.clock.runFor(50); await p.waitForTimeout(40); }   // dlaždice a animace se rozjedou
  const mapa = await p.screenshot({ type: 'png' });
  await p.close();
  const out = path.join(KOREN, 'snimky', `og-${k}.jpg`);
  if (!v.titulek) { const q = await b.newPage({ viewport: { width: W, height: H } }); await q.setContent(`<body style="margin:0"><img src="data:image/png;base64,${mapa.toString('base64')}" style="display:block"></body>`); await q.screenshot({ path: out, type: 'jpeg', quality: 88 }); await q.close(); console.log(path.relative(KOREN, out)); continue; }
  const s = await b.newPage({ viewport: { width: W, height: H } });
  await s.setContent(`<!doctype html><html lang="cs"><head><meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Source+Sans+3:wght@300;400;600;700&display=swap">
<style>
  html, body { margin: 0; width: ${W}px; height: ${H}px; overflow: hidden; font-family: 'Source Sans 3', sans-serif; }
  .mapa { position: absolute; inset: 0; background: url(data:image/png;base64,${mapa.toString('base64')}) center / cover; }
  .pas { position: absolute; left: 0; right: 0; bottom: 0; padding: 120px 56px 44px;
    background: linear-gradient(to top, rgba(14,18,28,.88) 0%, rgba(14,18,28,.6) 55%, rgba(14,18,28,0) 100%); color: #f3efe6;
    display: flex; justify-content: space-between; align-items: baseline; gap: 40px; }
  h1 { margin: 0; font-size: 68px; line-height: 1; font-weight: 300; letter-spacing: -0.01em; white-space: nowrap; }
  h1 b { font-weight: 700; }
  .web { font-size: 26px; font-weight: 600; color: #f3efe6; white-space: nowrap; }
  .pod { margin-top: 10px; font-size: 24px; color: #c9cdd6; }
</style></head><body><div class="mapa"></div>
<div class="pas"><div><h1>${h1[0]} <b>${h1[1]}</b></h1><div class="pod">${MESTO.podtitul || ''}</div></div><div class="web">${WEB}</div></div></body></html>`);
  await s.evaluate(() => document.fonts.ready);
  await s.waitForTimeout(300);
  await s.screenshot({ path: out, type: 'jpeg', quality: 88 });
  await s.close();
  console.log(path.relative(KOREN, out));
}
await b.close();
