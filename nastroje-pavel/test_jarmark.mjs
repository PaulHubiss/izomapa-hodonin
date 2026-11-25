// Zkouška vánočního jarmarku (Pavel 2026-11-25): node nastroje-pavel/test_jarmark.mjs
// Převod stránky DK (na vzorku stejného tvaru, bez sítě), karta s programem po kliknutí na stánek, strom i pódium, ikonka jen
// se zimní výzdobou, položky v Dnes bez dvojí položky jarmarku z programu DK, žádné kluziště.
import { chromium, pripraveno } from './prohlizec.mjs';
import { parseJarmark } from '../functions/api/program.js';
let ok = 0, spatne = 0;
const over = (co, v, info) => { v ? ok++ : spatne++; console.log(v ? '✅' : '❌', co, info === undefined ? '' : `· ${typeof info === 'string' ? info : JSON.stringify(info)}`); };
const URL_J = 'https://www.dkhodonin.eu/divadlo/1652-vanocni-jarmark';
// 1) převod: vzorek se všemi tvary řádků, které na stránce jsou
const vzorek = `<p class="x">od 29. 11. 2026 v 16:45<br></p><p>Úvodní text 2026.</p><p><strong>NE 29.11.</strong></p><p>Adventní zvonění</p>
<p>16:45 Setkání účastníků na pěší zóně u Národní třídy</p><p>17:00 Zvonečkový průvod</p><p><strong>Rozsvícení stromu po příchodu</strong></p><p>18:00 Hodiny KONCERT</p><p> </p>
<p><strong>SO 5.12.</strong></p><p>09:00  Adventní běh</p><p>15:00 Andílek – DĚTSKÉ DIVADLO</p><p>18:30 Zonyga, vánoční KONCERT</p><p>16:30 Průvod “Nesem” - od Galerie</p><p>&nbsp;</p>
<p><strong>PO 21.12. - ÚT 22.12.</strong></p><p>10:00 Bez jistého dne</p><p> </p><p><strong>ČT 24.12.</strong></p><p>10:00 Burácení</p><p> </p><p><strong>Pořadatel:</strong> DK si vyhrazuje změnu.</p>`;
const pr = parseJarmark(vzorek, URL_J).map((a) => `${a.od} ${a.nazev}`);
over('převod: dny, časy, druhy, text bez času k akci, rozmezí dní a pořadatel vynechané', JSON.stringify(pr) === JSON.stringify([
  '2026-11-29T17:00 Zvonečkový průvod · Rozsvícení stromu po příchodu', '2026-11-29T18:00 Hodiny (koncert)', '2026-12-05T09:00 Adventní běh',
  '2026-12-05T15:00 Andílek (dětské divadlo)', '2026-12-05T18:30 Zonyga, vánoční koncert', '2026-12-05T16:30 Průvod „Nesem“ – od Galerie', '2026-12-24T10:00 Burácení']), pr);
over('převod: prázdná nebo jiná stránka nic nevymyslí', parseJarmark('<p>16:00 něco</p>', URL_J).length === 0 && parseJarmark('', URL_J).length === 0);

// 2) mapa; čas 3. 12. 2026 15:00, odpovědi prostředníka dosazené
const den = (d, h, n) => ({ nazev: n, od: `2026-12-${d}T${h}`, do: null, url: URL_J, druh: 'jarmark' });
const akce = [den('03', '16:00', 'Vystoupení MŠ'), den('03', '17:30', 'Kapela Highland (koncert)'), ...['04', '05', '06', '07', '08', '09'].map((d) => den(d, '16:00', `Vystoupení ${d}`))];
const dk = [{ nazev: 'Vánoční jarmark', od: '2026-12-03T16:45', do: '2026-12-20T20:00', url: 'https://www.dkhodonin.eu/program/1652-vanocni-jarmark', druh: 'ostatni' },
  { nazev: 'Koncert v DK', od: '2026-12-03T19:00', do: null, url: 'https://www.dkhodonin.eu/program/1-koncert', druh: 'koncerty' }];
