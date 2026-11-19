// Zvýraznění ulice z hledání (Pavel 2026-11-17): node nastroje-pavel/test_ulice.mjs   (běžící náhled na :8000)
// Napíše do hledání název ulice, vybere ji, ověří obtah (čáry z site/ulice.json), že výřez ukazuje celou ulici,
// a že klik do mapy zvýraznění zruší. Snímek obtahu do snimky/ulice-zvyrazneni.png (kontrola okem).
import { chromium } from './prohlizec.mjs';
import path from 'node:path';
const KOREN = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const ULICE = process.argv[2] || 'Národní třída';
const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: 1400, height: 900 } })).newPage();
const chyby = []; p.on('pageerror', (e) => chyby.push(e.message));
let ok = 0, spatne = 0;
const over = (co, v, info = '') => { v ? ok++ : spatne++; console.log(v ? '✅' : '❌', co, info === '' ? '' : `· ${info}`); };
await p.goto('http://localhost:8000/?ul#leto', { waitUntil: 'load' }); await p.waitForTimeout(3000);
await p.evaluate(() => { document.querySelector('.nb-tab[data-pane="hledat"], [data-pane="hledat"]')?.click(); });
await p.evaluate((u) => { const q = document.getElementById('q'); q.focus(); q.value = u; q.dispatchEvent(new Event('input')); }, ULICE);
await p.waitForTimeout(800);
const vysledky = await p.evaluate(() => [...document.querySelectorAll('#results li')].map((li) => li.textContent));
const i = vysledky.findIndex((t) => t.includes('ulice'));
over('hledání nabídne ulici', i >= 0, JSON.stringify(vysledky));
await p.evaluate((i) => document.querySelectorAll('#results li button')[i].click(), i);
await p.waitForTimeout(2500);
const s = await p.evaluate(() => {
  const U = window.__izo.ULICE.vyber, v = window.__izo.viewer.viewport, B = v.getBounds(true), W = window.__izo.W;
  if (!U) return null;
  const body = U.img.flat(), uvnitr = body.filter(([x, y]) => x / W >= B.x && x / W <= B.x + B.width && y / W >= B.y && y / W <= B.y + B.height).length;
  return { nazev: U.nazev, car: U.img.length, bodu: body.length, uvnitr };
});
over('ulice je zvýrazněná', s && s.car > 0, JSON.stringify(s));
over('výřez ukazuje celou ulici', s && s.uvnitr === s.bodu, s ? `${s.uvnitr} z ${s.bodu} bodů v okně` : '');
await p.evaluate(() => { document.getElementById('panel').style.visibility = 'hidden'; });
await p.screenshot({ path: path.join(KOREN, 'snimky', 'ulice-zvyrazneni.png') });
await p.mouse.click(1100, 450); await p.waitForTimeout(500);
over('klik do mapy zvýraznění zruší', await p.evaluate(() => window.__izo.ULICE.vyber === null));
over('chyby stránky', !chyby.length, chyby.join(' | '));
console.log(`\n${ok} v pořádku, ${spatne} špatně`);
await b.close();
process.exit(spatne ? 1 : 0);
