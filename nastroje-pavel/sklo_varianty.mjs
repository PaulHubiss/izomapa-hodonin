// Varianty skla panelu kvůli kontrastu (Pavel 2026-11-18: „připrav varianty skla“). Pro každou variantu ze sklo_css.mjs:
// snímek panelu Vzhled nad zimní a letní mapou (snimky/sklo/<varianta>-<období>.png) a měření kontrastu kontrast.mjs.
// K tomu úpravy vybrané sekce v liště (LISTA) na zimní mapě se sklem C. Výsledek snimky/sklo/vysledky.json,
// prohlížení navrhy/sklo.html (http://nastroje.localhost/p/Izomapa/navrhy/sklo.html).
//   node nastroje-pavel/sklo_varianty.mjs        (běžící náhled na :8000, ~7 min)
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { chromium, pripraveno } from './prohlizec.mjs';
import { VARIANTY, LISTA } from './sklo_css.mjs';

const OBDOBI = { winter: 'zima', summer: 'leto' };
fs.mkdirSync('snimky/sklo', { recursive: true });
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1280, height: 860 }, deviceScaleFactor: 2 });
const foto = async (tok, css, cesta, clip) => {
  const p = await ctx.newPage();
  await p.goto(`http://localhost:8000/#${tok}@48.8487,17.1285,0.5`, { waitUntil: 'load' });
  // jednou za čas se dlaždice v záběru nedonačte do 30 s (2026-11-18) – pak fotit i tak, panel je hlavní
  await pripraveno(p, 2500).catch(() => { console.log(`  (${cesta}: mapa se nedonačetla, fotím i tak)`); return p.waitForTimeout(3000); });
  if (css) await p.addStyleTag({ content: css });
  await p.waitForTimeout(300); await p.screenshot({ path: cesta, clip }); await p.close();
};
for (const k of Object.keys(VARIANTY)) for (const [ob, tok] of Object.entries(OBDOBI))
  await foto(tok, VARIANTY[k].css, `snimky/sklo/${k}-${ob}.png`, { x: 0, y: 0, width: 440, height: 450 });
for (const k of Object.keys(LISTA))
  await foto('zima', `${VARIANTY.C.css} ${LISTA[k].css}`, `snimky/sklo/lista-${k}.png`, { x: 0, y: 0, width: 100, height: 300 });
await b.close();

const zmer = (klic) => {
  const r = spawnSync('node', ['nastroje-pavel/kontrast.mjs', 'winter', 'summer', '--varianta', klic], { encoding: 'utf8' });
  const m = r.stdout.match(/změřeno (\d+) textů, pod hranicí (\d+)/), nej = r.stdout.match(/nejhorší:\n\s+\S+\s+([\d.]+) : 1/);
  return { zmereno: +m?.[1], pod: +m?.[2], nejhorsi: nej ? +nej[1] : null };
};
const vysledky = { sklo: {}, lista: {} };
for (const [k, v] of Object.entries(VARIANTY)) {
  vysledky.sklo[k] = { ...v, ...zmer(k) };
  console.log(k, v.nazev.padEnd(26), `pod hranicí ${vysledky.sklo[k].pod} z ${vysledky.sklo[k].zmereno} · nejhorší ${vysledky.sklo[k].nejhorsi} : 1`);
}
for (const [k, v] of Object.entries(LISTA)) {
  vysledky.lista[k] = { ...v, ...zmer(`C+${k}`) };
  console.log(`C+${k}`, v.nazev.padEnd(24), `pod hranicí ${vysledky.lista[k].pod} z ${vysledky.lista[k].zmereno} · nejhorší ${vysledky.lista[k].nejhorsi} : 1`);
}
fs.writeFileSync('snimky/sklo/vysledky.json', JSON.stringify(vysledky, null, 1));