const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1280, height: 860 } });
const chyby = []; p.on('pageerror', (e) => chyby.push(e.message));
await p.clock.setFixedTime(new Date('2026-12-03T15:00:00'));
await p.route('**/api/program*', (r) => { const u = r.request().url();
  r.fulfill({ contentType: 'application/json', body: JSON.stringify(/jarmark/.test(u) ? { akce, zdroj: URL_J } : /dkhodonin/.test(u) ? { akce: dk, zdroj: 'https://www.dkhodonin.eu/program' } : { akce: [], zdroj: 'https://www.kinosvet.eu/' }) }); });
await p.goto('http://localhost:8000/#zima@48.84870,17.12840,0.12', { waitUntil: 'load' }); await pripraveno(p); await p.waitForTimeout(2500);
const karta = () => p.evaluate(() => ({ videt: !document.querySelector('#card').hidden, nadpis: document.querySelector('#cardTitle').textContent, program: !document.querySelector('#cardProgram').hidden,
  hlavni: [...document.querySelectorAll('#cardProgram > ul li')].map((l) => l.textContent), dalsi: document.querySelector('#cardProgram details summary')?.textContent, radku: document.querySelectorAll('#cardProgram details li').length,
  termin: document.querySelector('#cardDl').textContent, odkaz: document.querySelector('#cardProgram .vse')?.href, kat: !document.querySelector('#cardKat')?.hidden }));
