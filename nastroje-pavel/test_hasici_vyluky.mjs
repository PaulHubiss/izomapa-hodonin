// Zkouška F3 a F11, výjezdy hasičů, výluky a přehled „Dnes v Hodoníně“: node nastroje-pavel/test_hasici_vyluky.mjs
// Prostředníky zastoupí pevná data (požár v centru právě probíhá, nehoda před 3 dny, událost mimo mapu; výluka linek 664 a 912,
// chystaná výluka S91, výluka v Kyjově mimo mapu), takže výsledek nezávisí na dni. Kontroluje ikonky, kartu, přepínač vrstvy
// a odkaz, seznam výluk v panelu, lištu nahoře (zavření přežije obnovení), upozornění v kartě zastávky, rozložení lišty
// a chyby stránky. Nakonec vypíše, co teď skutečně vrací lokální prostředník (jen pro informaci).
import { chromium, pripraveno } from './prohlizec.mjs';   // engine podle PROHLIZEC (chromium, webkit, firefox)
import { sekce } from './sekce.mjs';
const ted = Date.now(), iso = (h) => new Date(ted + h * 3600e3).toISOString();
const HASICI = { zdroj: 'https://udalosti.firebrno.cz/', udalosti: [
  { id: 1, cas: iso(-0.5), typ: 'Požár', typId: 3100, probiha: true, obec: 'Hodonín', ulice: 'Masarykovo náměstí', popis: 'Požár kontejneru.', lat: 48.8486, lon: 17.1283 },
  { id: 2, cas: iso(-72), typ: 'Dopravní nehoda', typId: 3200, probiha: false, obec: 'Hodonín', ulice: 'Národní třída', popis: 'DN 2 OA.', lat: 48.8540, lon: 17.1250 },
  { id: 3, cas: iso(-5), typ: 'Technická pomoc', typId: 3500, probiha: false, obec: 'Suchov', ulice: null, popis: null, lat: 48.90, lon: 17.55 },
] };
const VYLUKY = { zdroj: 'https://www.idsjmk.cz/lockouts/all/current', vyluky: [
  { id: 4729, nazev: 'Výluka v Hodoníně - linky 664 a 912', od: iso(-500), do: iso(500), probiha: true, linky: ['664', '912'], url: 'https://www.idsjmk.cz/lockouts/detail/4729' },
  { id: 4743, nazev: 'Výluka na lince S91 v úseku Veselí nad Moravou - Myjava', od: iso(70), do: iso(120), probiha: false, linky: ['S91'], url: 'https://www.idsjmk.cz/lockouts/detail/4743' },
  { id: 4722, nazev: 'Výluka na linkách S6 a R18 Veselí nad Moravou', od: iso(70), do: iso(120), probiha: false, linky: ['S6', 'R18'], url: 'https://www.idsjmk.cz/lockouts/detail/4722' },   // vlaky mimo Hodonín: ukázat se nesmí
  { id: 4700, nazev: 'Přesun zastávky Kyjov, ČSAD směr centrum', od: iso(-900), do: iso(900), probiha: true, linky: [], url: 'https://www.idsjmk.cz/lockouts/detail/4700' },
] };
const d0 = new Date(); d0.setHours(23, 0, 0, 0);            // akce dnes ve 23:00 (vždy ještě nezačala, leda by zkouška běžela po 23. hodině)
const dnes23 = d0.toISOString().slice(0, 16), zitra19 = new Date(d0.getTime() + 20 * 3600e3).toISOString().slice(0, 16);
const mistni = (iso) => { const d = new Date(iso); const p = (x) => String(x).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };
const PROGRAM = { zdroj: 'https://www.dkhodonin.eu/program', akce: [
  { nazev: 'Koncert dnes', od: mistni(d0), do: null, url: 'https://www.dkhodonin.eu/program/1', druh: 'koncerty' },
  { nazev: 'Divadlo zítra', od: mistni(new Date(d0.getTime() + 20 * 3600e3)), do: null, url: 'https://www.dkhodonin.eu/program/2', druh: 'divadlo' },
  { nazev: 'Ples za týden', od: mistni(new Date(d0.getTime() + 7 * 86400e3)), do: null, url: 'https://www.dkhodonin.eu/program/3', druh: 'plesy' },
] };
// počasí: teď, 48 hodin (místní čas bez zóny, jako Open-Meteo) a 7 dní; jeden kód na ikonku každého druhu
const pulnoc = new Date(); pulnoc.setHours(0, 0, 0, 0);
const omCas = (t) => { const d = new Date(t), z = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}T${z(d.getHours())}:00`; };
const HOD = [...Array(48)].map((_, i) => pulnoc.getTime() + i * 3600e3);
const POCASI = { current: { temperature_2m: -2.4, apparent_temperature: -6.2, weather_code: 3, is_day: 1, precipitation: 0, wind_speed_10m: 3, wind_direction_10m: 200 },
  hourly: { time: HOD.map(omCas), temperature_2m: HOD.map((_, i) => -3 + (i % 24) / 3), weather_code: HOD.map((_, i) => [0, 2, 3, 45, 61, 71][i % 6]),
    precipitation_probability: HOD.map((_, i) => (i % 6 === 4 ? 70 : 10)), is_day: HOD.map((t) => +(new Date(t).getHours() >= 7 && new Date(t).getHours() < 16)) },
  daily: { time: [...Array(7)].map((_, i) => omCas(pulnoc.getTime() + i * 86400e3).slice(0, 10)), weather_code: [3, 0, 2, 61, 71, 95, 45],
    temperature_2m_max: [4.2, 5, 6, 7, 3, 2, 1], temperature_2m_min: [-3.1, -2, -1, 0, -4, -5, -6], precipitation_probability_max: [60, 0, 10, 80, 90, 40, 0] } };
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1200, height: 800 }, permissions: ['clipboard-read', 'clipboard-write'] });
const chyby = [];
// hasiči: mapa se ptá jen HZS přímo (web/hasici_data.js); záloha přes prostředníka zrušena 2026-11-19 (PageSpeed).
// HZS tedy dostane surová data ve svém formátu (S-JTSK: gis1 = Y, gis2 = X; přepočet pyproj EPSG:4326 → 5514) se stejnými
// třemi událostmi jako HASICI výš; dotaz na prostředníka se nesmí objevit.
const SUROVE_HZS = [
  { id: 1, casOhlaseni: iso(-0.5), typId: 3100, stavId: 400, obec: 'Hodonín', ulice: 'Masarykovo náměstí', poznamkaProMedia: 'Požár kontejneru.', gis1: 564312.39, gis2: 1203025.2 },
  { id: 2, casOhlaseni: iso(-72), typId: 3200, stavId: 700, obec: 'Hodonín', ulice: 'Národní třída', poznamkaProMedia: 'DN 2 OA.', gis1: 564508.59, gis2: 1202412.99 },
  { id: 3, casOhlaseni: iso(-5), typId: 3500, stavId: 700, obec: 'Suchov', ulice: null, poznamkaProMedia: null, gis1: 532985.98, gis2: 1200374.57 },
];
let dotazProstrednik = 0;
await ctx.route('https://udalosti.firebrno.cz/**', (r) => r.fulfill({ contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(SUROVE_HZS) }));
await ctx.route('**/api/hasici*', (r) => { dotazProstrednik++; r.abort(); });
await ctx.route('**/api/vyluky*', (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify(VYLUKY) }));
// Kino Svět (2026-11-20): v Dnes jedna souhrnná položka „2 filmy dnes · Kino Svět · od 23:00“
const KINO = { zdroj: 'https://www.kinosvet.eu/', akce: [
  { nazev: 'Film 1', od: mistni(d0), do: null, url: 'https://www.kinosvet.eu/program/1', druh: 'film' },
  { nazev: 'Film 2', od: mistni(new Date(d0.getTime() + 30 * 60e3)), do: null, url: 'https://www.kinosvet.eu/program/2', druh: 'film' },
  { nazev: 'Film zítra', od: mistni(new Date(d0.getTime() + 20 * 3600e3)), do: null, url: 'https://www.kinosvet.eu/program/3', druh: 'film' },
] };
await ctx.route('**/api/program*', (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify(/zdroj=kinosvet/.test(r.request().url()) ? KINO : PROGRAM) }));
await ctx.route('https://api.open-meteo.com/**', (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify(POCASI) }));
// Firefox (BiDi) hlásí schválně přerušený dotaz na HZS (řádek výš, záložní cesta přes prostředníka) jako chybu stránky
// „požadavek CORS nebyl úspěšný“; Chromium a WebKit ho mlčky přejdou. Ta hláška se nepočítá (2026-11-17).
const p = await ctx.newPage(); p.on('pageerror', (e) => { if (/udalosti\.firebrno\.cz/.test(e.message) && /CORS/.test(e.message)) return; chyby.push(e.message); });
await p.goto('http://localhost:8000/#leto@48.8505,17.1268,0.6', { waitUntil: 'load' }); await pripraveno(p, 800);   // štítky mapa ukazuje až pod ~0,8 km výřezu
let ok = 0, spatne = 0;
const over = (co, v, info) => { v ? ok++ : spatne++; console.log(v ? '✅' : '❌', co, info === undefined ? '' : `· ${typeof info === 'string' ? info : JSON.stringify(info)}`); };

// hasiči
// vrstva a ikonky v mapě zrušené (Pavel 2026-11-18), výjezdy jsou jen v sekci Dnes
const hz = await p.evaluate(() => ({ ikon: document.querySelectorAll('.pin.hz').length, prepinac: !!document.querySelector('#l-hz'),
  list: window.__izo.HZ.list.map((u) => u.probiha) }));
over('hasiči: bez ikonek a přepínače, v seznamu jen zásahy v mapě (2 ze 3, probíhající nakonec)', !hz.ikon && !hz.prepinac
  && hz.list.length === 2 && hz.list[1] === true && hz.list[0] === false, hz);
over('hasiči: žádný dotaz na prostředníka /api/hasici (jen přímo HZS)', dotazProstrednik === 0, dotazProstrednik);
await p.evaluate(() => window.__izo.showHasici(window.__izo.HZ.list[1])); await p.waitForTimeout(300);
const karta = await p.evaluate(() => ({ nadpis: document.querySelector('#cardTitle').textContent, text: document.querySelector('#cardText').textContent,
  dl: document.querySelector('#cardDl').textContent, odkazy: [...document.querySelectorAll('#cardLinks a')].map((a) => a.textContent) }));
over('karta požáru', karta.nadpis === 'Požár' && /probíhá zásah/.test(karta.dl) && /dnes \d/.test(karta.dl) && karta.odkazy.includes('Přehled událostí HZS JMK'), karta);
await p.click('#cardClose');

// výluky
// blok pod přehledem Dnes jen s výlukami, které „Ve městě“ ještě nemá (Pavel 2026-11-18): S91 za 3 dny ano,
// probíhající 664/912 ne (je v Ve městě), Kyjov vůbec; karta zastávky dál ukazuje i probíhající (níž)
const panel = await p.evaluate(() => ({ videt: !document.querySelector('#vylukyBox').hidden, n: document.querySelector('#vylukyN').textContent,
  nadpis: document.querySelector('#vylukyNadpis').textContent, polozky: [...document.querySelectorAll('#vyluky li')].map((l) => l.textContent) }));
over('Chystané výluky: jen S91 (probíhající je ve Ve městě), Kyjov ne', panel.videt && panel.nadpis === 'Chystané výluky' && panel.n === '(1)'
  && panel.polozky.length === 1 && /S91/.test(panel.polozky[0]), panel);
// Dnes v Hodoníně: nahoře počasí (Pavel 2026-11-16: velké, s ikonkami a předpovědí), pod ním „Ve městě“:
// probíhající zásah → probíhající výluka → program dnes a zítra; stará nehoda a S91 za 3 dny ne
const dnes = await p.evaluate(() => ({ videt: !document.querySelector('#dnesBox').hidden, nadpis: document.querySelector('#dnesNadpis').textContent,
  pol: [...document.querySelectorAll('#dnes li')].map((l) => l.textContent) }));
const ocek = [/^Požár, Masarykovo náměstíprobíhá/, /^Výluka v Hodoníně/, /^Koncert dnesDům kultury Hodoníndnes 23:00/, /^2 filmy dnesKino Světod 23:00/, /^Divadlo zítraDům kultury Hodonínzítra 19:00/];
over('Dnes v Hodoníně: položky a pořadí', dnes.videt && dnes.nadpis === 'Dnes v Hodoníně' && dnes.pol.length === ocek.length && ocek.every((r, i) => r.test(dnes.pol[i])), dnes);
await p.click('#nbRail [data-tab=dnes]'); await p.waitForTimeout(300);
// ikonka programu v barvě Kultury (Pavel 2026-11-18: sjednotit s Vrstvami, Místy a mapou)
const ikProg = await p.evaluate(() => { const li = [...document.querySelectorAll('#dnes li')].find((l) => /Koncert dnes/.test(l.textContent));
  const k = window.IZO_KAT.find((c) => c.k === 'kultura').barva, s = document.createElement('span'); s.style.color = k; document.body.append(s);
  const ocek = getComputedStyle(s).color; s.remove(); return { barva: li && getComputedStyle(li.querySelector('.dnes-ico svg')).color, ocek }; });
over('Dnes: ikonka programu v barvě Kultury', ikProg.barva === ikProg.ocek, ikProg);
const pc = await p.evaluate(() => { const box = document.querySelector('#dnesPocasi'), rady = [...box.querySelectorAll('.pc-rada')];
  const sloupce = rady.map((r) => [...r.children].map((li) => Math.round(li.getBoundingClientRect().left)));
  return { videt: !box.hidden && box.offsetHeight > 0, teplota: box.querySelector('.pc-teplota')?.textContent, slovy: box.querySelector('.pc-slovy')?.textContent,
    velikost: parseFloat(getComputedStyle(box.querySelector('.pc-teplota')).fontSize), ikona: Math.round(box.querySelector('.pc-ted .pc-ik svg').getBoundingClientRect().width),
    detail: box.querySelector('.pc-detail')?.textContent.replace(/\s+/g, ' ').trim(), hodiny: rady[0]?.children.length, dny: rady[1] && [...rady[1].children].map((li) => li.textContent),
    ikon: box.querySelectorAll('.pc-rada .pc-ik svg').length, sloupcePodSebou: JSON.stringify(sloupce[0]) === JSON.stringify(sloupce[1]),
    preteka: [...box.querySelectorAll('*')].filter((e) => e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflow !== 'visible').length,
    sirka: box.scrollWidth <= box.clientWidth, mesto: !document.querySelector('#dnesUdalosti').hidden }; });
over('počasí: velká teplota s ikonkou, pocitově, vítr, dnes od–do, srážky', pc.videt && /^−2\s°C$/.test(pc.teplota) && pc.velikost >= 30 && pc.ikona >= 40
  && /pocitově −6/.test(pc.detail) && /vítr 3/.test(pc.detail) && /dnes −3 až 4/.test(pc.detail) && /srážky 60/.test(pc.detail), pc);
over('počasí: 5 hodin a 5 dní s ikonkami, sloupce pod sebou, nic nepřetéká', pc.hodiny === 5 && pc.dny?.length === 5 && /^Zítra/.test(pc.dny[0]) && pc.ikon === 10   // 5 bloků (Pavel 2026-11-20)
  && pc.sloupcePodSebou && pc.sirka && pc.mesto, pc);
// horní lišta se zprávami je zrušená (Pavel 2026-11-16: totéž je v sekci Dnes)
over('lišta Dnes nahoře není', await p.evaluate(() => !document.querySelector('#dnesBar') && !document.querySelector('.dnes-bar')));
await sekce(p, '#dnes'); await p.locator('#dnes button', { hasText: 'Koncert dnes' }).click(); await p.waitForTimeout(600);
over('klik na akci v panelu otevře kartu DK', await p.evaluate(() => document.querySelector('#cardTitle').textContent === 'Dům kultury Hodonín'));
await p.click('#cardClose');
// karta zastávky, kde staví 664 nebo 912
const zast = await p.evaluate(() => {
  const M = window.__izo.MHD, idx = new Set(M.routes.map((r, i) => (['664', '912'].includes(String(r[0])) ? i : -1)).filter((i) => i >= 0));
  const t = M.trips.find((q) => idx.has(q[0])); if (!t) return null;
  const s = M.stopPts.find((q) => q.n === t[6][2]); window.__izo.showStop(s);
  return { nazev: document.querySelector('#cardTitle').textContent, vyl: document.querySelector('#cardVyl').hidden ? null : document.querySelector('#cardVyl').textContent };
});
over('karta zastávky linky 664/912 ukáže výluku', zast && zast.vyl && /664|912/.test(zast.vyl), zast);
// odjezdy (2026-11-16): seznam štítek · směr · čas; čas se neláme (jeden řádek času + „za N min“), nic nepřetéká kartu
for (const [w, h] of [[1200, 800], [390, 844]]) {
  await p.setViewportSize({ width: w, height: h }); await p.waitForTimeout(300);
  const r = await p.evaluate(() => {
    const karta = document.querySelector('#card').getBoundingClientRect(), radky = [...document.querySelectorAll('#cardDl .odj')];
    const lh = (e) => parseFloat(getComputedStyle(e).lineHeight) || 20;
    return { n: radky.length,
      casZlomeny: radky.filter((o) => { const c = o.querySelector('dd b'); return c.getBoundingClientRect().height > lh(c) * 1.5; }).length,
      preteka: radky.filter((o) => o.getBoundingClientRect().right > karta.right + 0.5 || o.scrollWidth > o.clientWidth + 0.5).length,
      linka: radky.every((o) => /^\S+$/.test(o.querySelector('.linka').textContent)) };
  });
  over(`odjezdy ${w} px: čas na jednom řádku, nic nepřetéká`, r.n > 0 && !r.casZlomeny && !r.preteka && r.linka, r);
}
await p.setViewportSize({ width: 1200, height: 800 });
// přímá cesta: surová odpověď HZS (S-JTSK) → ikonka na Masarykově náměstí; prostředník zablokovaný, ať se nepoužije
{
  const c2 = await b.newContext({ viewport: { width: 1200, height: 800 } }), p2 = await c2.newPage();
  const SUROVE = [{ id: 999, casOhlaseni: new Date(Date.now() - 600e3).toISOString(), typId: 3100, stavId: 400, obec: 'Hodonín', ulice: 'Masarykovo náměstí',
    poznamkaProMedia: 'Zkouška přímé cesty', gis1: 564312.39, gis2: 1203025.2 }];   // 48,8487 / 17,1285 (pyproj EPSG:5514)
  let dotazHZS = null;
  await c2.route('https://udalosti.firebrno.cz/**', (r) => { dotazHZS = r.request().url(); r.fulfill({ contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(SUROVE) }); });
  await c2.route('**/api/hasici*', (r) => r.abort());
  await p2.goto('http://localhost:8000/#leto@48.8505,17.1268,0.6', { waitUntil: 'load' }); await pripraveno(p2, 800);
  const r = await p2.evaluate(() => ({ n: window.__izo.HZ.list.length, u: window.__izo.HZ.list[0], ikon: document.querySelectorAll('.pin.hz').length }));
  over('přímo od HZS: dotaz na kraj a okres, převod S-JTSK, bez ikonky v mapě', r.n === 1 && r.ikon === 0 && Math.abs(r.u.lat - 48.8487) < 3e-5 && Math.abs(r.u.lon - 17.1285) < 3e-5
    && r.u.probiha && /krajId=116/.test(dotazHZS) && /okresId=3706/.test(dotazHZS), { ...r, dotazHZS: dotazHZS && dotazHZS.slice(0, 80) });
  await c2.close();
}
console.log(`\n${ok} v pořádku, ${spatne} špatně · chyby stránky: ${chyby.length ? chyby.join(' / ') : 'žádné'}`);

// skutečná data teď (bez náhrady), z Node: prohlížeč z prázdné stránky na localhost nesmí (CORS) a vrátil by falešné nuly
const h = (await fetch('http://127.0.0.1:8000/api/hasici?kraj=116&okres=3706&dni=7').then((r) => r.json()).catch(() => ({}))).udalosti || [];
const v = (await fetch('http://127.0.0.1:8000/api/vyluky?oblast=Hodon%C3%ADnsko').then((r) => r.json()).catch(() => ({}))).vyluky || [];
console.log(`\nskutečně teď: hasiči v okrese za 7 dní ${h.length} (z toho Hodonín ${h.filter((u) => u.obec === 'Hodonín').length}, probíhá ${h.filter((u) => u.probiha).length}), výluky na Hodonínsku ${v.length}`);
await b.close();
process.exit(spatne || chyby.length ? 1 : 0);
