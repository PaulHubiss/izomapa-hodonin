// Bublina pro nového návštěvníka (Pavel 2026-11-23): jen na telefonu, jen poprvé, ne u odkazu na místo; na počítači ne
// (Vzhled je otevřený od startu). Náhled ?bublina ji ukáže vždy.
// node nastroje-pavel/test_bublina.mjs   (běžící náhled na :8000)
import { chromium } from './prohlizec.mjs';
const b = await chromium.launch();
let ok = 0, spatne = 0;
const over = (co, v, info = '') => { v ? ok++ : spatne++; console.log(v ? '✅' : '❌', co, info === '' ? '' : `· ${info}`); };
const TEL = { viewport: { width: 390, height: 780 }, isMobile: true, hasTouch: true };
const PC = { viewport: { width: 1280, height: 800 } };
const vidi = (p) => p.evaluate(() => !!document.querySelector('.nb-bublina.vidi'));
const chyby = [];
async function nacti(c, adresa, cekej = 2600) {
  const p = await c.newPage(); p.on('pageerror', (e) => chyby.push(e.message));
  await p.goto(`http://localhost:8000/${adresa}`, { waitUntil: 'load' }); await p.waitForTimeout(cekej);
  return p;
}

// telefon: poprvé ano, podruhé ne
const c1 = await b.newContext(TEL);
let p = await nacti(c1, '');
over('telefon, nový návštěvník: bublina se ukáže', await vidi(p));
const v = await p.evaluate(() => { const b = document.querySelector('.nb-bublina').getBoundingClientRect(); return b.left >= 0 && b.right <= innerWidth && b.top >= 0; });
over('telefon: bublina celá v okně', v);
await p.click('.nb-bublina-x'); await p.waitForTimeout(600);
over('křížek bublinu zavře', !(await p.evaluate(() => !!document.querySelector('.nb-bublina'))));
p = await nacti(c1, '');
over('telefon, podruhé: bublina už ne', !(await vidi(p)));
await c1.close();

// telefon s odkazem na místo: ne
const c2 = await b.newContext(TEL);
p = await nacti(c2, '#leto@48.8530,17.1265,0.5');
over('telefon, odkaz na místo: bublina ne', !(await vidi(p)));
await c2.close();

// počítač: ne, Vzhled otevřený
const c3 = await b.newContext(PC);
p = await nacti(c3, '');
const st = await p.evaluate(() => ({ bub: !!document.querySelector('.nb-bublina'), vzhled: !document.getElementById('nb-vzhled').hidden }));
over('počítač: bez bubliny, Vzhled otevřený', !st.bub && st.vzhled, JSON.stringify(st));
// náhled ?bublina na počítači: ukáže se, panel zavřený
p = await nacti(c3, '?bublina');
over('náhled ?bublina na počítači: bublina se ukáže', await vidi(p));
await c3.close();

over('chyby stránky', !chyby.length, chyby.join(' | '));
console.log(`\n${ok} v pořádku, ${spatne} špatně`);
await b.close();
process.exit(spatne ? 1 : 0);
