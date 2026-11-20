// Zkouška vrstvy Restaurace a kavárny (nastroje/podniky.py → overlay.json „podniky“): node nastroje-pavel/test_podniky.mjs
// Převod otevírací doby z OSM na pevných časech, ikonky v mapě, karta s „teď otevřeno“, přepínač (ostatní vrstvy zůstanou),
// odkaz Sdílet otevře stejnou kartu, hledání najde podnik, chyby stránky.
import { chromium, pripraveno } from './prohlizec.mjs';   // engine podle PROHLIZEC (chromium, webkit, firefox)
import { sekce } from './sekce.mjs';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1200, height: 800 }, permissions: ['clipboard-read', 'clipboard-write'] });
const chyby = [];
const nova = async (url) => { const p = await ctx.newPage(); p.on('pageerror', (e) => chyby.push(e.message)); await p.goto(url, { waitUntil: 'load' }); await pripraveno(p); return p; };
let ok = 0, spatne = 0;
const over = (co, v, info) => { v ? ok++ : spatne++; console.log(v ? '✅' : '❌', co, info === undefined ? '' : `· ${typeof info === 'string' ? info : JSON.stringify(info)}`); };
const p = await nova('http://localhost:8000/#leto@48.8505,17.1268,0.6');

// 1) otevírací doba: zápisy z dat Hodonína + okrajové případy; středa 2026-11-18 a neděle 2026-11-22
const oh = await p.evaluate(() => {
  const { ohParse, ohTed } = window.__izo;
  const t = (s, kdy) => { const w = ohParse(s); return w ? ohTed(w, new Date(kdy))[1] : null; };
  return [
    t('Mo-Fr 09:00-21:00, Sa 10:00-21:00, Su 13:00-21:00', '2026-11-18T10:00'),   // st dopoledne
    t('Mo-Fr 09:00-21:00, Sa 10:00-21:00, Su 13:00-21:00', '2026-11-22T11:00'),   // ne před otevřením
    t('Mo-Fr 07:00-18:00; Sa,Su 09:00-18:00', '2026-11-22T08:00'),                // čárka mezi dny pravidlo nedělí
    t('Mo-Th 10:00-22:00; Fr-Sa 10:00-00:00; Su 10:00-22:00', '2026-11-21T23:30'), // so do půlnoci
    t('Mo-Th 14:00-23:00, Fr-Sa 14:00-01:00, Su 14:00-22:00', '2026-11-22T00:30'), // ne po půlnoci ze soboty
    t('Mo-Th 10:00-19:00; Fr-Sa 10:00-21:00; Su off', '2026-11-22T12:00'),        // ne zavřeno, zítra
    t('Mo-Su,PH 10:00-22:00', '2026-11-18T23:00'),
    t('24/7', '2026-11-18T03:00'),
    t('Mo-Fr 06:30-17:30; Sa 06:30-11:30', '2026-11-21T12:00'),                   // so po zavření, v neděli zavřeno → „zavřeno“
    t('Apr-Oct: Mo-Su 10:00-20:00', '2026-11-18T12:00'),                          // sezóna: neumíme → null
  ];
});
const cekam = ['otevřeno do 21:00', 'zavřeno, dnes od 13:00', 'zavřeno, dnes od 9:00', 'otevřeno do půlnoci', 'otevřeno do 1:00',
  'zavřeno, zítra od 10:00', 'zavřeno, zítra od 10:00', 'otevřeno do půlnoci', 'zavřeno', null];
over('otevírací doba: 10 zápisů', oh.every((x, i) => x === cekam[i]), oh.map((x, i) => x === cekam[i] ? '✓' : `${x} ≠ ${cekam[i]}`));

// 2) ikonky a karta
const n = await p.evaluate(() => ({ data: window.__izo.PODNIKY.length, ikonek: document.querySelectorAll('.pin.kat-jidlo').length, pocet: document.getElementById('n-jidlo').textContent }));
over('ikonka u každého podniku a počet u přepínače', n.data > 0 && n.ikonek === n.data && n.pocet === ` (${n.data})`, n);
const karta = await p.evaluate(() => {
  const z = window.__izo.PODNIKY.find((x) => x.oteviraci && window.__izo.ohParse(x.oteviraci)); window.__izo.showPodnik(z);
  // karta po oddílech (2026-11-20): „Teď“ = shrnutí oddílu Otevírací doba, dny v rozbalovacím týdnu, odkazy krátce s ikonkou
  const dt = [...document.querySelectorAll('#cardDl dt')].map((x) => x.textContent);
  return { nazev: z.nazev, nadpis: document.querySelector('#cardTitle').textContent, dt, ted: document.querySelector('#cardOhTed')?.className,
    dny: [...document.querySelectorAll('#cardOh .nb-tyden dt')].map((x) => x.textContent), odkazy: [...document.querySelectorAll('#cardLinks a')].map((a) => a.textContent) };
});
over('karta podniku: druh, teď, dny, odkazy', karta.nadpis === karta.nazev && karta.dt[0] === 'Druh'
  && karta.dny.some((x) => /^(Po|Út|St|Čt|Pá|So|Ne)/.test(x)) && /oh-ted (otevreno|zavreno)/.test(karta.ted) && karta.odkazy.includes('OpenStreetMap'), karta);

// 3) sdílení otevře stejnou kartu
await p.click('#cardShare'); await p.click('#shareMenu [data-k="kopirovat"]'); await p.waitForTimeout(300);   // na počítači nabídka sdílení
const url = await p.evaluate(() => navigator.clipboard.readText());
const q = await nova(url);
const k2 = await q.evaluate(() => ({ open: !document.querySelector('#card').hidden, nadpis: document.querySelector('#cardTitle').textContent }));
over('odkaz Sdílet otevře kartu podniku', k2.open && k2.nadpis === karta.nazev && /,5$/.test(url.split('@')[1] || ''), { url, ...k2 });
await q.close();

// 4) přepínač: schová podniky, památky a popisky zůstanou, odkaz nese „bezpodniku“
await p.click('#cardClose');
await sekce(p, '#l-pod'); await p.click('#l-pod'); await p.waitForTimeout(200);
const vid = await p.evaluate(() => ({ pod: [...document.querySelectorAll('.pin.kat-jidlo')].filter((e) => getComputedStyle(e).display !== 'none').length,
  pam: [...document.querySelectorAll('.pin.kat-pamatky')].filter((e) => getComputedStyle(e).display !== 'none').length }));
await p.click('#share'); await p.click('#shareMenu [data-k="kopirovat"]'); await p.waitForTimeout(300);
const url2 = await p.evaluate(() => navigator.clipboard.readText());
over('vypnutí schová jen podniky a odkaz to nese', vid.pod === 0 && vid.pam > 0 && /bezpodniku/.test(url2), { ...vid, url2 });
await p.click('#l-pod');

// 5) hledání
const jmeno = karta.nazev;
await sekce(p, '#q'); await p.fill('#q', jmeno.slice(0, 6)); await p.waitForTimeout(500);
const vysl = await p.evaluate(() => [...document.querySelectorAll('#results button')].map((x) => x.textContent));
over('hledání najde podnik', vysl.some((t) => t.includes(jmeno)), vysl.slice(0, 5));

console.log(`\n${ok} v pořádku, ${spatne} špatně · chyby stránky: ${chyby.length ? chyby.join(' / ') : 'žádné'}`);
await b.close();
process.exit(spatne || chyby.length ? 1 : 0);