// klik do mapy na zeměpisné místo (výška v m nad zemí přes posun v px obrazu)
const klik = async (lat, lon, dy = 0) => {
  await p.evaluate(() => document.querySelector('#cardClose').click());
  const q = await p.evaluate(([la, lo, d]) => { const z = window.__izo, i = z.geoImg(la, lo), e = z.viewer.viewport.viewportToViewerElementCoordinates(new OpenSeadragon.Point(i[2] / z.W, (i[3] - d) / z.W)); return [e.x, e.y]; }, [lat, lon, dy]);
  await p.mouse.click(q[0], q[1]); await p.waitForTimeout(700); return karta();
};
const V = await p.evaluate(() => window.__izo.VANOCE_DATA);
let r = await klik(V.podia[0].lat, V.podia[0].lon, 25);
over('klik na pódium: karta jarmarku s programem', r.videt && r.nadpis === 'Vánoční jarmark' && r.program && r.hlavni.length === 5 && /16:00/.test(r.hlavni[0]), r);
over('karta: termín, zbytek programu sbalený, odkaz na web DK, bez údajů budovy', /29\. 11\. – 20\. 12\. 2026/.test(r.termin) && r.dalsi === 'Další 3' && r.radku === 3 && r.odkaz === URL_J && !r.kat, r);
await p.click('#cardProgram details summary');
over('sbalený zbytek jde rozbalit', await p.locator('#cardProgram details li').first().isVisible());
r = await klik(V.stromy[0][0], V.stromy[0][1], 25);
over('klik na strom: karta jarmarku', r.nadpis === 'Vánoční jarmark', r.nadpis);
const st = V.stanky.find((s) => s.n === 1 && s.w === 2.4);                             // Ježíškova pošta
r = await klik(st.lat, st.lon, 5);
over('klik na stánek: karta jarmarku', r.nadpis === 'Vánoční jarmark', r.nadpis);
r = await klik(48.84822, 17.12836, 20);
over('klik na radnici: pořád radnice', r.videt && r.nadpis === 'Radnice', r.nadpis);
const pin = () => p.evaluate(() => { const v = window.__izo.VEREJNA.find((q) => q.vanoce); return v.el ? !v.el.hidden : null; });
const zima = await pin();
await p.evaluate(() => document.querySelector('[data-s="summer"]').click()); await p.waitForTimeout(1200);
const leto = await pin();
r = await klik(V.podia[0].lat, V.podia[0].lon, 25);
over('léto: bez ikonky, klik na místo pódia jarmark neotevře', zima === true && leto === false && r.nadpis !== 'Vánoční jarmark', { zima, leto, nadpis: r.nadpis });
await p.evaluate(() => document.querySelector('[data-s="winter"]').click()); await p.waitForTimeout(1200);
over('zpátky v zimě: ikonka zpátky', (await pin()) === true);
await p.evaluate(() => document.querySelector('[data-tab="vrstvy"]')?.click()); await p.waitForTimeout(400);
over('Vrstvy: přepínač výzdoby není (Pavel 2026-11-25)', await p.evaluate(() => { const l = document.querySelector('#l-xmas').closest('label'), r = l.getBoundingClientRect(); return l.hidden && !r.width && !r.height && !/výzdob/i.test(document.body.innerText); }));
const dnes = await p.evaluate(() => [...document.querySelectorAll('#dnes li')].map((l) => l.textContent));
over('Dnes: vystoupení jarmarku jednotlivě, akce DK zůstává, „Vánoční jarmark“ jako akce DK ne', dnes.some((t) => /Kapela Highland.*Vánoční jarmark/.test(t)) && dnes.some((t) => /Koncert v DK/.test(t)) && !dnes.some((t) => /^Vánoční jarmark/.test(t)), dnes);
over('kluziště pryč z dat i z popisku', !(V.kluziste || []).length && !/kluzi/i.test(await p.evaluate(() => document.querySelector(String.fromCharCode(35) + "l-xmas").closest("label").textContent + document.body.innerText + document.querySelector('#l-xmas').closest('label').title)));
// po skončení (Pavel 2026-11-25): 20. 12. večer ještě termín, 22. 12. bez termínu, ale s poslední akcí 24. 12., v lednu bez termínu i programu
for (const [kdy, termin, program] of [['2026-12-20T21:00:00', true, true], ['2026-12-22T10:00:00', false, true], ['2027-01-10T12:00:00', false, false]]) {
  const q = await b.newPage({ viewport: { width: 1280, height: 860 } });
  q.on('pageerror', (e) => chyby.push(e.message));
  await q.clock.setFixedTime(new Date(kdy));
  await q.route('**/api/program*', (r2) => r2.fulfill({ contentType: 'application/json', body: JSON.stringify({ akce: /jarmark/.test(r2.request().url()) ? [...akce, den('24', '10:00', 'Vánoční burácení')] : [], zdroj: URL_J }) }));
  await q.goto('http://localhost:8000/#zima@48.84870,17.12840,0.12', { waitUntil: 'load' }); await pripraveno(q); await q.waitForTimeout(1200);
  await q.evaluate(() => window.__izo.showVerejne(window.__izo.VEREJNA.find((x) => x.vanoce))); await q.waitForTimeout(800);
  const s = await q.evaluate(() => ({ nadpis: document.querySelector('#cardTitle').textContent, dl: document.querySelector('#cardDl').textContent, text: document.querySelector('#cardText').textContent,
    program: !document.querySelector('#cardProgram').hidden, akce: [...document.querySelectorAll('#cardProgram li')].map((l) => l.textContent), odkaz: document.querySelector('#cardLinks').textContent }));
  over(`karta ${kdy.slice(0, 10)}: ${termin ? 's termínem' : 'bez termínu'}, ${program ? 's programem' : 'bez programu'}`, s.nadpis === 'Vánoční jarmark' && /Termín/.test(s.dl) === termin
    && s.program === program && /skončil/.test(s.text) === !termin && (!program || s.akce.some((t) => /burácení/.test(t))) && /Web/.test(s.odkaz), s);
  await q.close();
}
// telefon: karta s rozbaleným programem nepřeteče do stran
const m = await b.newPage({ viewport: { width: 390, height: 844 } });
await m.clock.setFixedTime(new Date('2026-12-03T15:00:00'));
await m.route('**/api/program*', (r2) => r2.fulfill({ contentType: 'application/json', body: JSON.stringify({ akce, zdroj: URL_J }) }));
await m.goto('http://localhost:8000/#zima@48.84870,17.12840,0.12', { waitUntil: 'load' }); await pripraveno(m); await m.waitForTimeout(1500);
await m.evaluate(() => window.__izo.showVerejne(window.__izo.VEREJNA.find((q) => q.vanoce))); await m.waitForTimeout(700);
await m.click('#cardProgram details summary');
const pret = await m.evaluate(() => { const c = document.querySelector('#card'); return { karta: c.scrollWidth - c.clientWidth, stranka: document.documentElement.scrollWidth - innerWidth }; });
over('telefon 390 px: nic nepřetéká do stran', pret.karta <= 0 && pret.stranka <= 0, pret);
over('chyby stránky', !chyby.length, chyby);
console.log(`\n${ok} v pořádku, ${spatne} špatně`);
await b.close();
process.exit(spatne ? 1 : 0);
