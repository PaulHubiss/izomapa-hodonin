// Kolik práce stojí posun mapy: node nastroje-pavel/mereni_posunu.mjs [varianta …]
// Táhne mapu sem a tam (výchozí pohled a na doraz oddáleno) a zaznamená práci prohlížeče (Chrome tracing):
// skript, výpočet stylů a rozvržení, kreslení (Paint) a rastrování (Raster). Odstupy snímků v prohlížeči bez okna
// nic neřeknou (snímky se jen odpočítávají), proto se měří čas práce.
//   zaklad      dnešní stav
//   bez-stinu   #podlozka skrytá (rozmazaný stín se nekreslí)
//   bez-pozadi  bez stínu i bez přechodu na pozadí #map
import { chromium } from 'playwright';
import fs from 'node:fs';
const VARIANTY = process.argv.slice(2).length ? process.argv.slice(2) : ['zaklad', 'bez-stinu', 'bez-pozadi'];
const b = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const SKUP = { skript: ['FunctionCall', 'EvaluateScript', 'TimerFire', 'FireAnimationFrame', 'EventDispatch', 'v8.callFunction'],
  styl: ['UpdateLayoutTree', 'RecalculateStyles', 'Layout', 'PrePaint'], kresleni: ['Paint', 'PaintImage', 'UpdateLayer', 'Layerize', 'Commit'],
  raster: ['RasterTask', 'GPUTask', 'ImageDecodeTask'] };
for (const v of VARIANTY) {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } }), p = await ctx.newPage();
  // „blizko“ v názvu varianty = náměstí zblízka (0,3 km), „stredne“ = 0,6 km (nejvíc lidí v okně); „bezlidi“ = vrstva Lidé vypnutá
  const km = v.includes('blizko') ? '@48.8487,17.1285,0.3' : v.includes('stredne') ? '@48.8487,17.1285,0.6' : '';
  await p.goto(`http://localhost:8000/#leto${v.includes('bezlidi') ? '-bezlidi' : ''}${km}`, { waitUntil: 'load' }); await p.waitForTimeout(5000);
  await p.addStyleTag({ content: 'body > *:not(#map) { visibility: hidden !important; } .pin, .pin * { pointer-events: none !important; } #fx { display: none !important; }' });
  if (v === 'bez-stinu' || v === 'bez-pozadi') await p.addStyleTag({ content: '#podlozka { display: none !important; }' });
  if (v === 'bez-pozadi') await p.addStyleTag({ content: '#map { background: #1b2333 !important; }' });
  const radek = [];
  for (const oddalit of [false, true]) {
    if (oddalit) { await p.mouse.move(720, 450); for (let i = 0; i < 15; i++) { await p.mouse.wheel(0, 400); await p.waitForTimeout(80); } await p.waitForTimeout(2500); }
    const soubor = `/tmp/izo-trace-${process.pid}.json`;
    await b.startTracing(p, { path: soubor, categories: ['devtools.timeline', 'disabled-by-default-devtools.timeline', 'cc', 'gpu'] });
    for (let k = 0; k < 4; k++) {
      const [x0, x1] = k % 2 ? [1100, 340] : [340, 1100];
      await p.mouse.move(x0, 450); await p.mouse.down();
      for (let s = 1; s <= 40; s++) { await p.mouse.move(x0 + (x1 - x0) * s / 40, 450 + 60 * Math.sin(s / 6)); await p.waitForTimeout(16); }
      await p.mouse.up(); await p.waitForTimeout(700);
    }
    await b.stopTracing();
    const ev = JSON.parse(fs.readFileSync(soubor, 'utf8')).traceEvents.filter((e) => e.ph === 'X' && e.dur);
    fs.unlinkSync(soubor);
    const s = Object.fromEntries(Object.entries(SKUP).map(([k, jm]) => [k, ev.filter((e) => jm.includes(e.name)).reduce((a, e) => a + e.dur, 0) / 1000]));
    radek.push(`${oddalit ? 'oddáleno' : 'výchozí'}: ` + Object.entries(s).map(([k, ms]) => `${k} ${ms.toFixed(0)}`).join(', ') + ' ms');
  }
  console.log(v.padEnd(11), radek.join('  |  '));
  await ctx.close();
}
await b.close();
