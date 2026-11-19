// Zkouška programu v kartě místa a spojení míst s památkami: node nastroje-pavel/test_program.mjs [stažená stránka programu.html]
// Prostředník functions/api/program.js běží jen na Cloudflaru, tady ho zastoupí stejný převod nad staženou stránkou
// (bez argumentu ji stáhne z dkhodonin.eu). Kontroluje: program v kartě budovy i místa DK, kartu Pomníku TGM s fotkou
// a ÚSKP, žádnou ikonku památky na místech z mista.json, památky zůstanou po vypnutí popisků, chyby stránky.
import { chromium, pripraveno } from './prohlizec.mjs';   // engine podle PROHLIZEC (chromium, webkit, firefox)
import fs from 'fs';
import { sekce } from './sekce.mjs';
import { parseDkHodonin } from '../functions/api/program.js';
const html = process.argv[2] ? fs.readFileSync(process.argv[2], 'utf8') : await (await fetch('https://www.dkhodonin.eu/program')).text();
const akce = parseDkHodonin(html, 'https://www.dkhodonin.eu');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1200, height: 800 } });
const chyby = []; p.on('pageerror', (e) => chyby.push(e.message));
await p.route('**/api/program*', (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ akce, zdroj: 'https://www.dkhodonin.eu/program' }) }));
await p.goto('http://localhost:8000/', { waitUntil: 'load' }); await pripraveno(p);
let ok = 0, spatne = 0;
const over = (co, v, info) => { v ? ok++ : spatne++; console.log(v ? '✅' : '❌', co, info === undefined ? '' : `· ${typeof info === 'string' ? info : JSON.stringify(info)}`); };
const program = () => p.evaluate(() => ({ videt: !document.querySelector('#cardProgram').hidden, nadpis: document.querySelector('#cardTitle').textContent,
  akce: [...document.querySelectorAll('#cardProgram li')].map((l) => l.textContent), odkazy: [...document.querySelectorAll('#cardLinks a')].map((a) => a.textContent) }));
console.log(`převod stránky: ${akce.length} akcí`);

// 1) budova DK (lidé kliknou na budovu)
const bud = await p.evaluate(async () => (await fetch('overlay/c0_0.json').then((q) => q.json())).buildings.find((x) => x.name === 'Dům kultury Hodonín'));
await p.evaluate((x) => window.__izo.showBuilding(x), bud); await p.waitForTimeout(500);
let r = await program();
over('karta budovy DK: program', r.videt && r.akce.length > 0 && r.akce.length <= 5, r.akce);
over('karta budovy DK: odkaz na web', r.odkazy.includes('dkhodonin.eu'), r.odkazy);
// 2) místo DK ze seznamu „Místa a příběhy“
await sekce(p, '#places');
await p.locator('#places button', { hasText: 'Dům kultury Hodonín' }).click(); await p.waitForTimeout(800);
r = await program();
over('karta místa DK: program', r.videt && r.nadpis === 'Dům kultury Hodonín' && r.akce.length > 0, r.akce.length);
// 3) Pomník TGM: karta místa s fotkou a ÚSKP, bez vlastní ikonky památky
await p.locator('#places button', { hasText: 'Pomník T. G. Masaryka' }).click(); await p.waitForTimeout(800);
const tgm = await p.evaluate(() => ({ foto: !document.querySelector('#cardFoto').hidden, radky: document.querySelector('#cardDl').textContent, program: !document.querySelector('#cardProgram').hidden }));
over('Pomník TGM: fotka a ÚSKP v kartě místa, bez programu', tgm.foto && /ÚSKP/.test(tgm.radky) && !tgm.program, tgm);
// ikonky míst jsou od 2026-11-16 .pin.ikp.kat-<kategorie> s názvem v data-nazev (dřív .pin.pam s title);
// památka u příběhu nebo u veřejného místa vlastní ikonku nemá (uMista, uVer)
const ikon = await p.evaluate(() => ({ celkem: window.__izo.PAMATKY.length, cekam: window.__izo.PAMATKY.filter((q) => !q.uMista && !q.uVer).length,
  ikonek: document.querySelectorAll('.pin.ikp.kat-pamatky').length, zbyle: [...document.querySelectorAll('.pin.ikp.kat-pamatky')].map((e) => e.dataset.nazev) }));
over('ikonky jen u památek mimo místa', ikon.ikonek === ikon.cekam && ikon.ikonek < ikon.celkem && !ikon.zbyle.some((t) => /Masaryk|Vavřin|Radnice/.test(t)), `${ikon.ikonek} z ${ikon.celkem}`);
// 4) vypnutí popisků památky neschová
await p.click('#cardClose');
await sekce(p, '#l-labels'); await p.click('#l-labels'); await p.waitForTimeout(200);
const vid = await p.evaluate(() => [...document.querySelectorAll('.pin.ikp.kat-pamatky')].filter((e) => getComputedStyle(e).display !== 'none').length);
over('popisky vypnuté, památky vidět', vid > 0 || (await p.evaluate(() => document.getElementById('map').classList.contains('far'))), `${vid} viditelných`);
console.log(`\n${ok} v pořádku, ${spatne} špatně · chyby stránky: ${chyby.length ? chyby.join(' / ') : 'žádné'}`);
await b.close();
process.exit(spatne || chyby.length ? 1 : 0);
