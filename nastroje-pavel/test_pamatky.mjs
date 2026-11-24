// Zkouška vrstvy památek: node nastroje-pavel/test_pamatky.mjs
// Ikonky v mapě, karta památky (fotka, autor, licence, odkazy), karta budovy kostela, přepínač vrstvy, hledání.
import { chromium } from './prohlizec.mjs';   // engine podle PROHLIZEC (chromium, webkit, firefox)
import { sekce } from './sekce.mjs';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1200, height: 800 } });
const chyby = [];
p.on('pageerror', (e) => chyby.push(e.message));
await p.goto('http://localhost:8000/', { waitUntil: 'load' });
await p.waitForTimeout(4000);
// hledání → přiblíží na zámek a otevře kartu
await sekce(p, '#q');
await p.fill('#q', 'zámek');
await p.waitForTimeout(800);
await p.keyboard.press('Enter');
await p.waitForTimeout(3500);
const karta = await p.evaluate(async () => {
  const img = document.querySelector('#cardFotoImg');
  for (let i = 0; i < 40 && !(img.complete && img.naturalWidth); i++) await new Promise((r) => setTimeout(r, 250));
  return { nadpis: document.querySelector('#cardTitle').textContent, foto: !document.querySelector('#cardFoto').hidden, nacteno: img.naturalWidth,
           popisek: document.querySelector('#cardFotoCap').textContent,
           radky: [...document.querySelectorAll('#cardDl dt')].map((dt) => `${dt.textContent}: ${dt.nextElementSibling.textContent}`),
           odkazy: [...document.querySelectorAll('#cardLinks a')].map((a) => a.textContent),
           ikonek: document.querySelectorAll('.pin.kat-pamatky').length, viditelnych: [...document.querySelectorAll('.pin.kat-pamatky')].filter((e) => e.offsetParent).length };
});
console.log('ZÁMEK (hledání):', JSON.stringify(karta, null, 1));
await p.locator('#card').screenshot({ path: 'snimky/test-pamatka-karta.png' });
await p.evaluate(() => { document.querySelector('#card').hidden = true; });
await p.screenshot({ path: 'snimky/test-pamatky-mapa.png' });
// karta budovy, ve které leží kostel sv. Vavřince
const kostel = await p.evaluate(async () => {
  const z = window.__izo, pk = z.PAMATKY.find((q) => q.nazev.startsWith('Kostel'));
  const inPoly = (x, y, h) => { let c = false; for (let i = 0, j = h.length - 1; i < h.length; j = i++) if ((h[i][1] > y) !== (h[j][1] > y) && x < (h[j][0] - h[i][0]) * (y - h[i][1]) / (h[j][1] - h[i][1]) + h[i][0]) c = !c; return c; };
  const d = await fetch(`overlay/${pk.k}.json`).then((r) => r.json());
  const bb = d.buildings.find((q) => q.hull && inPoly(pk.xy[0], pk.xy[1], q.hull));
  if (!bb) return 'budova kostela nenalezena';
  z.showBuilding(bb);
  return { nadpis: document.querySelector('#cardTitle').textContent, foto: !document.querySelector('#cardFoto').hidden,
           radky: [...document.querySelectorAll('#cardDl dt')].map((dt) => dt.textContent), odkazy: [...document.querySelectorAll('#cardLinks a')].map((a) => a.textContent) };
});
console.log('BUDOVA KOSTELA:', JSON.stringify(kostel, null, 1));
// všech 19 karet (2026-11-18, před spuštěním): fotka z Commons s autorem, licencí a odkazem na soubor – i když je památka
// sloučená s příběhem, kostelem nebo muzeem (karta toho místa). Autory a licence proti Commons hlídá over_fotky.py.
const fotky = await p.evaluate(() => window.__izo.PAMATKY.filter((q) => q.foto).map((q) => {
  window.__izo.showPamatka(q);
  const cap = document.querySelector('#cardFotoCap'), a = cap.querySelector('a');
  const ok = !document.querySelector('#cardFoto').hidden && cap.textContent.includes(q.foto.autor) && cap.textContent.includes(q.foto.licence)
    && a?.href === q.foto.stranka && document.querySelector('#cardFotoA').href === q.foto.stranka;
  return ok ? null : `${q.nazev} (${q.uMista ? 'místo' : q.uVer ? 'veřejné' : 'památka'}): ${cap.textContent}`;
}).filter(Boolean));
console.log(fotky.length ? `❌ karty bez správného popisku fotky: ${fotky.join(' | ')}` : '✅ všech 19 karet: fotka, autor, licence a odkaz na Commons');
if (fotky.length) process.exitCode = 1;
// párování jen téhož druhu (2026-11-24): kostel sv. Metoděje nemá fotku hřbitova, hřbitov má vlastní ikonku památky; ostatní dvojice zůstaly
const par = await p.evaluate(() => { const z = window.__izo, V = (n) => z.VEREJNA.find((v) => v.nazev === n), P = (n) => z.PAMATKY.find((q) => q.nazev === n);
  z.showVerejne(V('Kostel sv. Metoděje'));
  return { metodejBezFotky: document.querySelector('#cardFoto').hidden, hrbitovSeHrbitovem: P('Městský hřbitov Hodonín').uVer?.druh === 'Hřbitov',
           zamek: V('Masarykovo Muzeum v Hodoníně').pam?.nazev === 'Zámek Hodonín', skola: V('ZŠ Mírové Náměstí').pam?.nazev === 'Základní škola',
           galerie: V('Galerie výtvarného umění v Hodoníně').pam?.nazev === 'Galerie Dům umění' }; });
const parOk = Object.values(par).every(Boolean);
console.log(parOk ? '✅ památky spárované jen s místem téhož druhu' : `❌ párování památek: ${JSON.stringify(par)}`);
if (!parOk) process.exitCode = 1;
// přepínač vrstvy
await p.evaluate(() => { const c = document.querySelector('#l-pam'); c.checked = false; c.dispatchEvent(new Event('change')); });
const poVypnuti = await p.evaluate(() => [...document.querySelectorAll('.pin.kat-pamatky')].filter((e) => e.offsetParent).length);
console.log('viditelných ikonek po vypnutí vrstvy:', poVypnuti, '· chyby:', chyby.length ? chyby : 'žádné');
await b.close();
