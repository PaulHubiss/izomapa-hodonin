// Úsporný režim (Pavel 2026-11-17): přepínač v menu, ruční volba drží do zavření karty, automatika neměří při pohybu.
// node nastroje-pavel/test_usporny.mjs   (běžící náhled na :8000)
import { chromium } from 'playwright';
const b = await chromium.launch({ args: ['--use-angle=metal'] });
const p = await (await b.newContext({ viewport: { width: 1400, height: 900 } })).newPage();
const chyby = []; p.on('pageerror', (e) => chyby.push(e.message));
let ok = 0, spatne = 0;
const over = (co, v, info = '') => { v ? ok++ : spatne++; console.log(v ? '✅' : '❌', co, info === '' ? '' : `· ${info}`); };
const stav = () => p.evaluate(() => ({ box: document.getElementById('ecoBox').checked, mpr: window.__izo.viewer.minPixelRatio,
  item: window.__izo.viewer.world.getItemCount() ? window.__izo.viewer.world.getItemAt(0).minPixelRatio : null }));
await p.goto('http://localhost:8000/?u#leto', { waitUntil: 'load' }); await p.waitForTimeout(3000);
const kde = await p.evaluate(() => { const l = document.getElementById('ecoBox').closest('label'), pane = l.closest('.nb-pane');
  return { pane: pane && pane.dataset.pane, nadpis: l.parentElement.querySelector('.label')?.textContent }; });
over('přepínač je v panelu Vzhled, blok Výkon', kde.pane === 'vzhled' && kde.nadpis === 'Výkon', JSON.stringify(kde));
const s0 = await stav();
over('po startu vypnutý, plná kvalita', !s0.box && s0.mpr < 1, JSON.stringify(s0));
await p.evaluate(() => { document.getElementById('ecoBox').click(); });
const s1 = await stav();
over('přepínač zapne hrubší dlaždice', s1.box && s1.mpr >= 1.2 && s1.item >= 1.2, JSON.stringify(s1));
await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(3000);
const s2 = await stav();
over('ruční volba drží po obnovení', s2.box && s2.mpr >= 1.2, JSON.stringify(s2));
await p.evaluate(() => { document.getElementById('ecoBox').click(); });
const s3 = await stav();
over('vypnutí vrátí plnou kvalitu', !s3.box && Math.abs(s3.mpr - s0.mpr) < 1e-9 && Math.abs(s3.item - s0.item) < 1e-9, JSON.stringify(s3));
over('chyby stránky', !chyby.length, chyby.join(' | '));
console.log(`\n${ok} v pořádku, ${spatne} špatně`);
await b.close();
process.exit(spatne ? 1 : 0);
