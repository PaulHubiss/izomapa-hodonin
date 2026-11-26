// Ladění video.mjs: nastaví kameru jako video a vypíše, co stránka skutečně ukazuje (šířka výřezu v metrech, noc).
// node nastroje-pavel/video/zkus_pohled.mjs [m_na_px] [noc]
import { chromium } from 'playwright';
const M = +(process.argv[2] || 0.2), NOC = +(process.argv[3] || 0.6), LL = [48.8487, 17.1285];
const b = await chromium.launch({ args: ['--use-angle=metal'] });
const p = await (await b.newContext({ viewport: { width: 1080, height: 1080 } })).newPage();
await p.clock.install({ time: new Date('2026-12-10T16:30:00+01:00') });
await p.goto(`http://localhost:8000/#zima@${LL[0]},${LL[1]},0.5`, { waitUntil: 'domcontentloaded' });
for (let i = 0; i < 400; i++) { if (await p.evaluate(() => !!window.__izo && document.querySelector('#loading').hidden)) break; await p.clock.runFor(16); await p.waitForTimeout(25); }
const stav = () => p.evaluate(() => { const z = window.__izo, v = z.viewer.viewport;
  return { sirka_m: Math.round(v.getBounds(true).width * z.W * 0.2), zoom: v.getZoom(true).toFixed(3), cil: v.getZoom(false).toFixed(3), noc: document.querySelector('#night').value, stateNoc: z.state.night, realTime: document.querySelector('#realTime')?.checked,
    xmas: (() => { const w = z.viewer.world, r = []; for (let i = 0; i < w.getItemCount(); i++) { const it = w.getItemAt(i), u = String(it.source.url || it.source.tilesUrl || ''); if (u.includes('xmas')) r.push(`${u.slice(-30)} op=${it.getOpacity()}`); } return r; })(),
    xmasCheck: document.querySelector('#l-xmas')?.checked }; });
console.log('po načtení', await stav());
await p.evaluate(([lat, lon, m, n]) => { const z = window.__izo, v = z.viewer.viewport, [ix, iy] = z.ll2img(lat, lon);
  v.zoomTo(m * z.W / v.getContainerSize().x, null, true); v.panTo(new OpenSeadragon.Point(ix / z.W, iy / z.W), true);
  const e = document.querySelector('#night'); e.value = Math.round(n * 100); e.dispatchEvent(new Event('input')); }, [...LL, 0.2 / M, NOC]);
console.log('hned po nastavení (čekám 1080 / m_na_px =', Math.round(1080 * M), 'm)', await stav());
for (const ms of [100, 1000, 3000]) { await p.clock.runFor(ms); console.log(`po ${ms} ms`, await stav()); }
await b.close();
