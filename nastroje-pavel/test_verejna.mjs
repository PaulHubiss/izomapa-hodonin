// Zkouška veřejných míst (nastroje-pavel/verejna_mista.py): node nastroje-pavel/test_verejna.mjs
// Skupiny v sekci Místa, ikonky v mapě, karta s otevírací dobou, sezónní rozvrhy (i přes Nový rok), zoo = příběh s otevírací
// dobou, vypnutí skupiny odkazem, hledání.
import { chromium, pripraveno } from './prohlizec.mjs';   // engine podle PROHLIZEC (chromium, webkit, firefox)
const b = await chromium.launch();
let ok = 0, spatne = 0;
const over = (co, v, info) => { v ? ok++ : spatne++; console.log(v ? '✅' : '❌', co, info === undefined ? '' : `· ${JSON.stringify(info)}`); };
const chyby = [];
const p = await (await b.newContext({ viewport: { width: 1200, height: 800 } })).newPage(); p.on('pageerror', (e) => chyby.push(e.message));
await p.goto('http://localhost:8000/#leto@48.8545,17.1260,0.6', { waitUntil: 'load' }); await pripraveno(p);

// skupina Trasy (tematické trasy, test_trasy.mjs) není kategorie míst, ve Vrstvách nemá přepínač
const sk = await p.evaluate(() => [...document.querySelectorAll('#nb-mista .ver-sk:not(.ver-trasy) > summary')].map((s) => s.textContent));
const vr = await p.evaluate(() => [...document.querySelectorAll('#nb-vrstvy .nb-sek-predvolby + .nb-sek label:not([hidden])')].map((l) => l.textContent));
const katN = await p.evaluate(() => window.IZO_KAT.length);
over('sekce Místa: všechny kategorie v pořadí kategorie.js, rozbalovací s počty', sk.length === katN && /^Příběhy/.test(sk[0]) && sk.every((t) => /\(\d+\)/.test(t)), sk);
// Pavel 2026-11-16: kategorie ve Vrstvách = kategorie v Místech, stejné pořadí, stejné počty, ikonky v obou
over('Vrstvy = Místa: stejné názvy, pořadí a počty', JSON.stringify(vr.map((t) => t.trim())) === JSON.stringify(sk.map((t) => t.trim())), vr);
const ik = await p.evaluate(() => ({ vrstvy: document.querySelectorAll('#nb-vrstvy .nb-sek-predvolby + .nb-sek label .kat-ik svg').length,
  mista: document.querySelectorAll('#nb-mista .ver-sk:not(.ver-trasy) > summary .kat-ik svg').length }));
over('ikonky u všech kategorií ve Vrstvách i v Místech', ik.vrstvy === katN && ik.mista === katN, ik);
// otevřená je vždy jen jedna skupina (Pavel 2026-11-16)
await p.click('#nbRail [data-tab=mista]'); await p.waitForTimeout(200);
const otevrene = async () => p.evaluate(() => [...document.querySelectorAll('#nb-mista details.ver-sk[open] > summary')].map((s) => s.textContent.replace(/\s*\(\d+\)/, '')));
const o1 = await otevrene(); await p.click('.kat-sk-zdravi > summary'); await p.waitForTimeout(200); const o2 = await otevrene();
// jen název, žádný druhý řádek; stejné názvy (3× Dr. Max) rozliší ulice na stejném řádku
// (dlouhý název se smí zalomit sám, jako každý text – jde o to, že pod názvem už není druh místa)
const lek = await p.evaluate(() => [...document.querySelectorAll('.kat-sk-zdravi .places button')].map((b) => ({ t: b.querySelector('.ver-nazev').textContent, h: Math.round(b.getBoundingClientRect().height) })));
const drmax = lek.filter((x) => /^Dr\. Max/.test(x.t)), druh = await p.evaluate(() => document.querySelectorAll('.ver-druh').length);
over('Místa: bez druhu pod názvem, u stejných názvů ulice na stejném řádku', !druh && drmax.length === 3 && new Set(drmax.map((x) => x.t)).size === 3 && drmax.every((x) => / · /.test(x.t) && x.h <= 26), { druh, drmax, vyssi: lek.filter((x) => x.h > 26) });
await p.click('.kat-sk-zdravi > summary'); await p.waitForTimeout(200); const o3 = await otevrene();
over('vždy nejvýš jedna otevřená skupina (na začátku Příběhy)', o1.join() === 'Příběhy' && o2.join() === 'Zdraví' && o3.length === 0, { o1, o2, o3 });
// Dům kultury: v Kultuře, karta příběhu s pokladnou
const dk = await p.evaluate(() => { window.__izo.showVerejne(window.__izo.VEREJNA.find((x) => x.nazev === 'Dům kultury Hodonín'));
  // karta po oddílech (2026-11-20): „Teď“ = shrnutí oddílu Otevírací doba (#cardOhTed), poznámka v drobném řádku pod ním
  return { nadpis: document.querySelector('#cardTitle').textContent, ted: document.querySelector('#cardOhTed')?.textContent,
    pozn: /pokladny/.test(document.querySelector('#cardOh .nb-drob')?.textContent || '') }; });
