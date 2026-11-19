// Zkouška živých poloh MHD v náhledu: node nastroje-pavel/test_live_mhd.mjs [sekund čekání]
// Vypíše, kolik vozidel přišlo z proudu, kolik se spárovalo se spoji jízdního řádu a jaké mají zpoždění.
import { chromium } from './prohlizec.mjs';   // engine podle PROHLIZEC (chromium, webkit, firefox)
const wait = (+process.argv[2] || 40) * 1000;
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1200, height: 800 } });
const chyby = [];
p.on('pageerror', (e) => chyby.push(e.message));
p.on('console', (m) => { if (m.type() === 'error') chyby.push(m.text()); });
await p.goto('http://localhost:8000/', { waitUntil: 'load' });
await p.waitForTimeout(wait);
const r = await p.evaluate(() => {
  const z = window.__izo; if (!z) return { chyba: 'window.__izo chybí (jen na localhost)' };
  const { MHD, LIVE } = z;
  const sp = [...LIVE.off.keys()].map((i) => {
    const t = MHD.trips[i]; return `${MHD.routes[t[0]][0]}: zpoždění ${Math.round(LIVE.delay.get(i) / 60)} min, posun ${Math.round(LIVE.off.get(i))} s`;
  });
  return { zive: LIVE.on, vozidel: LIVE.v.size, linky: [...new Set([...LIVE.v.values()].map((v) => v.line))].sort(),
           jedoucichSpoju: MHD.act.length, sparovano: LIVE.off.size, ukazky: sp.slice(0, 12) };
});
console.log(JSON.stringify(r, null, 1));
console.log('chyby v konzoli:', chyby.length ? chyby.slice(0, 5) : 'žádné');
await b.close();
