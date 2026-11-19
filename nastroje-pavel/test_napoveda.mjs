// Nápověda (2026-11-17): záložky, upozornění na nepřesnost v O projektu, popis novinek.
// Od 2026-11-19 i záložka Napište nám (formulář) a odkaz z karty místa.
// node nastroje-pavel/test_napoveda.mjs   (běžící náhled na :8000; odeslání se tu nezkouší, server api/zprava je jen na webu)
import { chromium } from './prohlizec.mjs';
const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: 1400, height: 900 } })).newPage();
const chyby = []; p.on('pageerror', (e) => chyby.push(e.message));
let ok = 0, spatne = 0;
const over = (co, v, info = '') => { v ? ok++ : spatne++; console.log(v ? '✅' : '❌', co, info === '' ? '' : `· ${info}`); };
await p.goto('http://localhost:8000/?np#leto', { waitUntil: 'load' }); await p.waitForTimeout(2500);
await p.evaluate(() => document.getElementById('helpDlg').showModal());
const s = await p.evaluate(() => {
  const d = document.getElementById('helpDlg'), txt = (k) => (d.querySelector(`.nb-napo-okno[data-zal="${k}"]`)?.textContent || '').replace(/ /g, ' ');
  return { zalozky: [...d.querySelectorAll('.nb-zalozky button')].map((x) => x.textContent), projekt: txt('projekt'), ovladani: txt('ovladani'), vrstvy: txt('vrstvy'),
    sbalene: [...d.querySelectorAll('.nb-napo-okno[data-zal="projekt"] details')].map((x) => [x.querySelector('summary').textContent, x.open]),
    plocha: !!d.querySelector('.nb-napo-okno[data-zal="ovladani"] #plochaBtn') };
});
// od 2026-11-19 přeskládáno podle navrhy/napoveda.html
over('záložky Ovládání, V mapě, O mapě, Napište nám', JSON.stringify(s.zalozky) === JSON.stringify(['Ovládání', 'V mapě', 'O mapě', 'Napište nám']), JSON.stringify(s.zalozky));
over('O mapě: kdo za ní stojí (Paul Hubiss a kredit Adama Klatovského)', s.projekt.includes('upravil a doplnil Paul Hubiss.') && s.projekt.includes('od Adama Klatovského'));
over('O mapě: upozornění „Jak mapu brát“', s.projekt.includes('Jak mapu brát') && s.projekt.includes('ne úřední podklad'));
over('O mapě: Soukromí a Zdroje dat sbalené', JSON.stringify(s.sbalene) === JSON.stringify([['Soukromí', false], ['Zdroje dat', false]]), JSON.stringify(s.sbalene));
over('O mapě: Soukromí zmiňuje formuláře, zdroje celé (OSM, ČÚZK)', s.projekt.includes('Hlášení nepřesnosti a zprávy') && s.projekt.includes('OpenStreetMap (ODbL)') && s.projekt.includes('přispěvatelé OpenStreetMap, ČÚZK'));
over('Ovládání: přehled a Přidat na plochu', s.ovladani.includes('žlutě obtáhne') && s.ovladani.includes('Moje poloha') && s.plocha);
over('V mapě: kategorie a život města', s.vrstvy.includes('Restaurace') && s.vrstvy.includes('zvířata v zoo') && s.vrstvy.includes('loďky'));

// formulář: skutečná kliknutí Playwrightu (na skrytém prvku selžou, viz CHYBY-CLAUDA 2026-11-18)
await p.click('.nb-zalozky [data-zal="napiste"]');
const f = '.nb-napo-okno[data-zal="napiste"] .nb-zprava';
over('formulář je vidět', await p.isVisible(`${f} textarea`) && await p.isVisible(`${f} [type=submit]`));
await p.click(`${f} [type=submit]`);
over('bez druhu: výzva vybrat, o co jde', (await p.textContent(`${f} .nb-zprava-stav`)).replace(/ /g, ' ').includes('o co jde'));
await p.click(`${f} [data-druh="napad"]`);
await p.click(`${f} [type=submit]`);
over('krátká zpráva odmítnuta', (await p.textContent(`${f} .nb-zprava-stav`)).includes('pár slov'));
await p.fill(`${f} textarea`, 'Zkouška formuláře z test_napoveda.');
await p.fill(`${f} [name=email]`, 'nesmysl');
await p.click(`${f} [type=submit]`);
over('špatný e-mail odmítnut', (await p.textContent(`${f} .nb-zprava-stav`)).includes('E-mail nevypadá'));
await p.fill(`${f} [name=email]`, '');
await p.click(`${f} [type=submit]`);
await p.waitForTimeout(800);
over('lokálně: hláška, že odesílání funguje jen na webu', (await p.textContent(`${f} .nb-zprava-stav`)).includes('jen na webu'), await p.textContent(`${f} .nb-zprava-stav`));
const rozm = await p.evaluate(() => { const d = document.getElementById('helpDlg'); return { s: d.scrollWidth, c: d.clientWidth }; });
over('okno nápovědy bez vodorovného přetečení', rozm.s <= rozm.c, JSON.stringify(rozm));

// odkaz z karty místa (Radnice)
// jiná adresa (?np2): změna jen za # by stránku znovu nenačetla a nápověda by zůstala otevřená přes kartu
await p.goto('http://localhost:8000/?np2#leto@48.84832,17.12836,0.40,3', { waitUntil: 'load' }); await p.waitForTimeout(3000);
over('karta místa má odkaz Napište nám', await p.isVisible('#card .nb-karta-napiste button'));
await p.click('#card .nb-karta-napiste button');
const m = await p.evaluate(() => ({ otevreno: document.getElementById('helpDlg').open,
  misto: document.querySelector('.nb-zprava-misto:not([hidden]) span')?.textContent || '',
  druh: document.querySelector('.nb-zprava [data-druh][aria-pressed="true"]')?.dataset.druh }));
over('odkaz otevře formulář s místem a druhem Místo', m.otevreno && m.misto.includes('Radnice') && m.druh === 'misto', JSON.stringify(m));
await p.click('.nb-zprava-misto button');
over('místo jde od zprávy odpojit', await p.isHidden('.nb-zprava-misto'));

over('chyby stránky', !chyby.length, chyby.join(' | '));
console.log(`\n${ok} v pořádku, ${spatne} špatně`);
await b.close();
process.exit(spatne ? 1 : 0);
