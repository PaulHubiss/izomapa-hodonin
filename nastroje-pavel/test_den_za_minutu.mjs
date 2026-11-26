// Den za minutu (web/js/68-den-za-minutu.js): node nastroje-pavel/test_den_za_minutu.mjs (běžící náhled na :8000)
// Vypínač ve Vzhledu (řádek jako „Podle skutečného času“, hodiny vedle něj, bez vyskakovací lišty) spustí ukázku: začíná ve 4:00
// v noci, čas běží 24 min za sekundu, ráno se rozední (denní doba ze slunce) a jezdí víc spojů MHD než ve 4:00. Vypnutí ukázku
// ukončí a vrátí denní dobu a „Podle skutečného času“.
import { chromium, pripraveno } from './prohlizec.mjs';
import { sekce } from './sekce.mjs';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1400, height: 900 } });
await ctx.addInitScript(() => { window.__test = {}; });
const p = await ctx.newPage();
const chyby = []; p.on('pageerror', (e) => chyby.push(e.message));
let ok = 0, spatne = 0;
const over = (co, v, info = '') => { v ? ok++ : spatne++; console.log(v ? '✅' : '❌', co, info === '' ? '' : `· ${info}`); };
await p.goto('http://localhost:8000/#leto@48.8487,17.1285,1.2', { waitUntil: 'load' }); await pripraveno(p, 1500);
const stav = () => p.evaluate(() => ({ h: window.__test.dzm?.h, noc: +document.getElementById('night').value, rt: document.getElementById('realTime').checked,
  lista: document.getElementById('dzm').checked, cas: document.getElementById('dzmCas').textContent, spoju: __izo.MHD.act?.length ?? 0 }));
const pred = await stav();
over('řádek s vypínačem je ve Vzhledu, vyskakovací lišta není', await p.evaluate(() => !document.getElementById('dzmRadek').hidden
  && document.getElementById('dzmRadek').closest('.daynight') && !document.getElementById('dzmLista')));
await sekce(p, '#dzm'); await p.click('#dzmRadek'); await p.waitForTimeout(400);
const s0 = await stav();
over('vypínač zapnutý a hodiny vedle něj běží', s0.lista && /^\d{1,2}:\d{2}$/.test(s0.cas), s0.cas);
over('hodiny jsou vidět (panel zůstal otevřený)', await p.evaluate(() => { const r = document.getElementById('dzmCas').getBoundingClientRect(); return r.width > 0 && r.right <= innerWidth; }));
over('začíná v noci (4:00)', s0.h < 4.5 && s0.noc >= 70, `h ${s0.h?.toFixed(2)}, noc ${s0.noc}`);
over('vypínač „Podle skutečného času“ se nepřepne', s0.rt === pred.rt, `${pred.rt} → ${s0.rt}`);
await p.waitForTimeout(13000);                              // ~5,2 h ukázky → kolem 9:15 (v listopadu svítá kolem 7:00)
const s1 = await stav();
over('čas běží (asi 24 min za sekundu)', s1.h > 8.6 && s1.h < 9.9, `h ${s1.h?.toFixed(2)}, hodiny ${s1.cas}`);
over('ráno je den (denní doba ze slunce)', s1.noc < 25, `noc ${s1.noc}`);
over('ráno jezdí víc spojů než ve 4:00', s1.spoju > s0.spoju, `${s0.spoju} → ${s1.spoju}`);
await sekce(p, '#dzm'); await p.click('#dzmRadek'); await p.waitForTimeout(300);
const s2 = await stav();
over('vypnutí ukázku ukončí a hodiny zmizí', !s2.lista && s2.cas === '', s2.cas);
over('vrátí denní dobu a skutečný čas, jak byly', s2.noc === pred.noc && s2.rt === pred.rt, `noc ${pred.noc} → ${s2.noc}, skutečný čas ${pred.rt} → ${s2.rt}`);
// posuvník denní doby během ukázky ji ukončí
await sekce(p, '#dzm'); await p.click('#dzmRadek'); await p.waitForTimeout(500);
await p.evaluate(() => { const n = document.getElementById('night'); n.value = 60; n.dispatchEvent(new Event('input', { bubbles: true })); });
await p.waitForTimeout(200);
const s3 = await stav();
over('posuvník denní doby ukázku ukončí a nechá ruční nastavení', !s3.lista && s3.noc === 60 && !s3.rt, `noc ${s3.noc}`);
over('chyby stránky', !chyby.length, JSON.stringify(chyby));
console.log(`\n${ok} v pořádku, ${spatne} špatně`);
await b.close(); process.exit(spatne ? 1 : 0);
