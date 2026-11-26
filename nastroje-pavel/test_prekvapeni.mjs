// Skrytá překvapení (doplněk doplnky/prekvapeni): node nastroje-pavel/test_prekvapeni.mjs [složka-na-snímky] (běžící náhled na :8000)
// Klik na kostel, výběh lvů, komín elektrárny a do Moravy spustí své překvapení (window.__test.prekvapeni) a běžné kliknutí
// běží dál (karta budovy). Vodník je náhodný, ale po třech marných klicích určitě. Se složkou uloží snímky v půlce efektu.
import { chromium, pripraveno } from './prohlizec.mjs';
const SN = process.argv[2];
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1200, height: 800 } });
await ctx.addInitScript(() => { window.__test = {}; });
const p = await ctx.newPage();
const chyby = []; p.on('pageerror', (e) => chyby.push(e.message));
let ok = 0, spatne = 0;
const over = (co, v, info = '') => { v ? ok++ : spatne++; console.log(v ? '✅' : '❌', co, info === '' ? '' : `· ${info}`); };
const otevri = async (hash) => { await p.goto('about:blank'); await p.goto(`http://localhost:8000/#${hash}`, { waitUntil: 'load' }); await pripraveno(p, 1500);
  await p.waitForFunction(() => window.__test.prekvapeniPripraveno, null, { timeout: 20000 });     // doplňky se načítají až po mapě
  await p.waitForTimeout(2500); };                                                                 // a mapa dojede animaci přiblížení
