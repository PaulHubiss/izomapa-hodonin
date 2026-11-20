// Snímky typických karet míst vedle sebe (pro sjednocení vzhledu karet, Pavel 2026-11-20).
//   node nastroje-pavel/karty_snimky.mjs [složka] [šířka×výška]       (běžící náhled na :8000)
// Otevře: příběh s programem (DK), restauraci s otevírací dobou, veřejné místo s památkou, budovu s údaji z katastru,
// zastávku. Uloží <složka>/karta-<druh>.png (výchozí snimky/karty) a vypíše výšku každé karty v px.
import { chromium } from 'playwright';
import fs from 'node:fs';
const [dir = 'snimky/karty', okno = '1280x900'] = process.argv.slice(2);
const [w, h] = okno.split('x').map(Number);
fs.mkdirSync(dir, { recursive: true });
const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2 })).newPage();
const chyby = []; p.on('pageerror', (e) => chyby.push(e.message));
await p.goto('http://localhost:8000/', { waitUntil: 'load' });
await p.waitForFunction(() => window.__izo && window.__izo.PLACES, null, { timeout: 30000 });
await p.waitForTimeout(2500);
const KARTY = {
  pribeh: () => { const z = __izo.PLACES.find((q) => q.program) || __izo.PLACES[0]; __izo.placeCard(z); },
  restaurace: () => { const z = __izo.PODNIKY.find((q) => q.oteviraci && q.web) || __izo.PODNIKY[0]; __izo.showPodnik(z); },
  verejne: () => { const z = __izo.VEREJNA.find((q) => q.pam && !q.uMista) || __izo.VEREJNA.find((q) => q.web) || __izo.VEREJNA[0]; __izo.showVerejne(z); },
  budova: async () => {
    let best = null;
    for (const k of ['c0_0', 'c-1_0', 'c0_1', 'c1_0']) {
      const d = await fetch(`overlay/${k}.json`).then((q) => (q.ok ? q.json() : null)).catch(() => null);
      for (const x of d?.buildings || []) if (x.kat?.byty && (!best || x.kat.byty > best.kat.byty)) best = x;
    }
    __izo.showBuilding(best);
  },
  kino: () => { const z = __izo.VEREJNA.find((q) => q.program); if (z) __izo.showVerejne(z); },
  pamatka: () => { const z = __izo.PAMATKY.find((q) => !q.uMista && !q.uVer && q.foto) || __izo.PAMATKY[0]; __izo.showPamatka(z); },
};
for (const [jm, fn] of Object.entries(KARTY)) {
  await p.evaluate(`(${fn.toString()})()`);
  await p.waitForTimeout(jm === 'pribeh' || jm === 'kino' ? 1500 : 500);   // program se načítá zvlášť
  const box = await p.locator('#card').boundingBox();
  await p.evaluate(() => { const c = document.getElementById('card'); c.scrollTop = 0; });
  await p.locator('#card').screenshot({ path: `${dir}/karta-${jm}.png` });
  const t = await p.evaluate(() => document.getElementById('cardTitle').textContent);
  console.log(`${jm.padEnd(10)} ${String(Math.round(box?.height || 0)).padStart(4)} px  ${t}`);
}
console.log('chyby stránky:', chyby.length ? chyby : 'žádné');
await b.close();
