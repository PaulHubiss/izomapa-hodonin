// Zkouška doplňku Santa se soby (doplnky/santa/): node nastroje-pavel/test_santa.mjs   (běžící náhled na :8000)
// Datum 1. 12. (doba výzdoby): zimní mapa → přelet, saně na obrazovce, klik = sledování, × sledování vypne, dárek do komína,
// na podzim Santa nelétá. Okamžitý přelet přes window.__santa (jen localhost).
import { chromium, pripraveno } from './prohlizec.mjs';
const b = await chromium.launch();
let ok = 0, spatne = 0;
const over = (co, v, info) => { v ? ok++ : spatne++; console.log(v ? '✅' : '❌', co, info === undefined ? '' : `· ${JSON.stringify(info)}`); };
const chyby = [];
const p = await (await b.newContext({ viewport: { width: 1200, height: 800 } })).newPage(); p.on('pageerror', (e) => chyby.push(e.message));
await p.clock.install({ time: new Date('2026-12-01T12:00:00') });
await p.goto('http://localhost:8000/#zima@48.8545,17.1260,0.6', { waitUntil: 'load' }); await pripraveno(p);
await p.waitForFunction(() => window.__santa, null, { timeout: 15000 });
const stav = () => p.evaluate(() => window.__santa.stav());

over('doplněk načtený, komíny pro dárky', (await stav()).kominu > 1000, (await stav()).kominu);
// přelet: saně rovnou kousek před středem výřezu
await p.evaluate(() => window.__santa.pust(700)); await p.waitForTimeout(800);
let s = await stav();
const naObr = (q) => q.posl && q.posl[2] > 0 && q.posl[0] < 1200 && q.posl[3] > 0 && q.posl[1] < 800;
over('přelet: saně na obrazovce', s.let && naObr(s), s);
// klik na saně = sledování (dráha je náhodná, klik může padnout na ikonku místa, která ho zachytí → až 3 pokusy)
for (let i = 0; i < 3; i++) {
  s = await stav(); if (!s.posl || s.sleduj) break;
  await p.mouse.click((s.posl[0] + s.posl[2]) / 2, (s.posl[1] + s.posl[3]) / 2); await p.waitForTimeout(600);
  if (!(await stav()).sleduj) { await p.evaluate(() => document.getElementById('cardClose')?.click()); await p.evaluate(() => window.__santa.pust(700)); await p.waitForTimeout(800); }
}
const lista = await p.evaluate(() => ({ vidno: !document.getElementById('follow').hidden, txt: document.getElementById('followTxt').textContent }));
s = await stav();
over('klik na saně: sledování a lišta nahoře', s.sleduj && lista.vidno && lista.txt.startsWith('🎅'), { sleduj: s.sleduj, ...lista });
over('při sledování drží kamera saně uprostřed', naObr(s) && Math.abs((s.posl[0] + s.posl[2]) / 2 - 600) < 120, s.posl);
// dárek
await p.evaluate(() => window.__santa.dar()); await p.waitForTimeout(200);
over('dárek padá do komína', (await stav()).darku >= 1, await stav());
await p.click('#followStop'); await p.waitForTimeout(200);
over('× sledování vypne', !(await stav()).sleduj && await p.evaluate(() => document.getElementById('follow').hidden));
// podzim: bez Santy
await p.evaluate(() => document.querySelector('[data-s="autumn"]').click()); await p.waitForTimeout(400);
over('na podzim Santa nelétá', !(await stav()).let, await stav());
over('chyby stránky', !chyby.length, chyby);

console.log(`\n${ok} v pořádku, ${spatne} špatně`);
await b.close();
process.exit(spatne ? 1 : 0);
