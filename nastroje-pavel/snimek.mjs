// Snímek mapy z lokálního náhledu pro kontrolu vzhledu (jeden pojmenovaný nástroj místo jednorázových skriptů,
// ať se nemusí pokaždé potvrzovat – Pavel 2026-11-16 „omez potvrzování“).
//   node nastroje-pavel/snimek.mjs <odkaz za #> <výstup.png> [šířka×výška] [x,y,š,v výřez] [bezui] [retina]
//   node nastroje-pavel/snimek.mjs leto@48.8487,17.1285,0.12 snimky/chodci.png 1200x800 450,250,300,300 bezui
// Vypíše chyby stránky a průměr statistiky chodců za 2 s (kolik se zkoušelo, schovalo za domy, nakreslilo; ms na snímek
// celkem a z toho ořez stromy a domy). „retina“ = dvojnásobné rozlišení jako na Macu s Retinou.
import { chromium } from 'playwright';
// „klik:<selektor>“ (i víckrát) před snímkem klikne na prvek, např. 'klik:#nbRail [data-tab=mista]' 'klik:.ver-urady > summary'
const arg = process.argv.slice(2), kliky = arg.filter((a) => a.startsWith('klik:')).map((a) => a.slice(5));
const volby = arg.filter((a) => a === 'bezui' || a === 'retina'), poz = arg.filter((a) => !volby.includes(a) && !a.startsWith('klik:'));
const [hash = 'leto', out = 'snimky/snimek.png', okno = '1200x800', vyrez] = poz;
const [w, h] = okno.split('x').map(Number);
const b = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const p = await (await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: volby.includes('retina') ? 2 : 1 })).newPage();
const chyby = []; p.on('pageerror', (e) => chyby.push(e.message));
await p.goto(`http://localhost:8000/#${hash}`, { waitUntil: 'load' }); await p.waitForTimeout(6000);
for (const k of kliky) { await p.click(k); await p.waitForTimeout(400); }
if (volby.includes('bezui')) await p.addStyleTag({ content: 'body > *:not(#map) { visibility: hidden !important; }' });
await p.waitForTimeout(600);
const clip = vyrez ? (([x, y, cw, ch]) => ({ x, y, width: cw, height: ch }))(vyrez.split(',').map(Number)) : undefined;
await p.screenshot({ path: out, clip });
const stat = await p.evaluate(() => new Promise((ok) => {
  const C = window.__izo && window.__izo.CHODCI; if (!C) return ok(null);
  const suma = {}; let n = 0; const t0 = performance.now();
  const krok = () => { for (const [k, v] of Object.entries(C.stat)) suma[k] = (suma[k] || 0) + v; n++;
    if (performance.now() - t0 < 2000) requestAnimationFrame(krok); else ok(Object.fromEntries(Object.entries(suma).map(([k, v]) => [k, +(v / n).toFixed(2)]))); };
  requestAnimationFrame(krok);
}));
console.log(out, JSON.stringify(stat), chyby.length ? 'chyby: ' + chyby.join(' | ') : 'bez chyb');
await b.close();
