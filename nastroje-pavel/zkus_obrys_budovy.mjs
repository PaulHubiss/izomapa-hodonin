// Ladění: nakreslí přes mapu obrys budovy, za který se schovávají vozidla a lidé (b.hull z overlay.py), a půdorys (b.fb).
//   node nastroje-pavel/zkus_obrys_budovy.mjs <lat> <lon> [km] [obdobi] → snimky/obrys-budovy.png
import { chromium } from 'playwright';
import path from 'node:path';
const [lat, lon] = [+process.argv[2], +process.argv[3]], KM = process.argv[4] || 0.22, OB = process.argv[5] || 'leto';
const OUT = path.join(path.resolve(path.dirname(new URL(import.meta.url).pathname), '..'), 'snimky', 'obrys-budovy.png');
const b = await chromium.launch({ args: ['--use-angle=metal'] });
const p = await (await b.newContext({ viewport: { width: 900, height: 700 } })).newPage();
await p.goto(`http://localhost:8000/#${OB}-bezdopravy-bezlidi@${lat},${lon},${KM}`, { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__izo && document.querySelector('#loading').hidden, null, { timeout: 60000 });
await p.waitForTimeout(4000);
const info = await p.evaluate(([lat, lon]) => {
  const z = window.__izo, [ix, iy] = z.ll2img(lat, lon), bld = z.hit(ix, iy - 2); if (!bld) return null;
  const v = z.viewer.viewport, P = ([x, y]) => { const q = v.pixelFromPoint(new OpenSeadragon.Point(x / z.W, y / z.W), true); return [q.x, q.y]; };
  const c = document.createElement('canvas'); c.width = innerWidth; c.height = innerHeight; Object.assign(c.style, { position: 'fixed', inset: 0, zIndex: 99, pointerEvents: 'none' });
  const g = c.getContext('2d'), poly = (pts, barva, sir, vypln) => { g.beginPath(); pts.forEach((q, i) => { const [x, y] = P(q); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.closePath(); if (vypln) { g.fillStyle = vypln; g.fill(); } g.strokeStyle = barva; g.lineWidth = sir; g.stroke(); };
  poly(bld.hull, '#ff2d55', 3, 'rgba(255,45,85,.22)');
  for (const f of bld.fb || []) poly(f, '#33d1ff', 2);
  document.body.append(c);
  for (const s of ['#panel', '#nbRail', '.controls', '#card']) document.querySelector(s)?.style.setProperty('display', 'none', 'important');
  return { id: bld.id, name: bld.name, pam: bld.pam, h: bld.h };
}, [lat, lon]);
console.log(info);
await p.screenshot({ path: OUT });
console.log(OUT);
await b.close();
