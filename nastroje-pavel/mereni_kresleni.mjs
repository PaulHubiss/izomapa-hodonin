// Kolik ms práce skriptu stojí jeden snímek mapy: node nastroje-pavel/mereni_kresleni.mjs [adresa …]   (PROHLIZEC=webkit = Safari)
// Porovnání dvou verzí: jedna na :8000, druhá (záloha složky site) třeba `python3 -m http.server 8001 --directory build/site-pred-…`.
// Měří se čas uvnitř requestAnimationFrame (kreslení vrstvy i OpenSeadragon) v klidu a při plynulém posunu, ve dne i v noci,
// v rozlišení Retiny. Snímek má 16,7 ms; střídá se pořadí adres, ať se nesrovnává teplý a studený počítač.
import { chromium, pripraveno } from './prohlizec.mjs';
const ADRESY = process.argv.slice(2).length ? process.argv.slice(2) : ['http://localhost:8000', 'http://localhost:8001'];
const MISTA = { 'náměstí 0,3 km den': 'leto@48.8487,17.1285,0.3', 'náměstí 0,3 km noc': 'leto-noc@48.8487,17.1285,0.3',
  'střed 0,6 km den': 'leto@48.8540,17.1260,0.6', 'střed 0,6 km noc': 'leto-noc@48.8540,17.1260,0.6', 'město 1,2 km noc': 'leto-noc@48.8540,17.1260,1.2' };
const b = await chromium.launch();
const med = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)], p95 = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length * 0.95)];
const vys = {};
for (let kolo = 0; kolo < 2; kolo++) for (const a of kolo ? [...ADRESY].reverse() : ADRESY) for (const [jm, hash] of Object.entries(MISTA)) {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  await ctx.addInitScript(() => {
    const raf = window.requestAnimationFrame.bind(window); let ted = null; window.__ms = [];
    window.requestAnimationFrame = (f) => raf((t) => { const t0 = performance.now(); f(t); const d = performance.now() - t0; if (ted === t) window.__ms[window.__ms.length - 1] += d; else { window.__ms.push(d); ted = t; } });
  });
  const p = await ctx.newPage();
  await p.goto(`${a}/#${hash}`, { waitUntil: 'load' }); await pripraveno(p, 2500);
  const klid = await p.evaluate(() => new Promise((ok) => { window.__ms.length = 0; setTimeout(() => ok([...window.__ms]), 3000); }));
  const posun = await p.evaluate(() => new Promise((ok) => {
    const v = window.__izo.viewer.viewport, w = v.getBounds(true).width, c = v.getCenter(true), t0 = performance.now(); window.__ms.length = 0;
    const krok = () => { const t = (performance.now() - t0) / 1000; if (t > 4) return ok([...window.__ms]);
      c.x += Math.sin(t * 3) * w / 250; v.panTo(c, true); requestAnimationFrame(krok); };
    requestAnimationFrame(krok);
  }));
  const r = ((vys[jm] ||= {})[a] ||= { klid: [], posun: [] }); r.klid.push(...klid.slice(5)); r.posun.push(...posun.slice(5));
  await ctx.close();
}
for (const [jm, r] of Object.entries(vys)) {
  console.log(jm);
  for (const a of ADRESY) console.log(`   ${a.padEnd(24)} klid ${med(r[a].klid).toFixed(1)} (95 % ${p95(r[a].klid).toFixed(1)})   posun ${med(r[a].posun).toFixed(1)} (95 % ${p95(r[a].posun).toFixed(1)}) ms`);
}
await b.close();
