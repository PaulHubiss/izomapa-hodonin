// Srovnání velikostí zvířat v zoo a loděk pro Pavla: node nastroje-pavel/zoo_velikost.mjs 1.6 2.4
// Stejné místo a čas (léto 10:30), jen jiné zvětšení (ZV_ZVETS a LOD_ZVETS ve web/app.html) → snimky/zoo-<z>.png
// a snimky/lode-<z>.png. Běžící náhled na :8000. Volba --stat vypíše jen počty (kolik zvířat a loděk je v okně).
import { chromium } from 'playwright';
import path from 'node:path';
const KOREN = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const stat = process.argv.includes('--stat');
const velikosti = process.argv.slice(2).map(Number).filter(Boolean);
const MISTA = [['zoo', '48.8636,17.1075,0.3'], ['lode', '48.8437,17.1480,0.4'], ['lavor', '48.8439,17.1352,0.35'],
  ['rameno', '48.8453,17.1409,0.45'], ['katov', '48.8441,17.1515,0.45']].filter(([j]) => !process.env.MISTA || process.env.MISTA.split(',').includes(j));
const b = await chromium.launch({ args: ['--use-angle=metal'] });
for (const z of velikosti.length ? velikosti : [1.6]) for (const [jmeno, kde] of MISTA) {
  const p = await (await b.newContext({ viewport: { width: 1400, height: 900 } })).newPage();
  p.on('pageerror', (e) => console.log('CHYBA', e.message));
  await p.clock.install({ time: new Date('2026-07-15T10:30:00+02:00') });
  await p.goto(`http://localhost:8000/#leto@${kde}`, { waitUntil: 'load' });
  for (let k = 0; k < 120; k++) { await p.clock.runFor(50); await p.waitForTimeout(40); }
  await p.evaluate((z) => { window.__izo.zvZvets = z; window.__izo.lodZvets = z; document.querySelector('#panel').style.display = 'none'; }, z);
  for (let k = 0; k < 10; k++) { await p.clock.runFor(50); await p.waitForTimeout(40); }
  const s = await p.evaluate(() => ({ ...window.__izo.CHODCI.stat, zoo: window.__izo.CHODCI.cesty.filter((c) => c.zvire).length, lode: (window.__izo.CHODCI.lode || []).length }));
  console.log(jmeno, z, JSON.stringify(s));
  if (!stat) {
    const out = path.join(KOREN, 'snimky', `${jmeno}-${z}.png`);
    await p.screenshot({ path: out, clip: { x: 400, y: 200, width: 640, height: 440 } });
    console.log(path.relative(KOREN, out));
  }
  await p.close();
}
await b.close();
