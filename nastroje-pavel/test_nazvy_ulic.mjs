// Názvy ulic v mapě (izomapa 1.0, web/js/87-nazvy-ulic.js) a křížek v hledání: node nastroje-pavel/test_nazvy_ulic.mjs
// (běžící náhled na :8000). Názvy: výchozí vypnuté (Pavel 2026-11-25), po zapnutí zblízka jsou, zdálky ne, nepřekrývají se navzájem ani s ikonkami míst, vlastní přepínač
// (ne Příběhy), odkaz je nese. Křížek: skutečné kliknutí vyprázdní pole i výsledky a zmizí.
import { chromium, pripraveno } from './prohlizec.mjs';
import { sekce } from './sekce.mjs';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1400, height: 900 } });
await ctx.addInitScript(() => { window.__test = {}; });        // 87-nazvy-ulic.js sem zapisuje, co nakreslil
const p = await ctx.newPage();
const chyby = []; p.on('pageerror', (e) => chyby.push(e.message));
let ok = 0, spatne = 0;
const over = (co, v, info = '') => { v ? ok++ : spatne++; console.log(v ? '✅' : '❌', co, info === '' ? '' : `· ${info}`); };
const otevri = async (hash) => { await p.goto('about:blank'); await p.goto(`http://localhost:8000/#${hash}`, { waitUntil: 'load' }); await pripraveno(p, 1200); };
const ulice = () => p.evaluate(() => (window.__test.ulice || []).map((u) => ({ n: u.n, kk: u.kk })));

await otevri('leto@48.8487,17.1285,0.45');
over('na začátku jsou vypnuté', (await ulice()).length === 0 && !(await p.evaluate(() => document.getElementById('l-ulice').checked)));
await sekce(p, '#l-ulice'); await p.click('#l-ulice'); await p.waitForTimeout(900);
let u = await ulice();
over('zblízka jsou v mapě názvy ulic', u.length >= 3, `${u.length}: ${u.map((x) => x.n).join(', ')}`);
over('každá ulice nejvýš jednou', new Set(u.map((x) => x.n)).size === u.length);
over('názvy se nepřekrývají navzájem', u.every((a, i) => u.every((c, j) => i >= j || a.kk.every((k) => c.kk.every((l) => Math.hypot(k[0] - l[0], k[1] - l[1]) >= k[2] + l[2] - 1)))));
const prekryv = await p.evaluate(() => {
  const r = document.getElementById('fx').getBoundingClientRect(), out = [];
  for (const e of document.querySelectorAll('.pin.ikp')) {
    const q = e.getBoundingClientRect(); if (!q.width) continue;
    for (const x of window.__test.ulice) if (x.kk.some((k) => { const X = k[0] + r.left, Y = k[1] + r.top, dx = X - Math.max(q.left, Math.min(X, q.right)), dy = Y - Math.max(q.top, Math.min(Y, q.bottom)); return Math.hypot(dx, dy) < k[2] - 1; })) out.push(`${x.n} × ${e.dataset.nazev}`);
  }
  return { ikonek: [...document.querySelectorAll('.pin.ikp')].filter((e) => { const q = e.getBoundingClientRect(); return q.width && q.right > 0 && q.left < innerWidth && q.bottom > 0 && q.top < innerHeight; }).length, out };
});
over('názvy neleží na ikonkách míst', prekryv.ikonek > 5 && !prekryv.out.length, `${prekryv.ikonek} ikonek v okně ${prekryv.out.join(' | ')}`);

// přepínače skutečným kliknutím
await sekce(p, '#l-labels'); await p.click('#l-labels'); await p.waitForTimeout(500);
over('vypnuté Příběhy názvy ulic neschovají', (await ulice()).length >= 3);
await p.click('#l-labels');
over('přepínač Názvy ulic je vidět a má popis', await p.isVisible('#l-ulice') && await p.evaluate(() => document.getElementById('l-ulice').closest('label').textContent.trim() === 'Názvy ulic'));
await p.click('#l-ulice'); await p.waitForTimeout(400);
over('přepínač Názvy ulic je vypne', (await ulice()).length === 0);
await otevri('leto-sulicemi@48.8487,17.1285,0.45');
over('odkaz se slovem „sulicemi“ je zapne', (await ulice()).length >= 3 && await p.evaluate(() => document.getElementById('l-ulice').checked));
await p.click('#share'); const odkaz = await p.evaluate(() => decodeURIComponent(document.querySelector('#shareMenu [data-k="facebook"]').href)); await p.keyboard.press('Escape');
over('Sdílet zapnuté názvy ulic nese', odkaz.includes('sulicemi'), odkaz.slice(-60));
await otevri('leto-sulicemi@48.8487,17.1285,3');
over('zdálky názvy ulic nejsou', (await ulice()).length === 0);

// křížek v hledání
await sekce(p, '#q'); await p.waitForTimeout(300);
over('prázdné pole je bez křížku', !(await p.isVisible('#qClear')));
await p.fill('#q', 'Národní'); await p.waitForTimeout(900);
over('hledání má výsledky a křížek', await p.isVisible('#qClear') && await p.locator('#results li').count() > 0);
await p.click('#qClear'); await p.waitForTimeout(300);
over('křížek vyprázdní pole i výsledky a zmizí', await p.inputValue('#q') === '' && await p.locator('#results li').count() === 0 && !(await p.isVisible('#qClear')));

over('bez chyb na stránce', !chyby.length, chyby.join(' | '));
console.log(`\n${ok} v pořádku, ${spatne} špatně`);
await b.close();
process.exit(spatne ? 1 : 0);
