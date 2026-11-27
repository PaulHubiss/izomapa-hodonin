// Kamery: „Ukázat na mapě“ přesune mapu a rozbliká ikonku nejbližšího místa (Pavel 2026-11-19: jako při výběru z Míst).
// node nastroje-pavel/test_kamery.mjs   (běžící náhled na :8000)
import { chromium } from './prohlizec.mjs';
const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: 1400, height: 900 } })).newPage();
const chyby = []; p.on('pageerror', (e) => chyby.push(e.message));
let ok = 0, spatne = 0;
const over = (co, v, info = '') => { v ? ok++ : spatne++; console.log(v ? '✅' : '❌', co, info === '' ? '' : `· ${info}`); };
await p.goto('http://localhost:8000/?kam#podzim', { waitUntil: 'load' }); await p.waitForTimeout(2500);
await p.click('#nbRail [data-tab="kamery"]');
await p.click('.nb-kamera .nb-odkaz >> nth=0');             // Masarykovo náměstí
await p.waitForTimeout(1200);
const r = await p.evaluate(() => ({ hash: location.hash, pohled: __izo.pohled(), vybrany: [...document.querySelectorAll('.pin.ikp.vybrany')].map((e) => e.textContent.trim() || e.title || e.getAttribute('aria-label')) }));
const [la, lo] = r.pohled.split(',').map(Number);
over('mapa míří na kameru', Math.abs(la - 48.8487) < 0.0006 && Math.abs(lo - 17.1285) < 0.0008, r.pohled);
over('adresa zůstane čistá (bez polohy)', r.hash === '', r.hash);
over('blikne právě jedna ikonka', r.vybrany.length === 1, JSON.stringify(r.vybrany));
over('chyby stránky', !chyby.length, chyby.join(' | '));
console.log(`\n${ok} v pořádku, ${spatne} špatně`);
await b.close();
process.exit(spatne ? 1 : 0);
