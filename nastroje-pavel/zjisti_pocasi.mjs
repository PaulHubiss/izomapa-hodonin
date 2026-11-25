// Proč není počasí v sekci Dnes: node nastroje-pavel/zjisti_pocasi.mjs [adresa]   (PROHLIZEC=webkit = Safari)
// Vypíše odpovědi Open-Meteo, chyby v konzoli a co je v sekci vidět.
import { chromium } from './prohlizec.mjs';
const URL0 = process.argv[2] || 'https://hodonin.paulhubiss.cz/';
const b = await chromium.launch(), p = await (await b.newContext({ viewport: { width: 1400, height: 900 } })).newPage();
p.on('pageerror', (e) => console.log('chyba stránky:', e.message));
p.on('console', (m) => { if (['error', 'warning'].includes(m.type())) console.log('konzole:', m.text().slice(0, 300)); });
p.on('requestfailed', (r) => console.log('neprošlo:', r.url().slice(0, 160), r.failure()?.errorText));
p.on('response', async (r) => { if (r.url().includes('open-meteo')) console.log('odpověď', r.status(), r.url(), '\n   ', (await r.text().catch((e) => 'bez těla ' + e.message)).slice(0, 400)); });
await p.goto(URL0, { waitUntil: 'load' }); await p.waitForTimeout(9000);
await p.click('#nbRail [data-tab="dnes"]'); await p.waitForTimeout(1500);
console.log(JSON.stringify(await p.evaluate(() => { const e = document.getElementById('dnesPocasi'), r = e.getBoundingClientRect(); return { hidden: e.hidden, vyska: r.height, text: e.innerText.slice(0, 300) }; })));
await b.close();
