// Světové strany (Pavel 2026-11-20): node nastroje-pavel/test_strany.mjs   (běžící náhled na :8000)
// Při největším oddálení musí být písmena S V J Z celá v okně a mimo mapu (v prázdném rohu), sever vlevo nahoře,
// východ vpravo nahoře, jih vpravo dole, západ vlevo dole; zblízka se nekreslí. Snímky do snimky/strany-*.png (kontrola okem).
import { chromium } from './prohlizec.mjs';
const b = await chromium.launch();
let ok = 0, spatne = 0;
const over = (co, v, info = '') => { v ? ok++ : spatne++; console.log(v ? '✅' : '❌', co, info === '' ? '' : `· ${info}`); };
for (const [w, h, jm] of [[1400, 900, 'desktop'], [390, 844, 'mobil']]) {
  const p = await (await b.newContext({ viewport: { width: w, height: h } })).newPage();
  const chyby = []; p.on('pageerror', (e) => chyby.push(e.message));
  await p.goto('http://localhost:8000/#leto', { waitUntil: 'load' }); await p.waitForTimeout(3000);
  await p.evaluate(() => { const v = window.__izo.viewer.viewport; v.zoomTo(v.getMinZoom(), null, true); });
  await p.waitForTimeout(1500);
  const s = await p.evaluate(() => {
    const I = window.__izo, v = I.viewer.viewport, OS = window.OpenSeadragon;
    return I.STRANY.map((q) => { const t = v.pixelFromPoint(new OS.Point(q.xy[0] / I.W, q.xy[1] / I.W), true); return { p: q.p, x: Math.round(t.x), y: Math.round(t.y) }; });
  });
  const P = Object.fromEntries(s.map((q) => [q.p, q]));
  over(`${jm}: všechna 4 písmena v okně`, s.every((q) => q.x > 10 && q.y > 10 && q.x < w - 10 && q.y < h - 10), JSON.stringify(s));
  over(`${jm}: S vlevo nahoře, V vpravo nahoře, J vpravo dole, Z vlevo dole`,
    P.S.x < P.V.x && P.S.y < P.J.y && P.V.y < P.J.y && P.Z.x < P.J.x && P.S.x < w / 2 && P.V.x > w / 2 && P.J.y > h / 2 && P.Z.y > h / 2);
  await p.screenshot({ path: `snimky/strany-${jm}.png` });
  over(`${jm}: bez chyb na stránce`, !chyby.length, chyby.join(' | '));
  await p.close();
}
await b.close();
console.log(`\n${ok} ✅ · ${spatne} ❌`);
process.exit(spatne ? 1 : 0);
