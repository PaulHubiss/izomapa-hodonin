// Zkouška ladicího nástroje zoomu (mapa s ?ladeni): node nastroje-pavel/test_ladeni.mjs
// Otevře mapu, pootočí kolečkem dovnitř a ven (zuby po 100), klikne „Uložit záznam“ a ověří, že náhledový server
// soubor uložil do ladeni/. Vypíše počet snímků, zubů a skoků. Běžící náhled na :8000.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
const KOREN = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const b = await chromium.launch({ args: ['--use-angle=metal'] });
const p = await (await b.newContext({ viewport: { width: 1400, height: 900 } })).newPage();
const chyby = []; p.on('pageerror', (e) => chyby.push(e.message));
// pohled v adrese: od 2026-11-23 mapa v zimě startuje zblízka u jarmarku (sezonni_start) a kolečko by přes výchozí pohled nedošlo
await p.goto('http://localhost:8000/?ladeni#leto@48.8573,17.1240,5.0', { waitUntil: 'load' });
await p.waitForSelector('#ladeni', { timeout: 30000 });
await p.waitForTimeout(2000);
await p.mouse.move(1150, 250);                                  // vpravo nahoře nad mapou (vlevo je panel): u okraje se uplatní omezení pohledu
// jako Pavlovo plynulé kolečko (záznam 2026-11-17): zuby různé velikosti podle rychlosti otáčení, rychle za sebou
const zuby = [4, 40, 100, 210, 40, 4, 100, 210];
for (const dy of [...zuby.map((d) => -d), ...zuby, ...zuby, ...zuby.slice(0, 4)]) { await p.mouse.wheel(0, dy); await p.waitForTimeout(45); }
await p.waitForTimeout(1500);
const zbyva = await p.evaluate(() => window.__izo.omezeniZbyva());
const panel = await p.locator('#ladeni .lad-info').innerText();
await p.click('#ladeni button[data-a="uloz"]');
await p.waitForTimeout(1000);
const msg = await p.locator('#ladeni .lad-msg').innerText();
await b.close();
const soubor = (msg.match(/ladeni\/\S+\.json/) || [])[0];
const ok = (s, t, d = '') => { console.log(`${s ? '✅' : '❌'} ${t}${d ? ' · ' + d : ''}`); return s; };
let vse = ok(!chyby.length, 'chyby stránky', JSON.stringify(chyby));
vse &= ok(!!soubor && fs.existsSync(path.join(KOREN, soubor)), 'záznam uložený serverem', msg);
if (soubor) {
  const z = JSON.parse(fs.readFileSync(path.join(KOREN, soubor)));
  vse &= ok(z.snimky.length > 20 && z.kolecko.length === 28, 'snímky a zuby kolečka', `snímků ${z.snimky.length}, zubů ${z.kolecko.length}, skoků ${z.skoky.length}`);
  // plynulost: přiblížení se za jeden snímek nezmění o víc než 12 % (dřív velký zub = skok 27 % po zamrznutí)
  let nej = 0, kdy = 0;
  for (let i = 1; i < z.snimky.length; i++) { const d = Math.abs(Math.log(z.snimky[i][1] / z.snimky[i - 1][1])); if (d > nej) { nej = d; kdy = z.snimky[i][0]; } }
  vse &= ok(nej < Math.log(1.12), 'zoom bez skoků (nejvíc 12 % za snímek)', `nejvíc ${((Math.exp(nej) - 1) * 100).toFixed(1)} % v ${kdy} ms`);
  const tah = Math.max(...z.snimky.map((s) => s[4]));
  // pružina (OMEZENI_PRUZINA): dřív 93 px za jediný snímek; okraje obrazu se při 11% zoomu za snímek hýbou ~70 px
  vse &= ok(tah < 60, 'omezení táhne plynule (nejvíc 60 px za snímek)', `nejvíc ${tah} px`);
  vse &= ok(zbyva < 1, 'omezení po zoomu dojelo (pohled uvnitř mezí)', `zbývá ${zbyva.toFixed(2)} px`);
  vse &= ok(z.snimky.some((s) => s[8]) && z.snimky.some((s) => !s[8]), 'zoom prošel přes výchozí pohled', `oddáleno ${z.snimky.filter((s) => s[8]).length} snímků`);
  console.log('panel:', panel.replace(/\n/g, ' | '));
  if (z.skoky.length) console.log('skoky:', JSON.stringify(z.skoky.slice(0, 8)));
}
process.exit(vse ? 0 : 1);