over('Dům kultury v Kultuře: karta příběhu s pokladnou', dk.nadpis === 'Dům kultury Hodonín' && !!dk.ted && dk.pozn, dk);
await p.click('#cardClose');
over('příběhy přejmenované a nahoře', await p.evaluate(() => { const m = document.querySelector('#nb-mista'); return m.firstElementChild.id === 'placesBox' && /^Příběhy/.test(m.querySelector('#placesBox summary').textContent); }));
const piny = await p.evaluate(() => { const K = window.IZO_KAT.map((c) => c.k).filter((k) => !['pribehy', 'pamatky', 'jidlo'].includes(k));
  return { piny: document.querySelectorAll(K.map((k) => `.pin.ikp.kat-${k}`).join(',')).length, data: window.__izo.VEREJNA.length, spojene: window.__izo.VEREJNA.filter((v) => v.uMista).map((v) => v.nazev),
    pribehy: document.querySelectorAll('.pin.ikp.kat-pribehy').length, vsechPribehu: window.__izo.pribehu, textem: [...document.querySelectorAll('.pin')].filter((e) => !e.matches('.ikp,.hz,.need,.neighbor')).length }; });
over('ikonky: všechna místa kromě těch, co jsou zároveň příběhem', piny.piny === piny.data - piny.spojene.length && piny.spojene.includes('Zoo Hodonín'), piny);
over('příběhy jako ikonky, žádný textový popisek', piny.pribehy === piny.vsechPribehu && piny.textem === 0, piny);
// název po najetí (Pavel 2026-11-16)
const najeti = await p.evaluate(() => { const e = document.querySelector('.pin.ikp.kat-pribehy'); return e.dataset.nazev; });
over('ikonka nese název pro najetí myší', !!najeti, najeti);
// kostel = památka: jedna ikonka v Kostelech, karta s fotkou a číslem památky
const kostel = await p.evaluate(() => { const v = window.__izo.VEREJNA.find((x) => x.nazev === 'Kostel sv. Metoděje'); if (!v) return null;
  return { pam: !!v.pam, ikonaPamatky: v.pam ? !!v.pam.el : null }; });
over('kostel, který je památkou: jedna ikonka (kostel)', !kostel || !kostel.pam || kostel.ikonaPamatky === false, kostel);

// karta městského úřadu (středa 10:00 = otevřeno do 17:00)
const muu = await p.evaluate(() => {
  const v = window.__izo.VEREJNA.find((x) => x.nazev === 'Městský úřad Hodonín'); window.__izo.showVerejne(v);
  const dt = [...document.querySelectorAll('#cardDl dt')].map((x) => x.textContent);
  return { nadpis: document.querySelector('#cardTitle').textContent, dt, ted: document.querySelector('#cardOhTed')?.textContent,
    dny: [...document.querySelectorAll('#cardOh .nb-tyden dt')].map((x) => x.textContent), drob: document.querySelector('#cardOh .nb-drob')?.textContent || '',
    odkazy: [...document.querySelectorAll('#cardLinks a')].map((a) => a.textContent) };
});
over('karta MěÚ: teď, dny, poznámka, telefon, zdroj', !!muu.ted && muu.dny.length > 0 && muu.dt.includes('Telefon') && /ověřeno/.test(muu.drob) && muu.odkazy.includes('Zdroj otevírací doby'), muu);

