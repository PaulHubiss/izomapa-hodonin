// Zkouška karty budovy s údaji z katastru: node nastroje-pavel/test_karta.mjs [výstup.png]
// Najde v klikací vrstvě budovu s nejvíc byty, ukáže její kartu, vypíše řádky a odkazy a uloží snímek karty.
import { chromium } from './prohlizec.mjs';   // engine podle PROHLIZEC (chromium, webkit, firefox)
const out = process.argv[2] || 'snimky/test-karta.png';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1200, height: 800 } });
const chyby = [];
p.on('pageerror', (e) => chyby.push(e.message));
await p.goto('http://localhost:8000/', { waitUntil: 'load' });
await p.waitForTimeout(4000);
const r = await p.evaluate(async () => {
  let best = null;
  for (const k of ['c0_0', 'c-1_0', 'c0_1', 'c1_0']) {
    const d = await fetch(`overlay/${k}.json`).then((q) => (q.ok ? q.json() : null)).catch(() => null);
    for (const x of d?.buildings || []) if (x.kat?.byty && (!best || x.kat.byty > best.kat.byty)) best = x;
  }
  if (!best) return { chyba: 'budova s údaji nenalezena' };
  window.__izo.showBuilding(best);
  const dl = [...document.querySelectorAll('#cardDl dt')].map((dt) => `${dt.textContent}: ${dt.nextElementSibling.textContent}`);
  const odkazy = [...document.querySelectorAll('#cardLinks a')].map((a) => `${a.textContent} → ${a.href}`);
  return { nadpis: document.querySelector('#cardTitle').textContent, radky: dl, odkazy };
});
console.log(JSON.stringify(r, null, 1));
await p.locator('#card').screenshot({ path: out });
console.log('snímek karty:', out, '· chyby:', chyby.length ? chyby : 'žádné');
await b.close();
