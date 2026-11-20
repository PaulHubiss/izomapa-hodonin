// Předvolby vrstev (F16) a Moje poloha (F18), Pavel 2026-11-18: node nastroje-pavel/test_poloha.mjs [chromium|webkit|firefox]
// (běžící náhled na :8000). Předvolby: každá přepne vrstvy podle tabulky, je zvýrazněná a po ručním přepnutí zhasne.
// Poloha: předstíraná poloha na Masarykově náměstí → tečka a kroužek v mapě, mapa skočí na tečku; druhé klepnutí vypne;
// poloha mimo mapu → hláška. Snímek do snimky/poloha.png (kontrola okem).
import { chromium } from './prohlizec.mjs';
import path from 'node:path';
const KOREN = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const NAMESTI = { latitude: 48.8487, longitude: 17.1285, accuracy: 25 };
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1400, height: 900 }, geolocation: NAMESTI, permissions: ['geolocation'] });
const p = await ctx.newPage();
const chyby = []; p.on('pageerror', (e) => chyby.push(e.message));
let ok = 0, spatne = 0;
const over = (co, v, info = '') => { v ? ok++ : spatne++; console.log(v ? '✅' : '❌', co, info === '' ? '' : `· ${info}`); };
await p.goto('http://localhost:8000/#leto', { waitUntil: 'load' }); await p.waitForTimeout(3000);

// ---------- předvolby ----------
const stav = () => p.evaluate(() => {
  const v = {}; for (const i of document.querySelectorAll('#nb-vrstvy .nb-layers input')) if (!i.closest('label').hidden) v[i.id] = i.checked;
  const zap = [...document.querySelectorAll('.nb-predvolby .px-btn[aria-pressed="true"]')].map((x) => x.title);
  return { v, zap, jmeno: document.querySelector('.nb-predvolba-jmeno')?.textContent };
});
// skutečné klepnutí Playwrightu (na skrytém tlačítku selže), ne element.click() ze stránky
const klik = (t) => p.click(`.nb-predvolby .px-btn[title="${t}"]`);
await p.evaluate(() => document.querySelector('[data-tab="vrstvy"]')?.click()); await p.waitForTimeout(400);
over('předvolby jsou v otevřených Vrstvách vidět', await p.evaluate(() => {
  const b = document.querySelectorAll('.nb-predvolby .px-btn');
  return b.length === 5 && [...b].every((x) => { const r = x.getBoundingClientRect(); return r.width > 20 && r.height > 20 && getComputedStyle(x).visibility === 'visible'; });
}));
over('předvolby jsou v jednom řádku, jen ikonky', await p.evaluate(() => {
  const b = [...document.querySelectorAll('.nb-predvolby .px-btn')], top = b.map((x) => Math.round(x.getBoundingClientRect().top));
  return new Set(top).size === 1 && b.every((x) => x.querySelector('svg') && !x.textContent.trim() && x.title);
}));
let s = await stav();
over('na začátku zvýrazněno „Vše“', s.zap.join() === 'Vše', s.zap.join());
await klik('Jezdím MHD'); s = await stav();
// l-xmas = vánoční výzdoba, jen v sezóně (assets/vanoce.json od–do); předvolby ji nepřepínají (2026-11-20 shodila zkoušku)
const zapnute = Object.entries(s.v).filter(([id, on]) => on && id !== 'l-xmas').map(([id]) => id).sort();
over('Jezdím MHD: jen Doprava (místa), provoz a zvýraznění', zapnute.join() === ['l-hover', 'l-traffic', 'l-v-doprava'].sort().join(), zapnute.join());
over('Jezdím MHD je zvýrazněná a její název u nadpisu', s.zap.join() === 'Jezdím MHD' && s.jmeno === '· Jezdím MHD', `${s.zap.join()} | ${s.jmeno}`);
await klik('Čistá mapa'); s = await stav();
over('Čistá mapa: žádné ikonky míst, život zapnutý', !Object.entries(s.v).some(([id, on]) => on && (id.startsWith('l-v-') || id === 'l-labels' || id === 'l-pam' || id === 'l-pod')) && s.v['l-lide'] && s.v['l-traffic'], JSON.stringify(s.v));
await p.evaluate(() => { const i = document.getElementById('l-v-sport'); i.click(); });
s = await stav();
over('ruční přepnutí zhasne předvolbu', s.zap.length === 0, s.zap.join());
await klik('Vše'); s = await stav();
// vánoční výzdobu předvolby nechávají být (zapíná se podle data), proto se nepočítá
over('Vše zapne všechno', Object.entries(s.v).every(([k, v]) => v || k === 'l-xmas') && s.zap.join() === 'Vše');