// sezónní rozvrhy
const sez = await p.evaluate(() => {
  const V = window.__izo.VEREJNA, f = window.__izo.verOteviraci, n = (x) => V.find((v) => v.nazev === x);
  return { zooLeden: f(n('Zoo Hodonín'), new Date(2027, 0, 15)).oh, zooCervenec: f(n('Zoo Hodonín'), new Date(2027, 6, 15)).oh,
    zoo29unor: f(n('Zoo Hodonín'), new Date(2028, 1, 29)).oh, ticLeden: f(n('Turistické informační centrum'), new Date(2027, 0, 10)).oh,
    ticSrpen: f(n('Turistické informační centrum'), new Date(2027, 7, 10)).oh };
});
over('sezóny: zoo leden 9–16, červenec 9–19, 29. února', /09:00-16:00/.test(sez.zooLeden) && /09:00-19:00/.test(sez.zooCervenec) && /09:00-16:00/.test(sez.zoo29unor), sez);
over('sezóny přes Nový rok: TIC v lednu zimní, v srpnu letní', /Sa 08:30-12:00/.test(sez.ticLeden) && /Su 08:30-13:30/.test(sez.ticSrpen), sez);

// zoo: karta příběhu s otevírací dobou
const zoo = await p.evaluate(() => { window.__izo.showVerejne(window.__izo.VEREJNA.find((x) => x.nazev === 'Zoo Hodonín'));
  return { nadpis: document.querySelector('#cardTitle').textContent, ted: document.querySelector('#cardOhTed')?.textContent, drob: document.querySelector('#cardOh .nb-drob')?.textContent || '' }; });
over('zoo: karta příběhu s otevírací dobou', zoo.nadpis === 'Zoo Hodonín' && !!zoo.ted && /platí/.test(zoo.drob), zoo);

// skupina v seznamu: klik na místo otevře kartu
await p.click('.kat-sk-kultura > summary'); await p.waitForTimeout(300);   // sekce Místa je otevřená z kontroly výš
await p.locator('.kat-sk-kultura .places button', { hasText: 'Galerie' }).click(); await p.waitForTimeout(500);
over('klik v seznamu Kultura otevře kartu galerie', await p.evaluate(() => document.querySelector('#cardTitle').textContent), 'Galerie výtvarného umění v Hodoníně');
// ikonka místa s otevřenou kartou je zvýrazněná, jen jedna, a po zavření karty zvýraznění zmizí (Pavel 2026-11-17)
const vyb = await p.evaluate(() => { const e = [...document.querySelectorAll('.pin.ikp.vybrany')]; return { pocet: e.length, nazev: e[0] && e[0].dataset.nazev, scale: e[0] && getComputedStyle(e[0]).scale }; });
await p.click('#cardClose'); await p.waitForTimeout(200);
const poZavreni = await p.evaluate(() => document.querySelectorAll('.pin.ikp.vybrany').length);
over('vybrané místo: ikonka zvýrazněná (jen jedna), po zavření karty normální', vyb.pocet === 1 && /Galerie/.test(vyb.nazev) && vyb.scale === '1.25' && poZavreni === 0, { ...vyb, poZavreni });
await p.context().close();

// místa v budově (Pavel 2026-11-20): víc míst = karta budovy se seznamem „V budově“, karta místa se seznamem
// „V budově také“ (Jump Street + Pivnice U Haryho); jiné karty seznam nemají
const p4 = await (await b.newContext({ viewport: { width: 1200, height: 800 } })).newPage(); p4.on('pageerror', (e) => chyby.push(e.message));
await p4.goto('http://localhost:8000/#leto@48.84674,17.12594,0.4', { waitUntil: 'load' }); await pripraveno(p4); await p4.waitForTimeout(1500);
const jump = await p4.evaluate(() => {
  const I = window.__izo, v = I.VEREJNA.find((x) => x.nazev === 'Jump Street Hodonín');
  const seznam = () => { const s = document.querySelector('#cardVBudove'); return s && !s.hidden ? [s.querySelector('.nb-oddil-nadpis').textContent, ...[...s.querySelectorAll('li')].map((e) => e.firstChild.childNodes[1].firstChild.textContent)] : []; };
  const karta = () => ({ nadpis: document.querySelector('#cardTitle').textContent, dt: [...document.querySelectorAll('#card dt')].map((e) => e.textContent), seznam: seznam() });
  I.showVerejne(v); const ikonka = karta();
  const bud = I.budovaMista(v); if (bud) I.showBuilding(bud); const budova = karta();
  document.querySelector('#cardVBudove li:last-child button')?.click(); const klik = karta();
  I.showPamatka(I.PAMATKY[0]); const jina = karta();
  return { ikonka, budova, klik, jinaSeznam: jina.seznam };
});
over('místo v budově s dalším: karta místa + „V budově také“, s telefonem i výškou', jump.ikonka.nadpis === 'Jump Street Hodonín' && jump.ikonka.dt.includes('Telefon')
  && jump.ikonka.dt.includes('Výška') && JSON.stringify(jump.ikonka.seznam) === JSON.stringify(['V budově také', 'Pivnice U Haryho']), jump);