const stred = async () => p.evaluate(() => { const r = document.getElementById('fx').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
const spustene = () => p.evaluate(() => window.__test.prekvapeni || []);
const D = async () => p.evaluate(() => Izomapa.getPluginData('prekvapeni'));
// bod obrázku → odkaz na místo (střed obrazovky = ten bod na zemi)
const kam = (ix, iy) => p.evaluate(([ix, iy]) => { const [x, y] = Izomapa.imgToWorld(ix, iy); const [lat, lon] = Izomapa.worldToLatLon(x, y); return `${lat.toFixed(6)},${lon.toFixed(6)}`; }, [ix, iy]);

await otevri('leto@48.84903,17.1285,0.3');
const d = await D();
over('data doplňku: kostel, zoo, komíny, voda', d && d.kostel && d.zoo && d.kominy?.length >= 1 && d.voda?.length >= 1, d && `${d.kominy?.length} komíny, ${d.voda?.length} vodních ploch`);

// bod obrázku → bod na obrazovce (ikonky míst leží ve středu výřezu, klik na ně do mapy nedojde, proto se kliká vedle)
const naObr = (ix, iy) => p.evaluate(([ix, iy]) => { const v = __izo.viewer, q = v.viewport.pixelFromPoint(new OpenSeadragon.Point(ix / __izo.W, iy / __izo.W), true), r = v.element.getBoundingClientRect(); return [r.left + q.x, r.top + q.y]; }, [ix, iy]);
async function zkus(nazev, typ, hash, kliku = 1, pauza = 0, cil = null) {
  await otevri(hash);
  const bod = cil ? await cil() : await stred();
  over(`${nazev}: našel se bod ke kliknutí`, !!bod); if (!bod) return;
  const [x, y] = bod;
  over(`${nazev}: na místě kliku není ikonka`, await p.evaluate(([x, y]) => !document.elementFromPoint(x, y)?.closest('.pin'), [x, y]));
  for (let i = 0; i < kliku; i++) { await p.mouse.click(x, y); if (pauza) await p.waitForTimeout(pauza); }
  await p.waitForTimeout(typ === 'komin' ? 2500 : 700);
  if (SN) await p.screenshot({ path: `${SN}/prekvapeni-${typ}.png` });
  const s = await spustene();
  over(`${nazev}: překvapení se spustí`, s.includes(typ), s.join(', '));
  if (typ !== 'komin') { const z = await p.evaluate(() => window.__test.zvuky || []); over(`${nazev}: zazní zvuk`, z.includes(typ), z.join(', ')); }
  over(`${nazev}: karta se otevře dál`, typ === 'vodnik' || await p.evaluate(() => !document.getElementById('card').hidden));
}
// kostel: střed půdorysu budovy; zoo: výběh; komín: pata komína; voda: bod uvnitř největší vodní plochy
const kost = d.kostel.hull, sp = d.kostel.spicka, kx = kost.reduce((a, q) => a + q[0], 0) / kost.length, ky = Math.max(...kost.map((q) => q[1])) - 15;
// kostel: první bod budovy (od věže dolů), kde neleží ikonka místa a není ani blízko ní (klik u ikonky otevře příběh a
// mapa ho dál nepustí; 2026-11-26 po snížení obrysu modelů padl první bod těsně k ikonce příběhu na věži)
const volnyBod = () => p.evaluate((H) => {
  const inP = (x, y) => { let c = false; for (let i = 0, j = H.length - 1; i < H.length; j = i++) { const [xi, yi] = H[i], [xj, yj] = H[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; };
  const piny = [...document.querySelectorAll('.pin')].map((e) => e.getBoundingClientRect()).filter((q) => q.width).map((q) => [q.left + q.width / 2, q.top + q.height / 2]);
  const dalOdPinu = (X, Y) => piny.every(([a, b]) => Math.hypot(X - a, Y - b) > 40);
  const v = __izo.viewer, r = v.element.getBoundingClientRect(), xs = H.map((q) => q[0]), ys = H.map((q) => q[1]);
  // nejdřív střed obrysu (horní okraj u věže má ve WebKitu klik u ikonky příběhu, ověřeno 2026-11-26), pak hledat
  const cx = xs.reduce((a, b) => a + b, 0) / xs.length, cy = ys.reduce((a, b) => a + b, 0) / ys.length;
  if (inP(cx, cy)) { const q = v.viewport.pixelFromPoint(new OpenSeadragon.Point(cx / __izo.W, cy / __izo.W), true), X = r.left + q.x, Y = r.top + q.y;
    const e = document.elementFromPoint(X, Y); if (e && e.closest('#osd') && !e.closest('.pin')) return [X, Y]; }   // střed: ikonka 20 px vedle nevadí (ověřeno)
  for (let y = Math.min(...ys) + 10; y < Math.max(...ys); y += 8) for (let x = Math.min(...xs) + 5; x < Math.max(...xs); x += 8) {
    if (!inP(x, y)) continue;
    const q = v.viewport.pixelFromPoint(new OpenSeadragon.Point(x / __izo.W, y / __izo.W), true), X = r.left + q.x, Y = r.top + q.y;
    const e = document.elementFromPoint(X, Y); if (e && e.closest('#osd') && !e.closest('.pin') && dalOdPinu(X, Y)) return [X, Y];
  }
  return null; }, kost);
await zkus('kostel', 'kostel', `leto@${await kam(kx, ky)},0.3`, 1, 0, volnyBod);
// polohu na obrazovce počítat až po načtení místa: latLonToImg bere výšku terénu z načtených čtverců
await zkus('lev', 'zoo', `leto@${d.zoo.lat},${d.zoo.lon},0.25`, 1, 0, async () => {                                 // výběh vedle středu
  const z0 = await p.evaluate((z) => Izomapa.latLonToImg(z.lat, z.lon, 0), d.zoo); return naObr(z0[0] + 25, z0[1] + 10); });
const k0 = d.kominy[0];
await zkus('komín', 'komin', `leto@${k0.lat},${k0.lon},0.6`, 1, 0, async () => {                                     // komín ve výšce 60 %
  const kt = await p.evaluate((k) => Izomapa.latLonToImg(k.lat, k.lon, k.h * 0.6), k0); return naObr(kt[0], kt[1]); });
const voda = d.voda.map((P) => P[0]).sort((a, b) => b.length - a.length)[0];
const vb = await p.evaluate((P) => { // bod uvnitř: střed nejdelšího vodorovného řezu prostředkem
  const ys = P.map((q) => q[1]), y = (Math.min(...ys) + Math.max(...ys)) / 2, xs = [];
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [xi, yi] = P[i], [xj, yj] = P[j]; if ((yi > y) !== (yj > y)) xs.push(xi + (y - yi) * (xj - xi) / (yj - yi)); }
  xs.sort((a, b) => a - b); let best = [0, 0]; for (let i = 0; i + 1 < xs.length; i += 2) if (xs[i + 1] - xs[i] > best[1] - best[0]) best = [xs[i], xs[i + 1]];
  return [(best[0] + best[1]) / 2, y]; }, voda);
await zkus('vodník', 'vodnik', `leto@${await kam(vb[0], vb[1])},0.25`, 4, 1600);
over('chyby stránky', !chyby.length, JSON.stringify(chyby));
console.log(`\n${ok} v pořádku, ${spatne} špatně`);
await b.close(); process.exit(spatne ? 1 : 0);