// ---------- poloha ----------
over('tlačítko Moje poloha je vidět', await p.isVisible('#poloha'));
// od 2026-11-19 se poloha s povoleným oprávněním zapne sama (66-poloha.js); pak vypnout a ručně zapnout (skok na tečku)
over('s povolením se poloha zapnula sama', await p.evaluate(() => document.getElementById('poloha').getAttribute('aria-pressed') === 'true'));
await p.click('#poloha'); await p.waitForTimeout(300);
await p.click('#poloha'); await p.waitForTimeout(2500);
const pol = await p.evaluate(() => {
  const t = document.querySelector('.poloha-tecka'), k = document.querySelector('.poloha-kruh');
  if (!t || !k) return null;
  const rt = t.getBoundingClientRect(), rk = k.getBoundingClientRect();
  return { tx: rt.x + rt.width / 2, ty: rt.y + rt.height / 2, kw: rk.width, kh: rk.height, kx: rk.x + rk.width / 2, ky: rk.y + rk.height / 2,
    w: innerWidth, h: innerHeight, stisk: document.getElementById('poloha').getAttribute('aria-pressed') };
});
over('tečka a kroužek jsou v mapě', !!pol, JSON.stringify(pol));
if (pol) {
  over('mapa skočila na tečku (blízko středu okna)', Math.abs(pol.tx - pol.w / 2) < 60 && Math.abs(pol.ty - pol.h / 2) < 60, `${Math.round(pol.tx)},${Math.round(pol.ty)}`);
  over('kroužek je kolem tečky', Math.abs(pol.kx - pol.tx) < 4 && Math.abs(pol.ky - pol.ty) < 4);
  over('kroužek je elipsa 2 : 1 (kružnice na zemi)', Math.abs(pol.kw / pol.kh - 2) < 0.15, `${Math.round(pol.kw)} × ${Math.round(pol.kh)} px`);
  over('tlačítko je zapnuté', pol.stisk === 'true');
}
await p.evaluate(() => { document.getElementById('panel').style.visibility = 'hidden'; });
await p.screenshot({ path: path.join(KOREN, 'snimky/poloha.png'), clip: { x: 400, y: 200, width: 600, height: 500 } });
await p.evaluate(() => { document.getElementById('panel').style.visibility = ''; });
await p.click('#poloha'); await p.waitForTimeout(500);
over('druhé klepnutí polohu vypne', await p.evaluate(() => !document.querySelector('.poloha-tecka') && document.getElementById('poloha').getAttribute('aria-pressed') === 'false'));
await ctx.setGeolocation({ latitude: 49.1951, longitude: 16.6068, accuracy: 20 });   // Brno
await p.click('#poloha'); await p.waitForTimeout(1500);
const toast = await p.evaluate(() => !document.getElementById('toast').hidden && document.getElementById('toast').textContent);
over('mimo mapu: hláška a nic v mapě', toast === 'Jste mimo oblast mapy.' && await p.evaluate(() => !document.querySelector('.poloha-tecka')), String(toast));

over('bez chyb na stránce', chyby.length === 0, chyby.join(' | '));
console.log(`\n${ok} ✅ · ${spatne} ❌`);
await b.close();
process.exit(spatne ? 1 : 0);