over('budova s víc místy: karta budovy se seznamem „V budově“, klik otevře místo', JSON.stringify(jump.budova.seznam) === JSON.stringify(['V budově', 'Jump Street Hodonín', 'Pivnice U Haryho'])
  && jump.klik.nadpis === 'Pivnice U Haryho' && jump.klik.seznam[1] === 'Jump Street Hodonín' && jump.jinaSeznam.length === 0, jump);
await p4.context().close();

// odkaz bez úřadů, hledání
const p2 = await (await b.newContext({ viewport: { width: 1200, height: 800 } })).newPage(); p2.on('pageerror', (e) => chyby.push(e.message));
await p2.goto('http://localhost:8000/#leto-bezuradu@48.8545,17.1260,0.6', { waitUntil: 'load' }); await pripraveno(p2);
const vyp = await p2.evaluate(() => ({ check: document.getElementById('l-v-urady').checked, vidno: [...document.querySelectorAll('.pin.kat-urady')].filter((e) => getComputedStyle(e).display !== 'none').length,
  kultura: [...document.querySelectorAll('.pin.kat-kultura')].filter((e) => getComputedStyle(e).display !== 'none').length }));
over('odkaz #…-bezuradu skryje jen úřady', !vyp.check && vyp.vidno === 0 && vyp.kultura > 0, vyp);
await p2.click('#nbRail [data-tab=hledat]'); await p2.fill('#q', 'knihovna'); await p2.waitForTimeout(500);
const hl = await p2.evaluate(() => [...document.querySelectorAll('#results button')].map((x) => x.textContent));
over('hledání najde knihovnu', hl.some((t) => /Městská knihovna/.test(t)), hl.slice(0, 4));
// Kamery: obraz se načítá jen při otevřené sekci (server města nezatěžovat), po zavření dotazy ustanou
{
  const c3 = await b.newContext({ viewport: { width: 1200, height: 800 } }), p3 = await c3.newPage(); p3.on('pageerror', (e) => chyby.push(e.message));
  let dotazy = 0;
  await c3.route('https://www.hodonin.eu/html/muhodonin/WebCamNamesti/**', (r) => { dotazy++; r.fulfill({ contentType: 'image/jpeg', body: Buffer.alloc(10) }); });
  await p3.goto('http://localhost:8000/#leto', { waitUntil: 'load' }); await pripraveno(p3);
  const poradi = await p3.evaluate(() => [...document.querySelectorAll('#nbRail [data-tab]')].map((b) => b.dataset.tab));
  over('lišta: Kamery nad Hledat', poradi.indexOf('kamery') === poradi.indexOf('hledat') - 1, poradi);
  const predOtevrenim = dotazy;
  await p3.click('#nbRail [data-tab=kamery]'); await p3.waitForTimeout(11500);
  const otevreno = dotazy - predOtevrenim;
  await p3.click('#nbRail [data-tab=kamery]'); await p3.waitForTimeout(500); const poZavreni = dotazy; await p3.waitForTimeout(11000);
  const k = await p3.evaluate(() => [...document.querySelectorAll('.nb-kamera figcaption b')].map((x) => x.textContent));
  over('Kamery: náměstí a zoo, obraz jen při otevřené sekci (zavřeno = žádné dotazy)', predOtevrenim === 0 && otevreno >= 2 && dotazy === poZavreni && k.includes('Masarykovo náměstí'),
    { predOtevrenim, otevreno, poZavreni: dotazy - poZavreni, kamery: k });
  await c3.close();
}
over('chyby stránky', !chyby.length, chyby);
await b.close();
console.log(`\n${ok} v pořádku, ${spatne} špatně`);
process.exit(spatne ? 1 : 0);
