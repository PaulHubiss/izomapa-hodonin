// Zkouška lidí v ulicích (F13): node nastroje-pavel/test_chodci.mjs
// Data načtená, ve dne na náměstí zblízka chodí lidé, v noci jich je zlomek, vypnutá vrstva (i odkazem #…-bezlidi) nikoho
// nekreslí, oddáleně se nekreslí (malí), přepínač je ve skupině Život ve městě. Bez chyb stránky.
import { chromium, pripraveno } from './prohlizec.mjs';   // engine podle PROHLIZEC (chromium, webkit, firefox)
const b = await chromium.launch();
let ok = 0, spatne = 0;
const over = (co, v, info) => { v ? ok++ : spatne++; console.log(v ? '✅' : '❌', co, info === undefined ? '' : `· ${JSON.stringify(info)}`); };
const chyby = [];
const stav = async (hash) => {
  const p = await (await b.newContext({ viewport: { width: 1200, height: 800 } })).newPage(); p.on('pageerror', (e) => chyby.push(e.message));
  await p.goto(`http://localhost:8000/#${hash}`, { waitUntil: 'load' }); await pripraveno(p);
  const r = await p.evaluate(() => ({ ...window.__izo.CHODCI.stat, lidi: window.__izo.CHODCI.lidi, cest: window.__izo.CHODCI.cesty.length,
    zapnuto: document.getElementById('l-lide').checked, skupina: document.getElementById('l-lide').closest('.nb-sek')?.querySelector('.label')?.textContent }));
  await p.context().close(); return r;
};
const den = await stav('leto@48.8487,17.1285,0.2');
over('data: cesty a lidé načtení', den.cest > 1000 && den.lidi > 1000, { cest: den.cest, lidi: den.lidi });
over('ve dne na náměstí chodí lidé', den.kresleno >= 20, den);
over('přepínač „Lidé“ ve skupině Život ve městě', den.zapnuto && den.skupina === 'Život ve městě', den.skupina);
const noc = await stav('leto-noc@48.8487,17.1285,0.2');
over('v noci jich je zlomek', noc.kresleno < den.kresleno * 0.25, { den: den.kresleno, noc: noc.kresleno });
const vyp = await stav('leto-bezlidi@48.8487,17.1285,0.2');
over('odkaz #…-bezlidi vrstvu vypne', !vyp.zapnuto && vyp.kresleno === 0, vyp);
// rychlost: na středním přiblížení (nejvíc lidí v okně) pod 5 ms na snímek, nejvýš 250 postav (2026-11-16 bylo 14 ms, 900)
for (const km of [0.3, 0.6]) {
  const s = await stav(`leto@48.8487,17.1285,${km}`);
  over(`rychlost ${km} km: pod 5 ms na snímek, nejvýš 250 postav`, s.ms < 5 && s.zkouseno <= 250, { ms: +s.ms.toFixed(2), zkouseno: s.zkouseno });
}
const daleko = await stav('leto');
over('oddáleně (výchozí pohled) se nekreslí', daleko.zkouseno === 0, daleko);
over('chyby stránky', !chyby.length, chyby);
await b.close();
console.log(`\n${ok} v pořádku, ${spatne} špatně`);
process.exit(spatne ? 1 : 0);
