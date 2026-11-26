// Ladění: co zakrývá autobusy a tramvaje (ořez drawBehindTrees) v okolí bodu, v zimě a v létě (Pavel 2026-11-26: u náměstí
// je vidět jen číslo linky, autobus naskakuje a mizí). Do zkušební kopie stránky vloží záznam tvarů ořezu u každého vozu MHD.
//   node nastroje-pavel/zkus_zakryti_mhd.mjs [lat lon] [sekund]
import { chromium } from 'playwright';
const LL = [+(process.argv[2] || 48.8487), +(process.argv[3] || 17.1285)], SEK = +(process.argv[4] || 120);
const b = await chromium.launch({ args: ['--use-angle=metal'] });
// čas = dnes 14:00 (GTFS IDS JMK sahá jen ~měsíc dopředu, jinak by nejezdilo nic); období jen z adresy
const dnes = new Date(); dnes.setHours(14, 0, 0, 0);
for (const [obdobi, cas] of [['zima', dnes], ['leto', dnes]]) {
  const ctx = await b.newContext({ viewport: { width: 1400, height: 1000 } });
  await ctx.route((u) => u.pathname === '/', async (r) => {
    const res = await r.fetch(); let t = await res.text();
    const A = 'out.push([3, b.hull]);', B = 'drawBehindTrees(spr.c, base[0] + spr.x0, base[1] + spr.y0, spr.c.width, spr.c.height, cxw, cyw, h0, sx, ox, oy);';
    if (!t.includes(A) || !t.includes(B)) throw new Error('kotva nenalezena');
    t = t.replace(A, 'out.push([3, b.hull, b]);');
    t = t.replace(B, `{ const _bb = [base[0] + spr.x0, base[1] + spr.y0, base[0] + spr.x0 + spr.c.width, base[1] + spr.y0 + spr.c.height], _sh = treeShapes(cxw, cyw, h0, _bb);
      if (isBus === true || isBus === 2) window.__mhdLog?.(_sh, _bb, base, cxw, cyw);
      drawBehindTrees(spr.c, base[0] + spr.x0, base[1] + spr.y0, spr.c.width, spr.c.height, cxw, cyw, h0, sx, ox, oy, _sh); }`);
    await r.fulfill({ response: res, body: t });
  });
  await ctx.addInitScript(() => {
    window.__mhd = { vozu: 0, zakryto: 0, pricina: {} };
    const inPoly = (x, y, P) => { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) if ((P[i][1] > y) !== (P[j][1] > y) && x < (P[j][0] - P[i][0]) * (y - P[i][1]) / (P[j][1] - P[i][1]) + P[i][0]) c = !c; return c; };
    window.__mhdLog = (sh, bb, base) => {
      const M = window.__mhd; M.vozu++;
      const cx = (bb[0] + bb[2]) / 2, cy = (bb[1] + bb[3]) / 2;
      for (const q of sh) if (q[0] === 3 && inPoly(cx, cy, q[1])) {            // střed vozu uvnitř obrysu = vůz (skoro) celý pryč
        M.zakryto++;
        const b = q[2], k = b ? `budova ${b.id ?? ''} ${b.name || b.n || ''} k=${b.k ?? ''} h=${b.h ?? ''} fb=${!!b.fb}`.trim() : 'mostovka';
        M.pricina[k] = (M.pricina[k] || 0) + 1; break;
      }
    };
  });
  const p = await ctx.newPage();
  await p.clock.install({ time: new Date(cas) });
  await p.goto(`http://localhost:8000/#${obdobi}@${LL[0]},${LL[1]},${process.env.KM || 0.9}`, { waitUntil: 'domcontentloaded' });
  for (let i = 0; i < 600; i++) { if (await p.evaluate(() => !!window.__izo && document.querySelector('#loading').hidden)) break; await p.clock.runFor(16); await p.waitForTimeout(20); }
  for (let s = 0; s < SEK * 10; s++) { await p.clock.runFor(100); if (s % 20 === 0) await p.waitForTimeout(5); }
  const M = await p.evaluate(() => window.__mhd);
  console.log('MHD:', await p.evaluate(() => { const m = window.__izo.MHD; return { on: m.on, act: m.act?.length, drawn: m.drawn?.length, trips: m.trips?.length, t: m.t, ted: new Date().toString().slice(0, 24) }; }));
  console.log(`\n${obdobi}: vykreslení vozů MHD ${M.vozu}, z toho střed vozu v obrysu ${M.zakryto}`);
  for (const [k, n] of Object.entries(M.pricina).sort((a, b) => b[1] - a[1]).slice(0, 10)) console.log(`  ${n}× ${k}`);
  await ctx.close();
}
await b.close();
