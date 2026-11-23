// Výchozí stav mapy pro nového návštěvníka (Pavel 2026-11-19, 2026-11-21, 2026-11-23): roční období podle kalendáře (v sezónním
// startu z mesto.json zima se sněžením a pohled na jarmark), den, skutečný čas NE, jasno, skutečné počasí NE,
// úsporný režim NE, předvolba Vše, Moje poloha zapnutá jen tomu, kdo ji už povolil.
// node nastroje-pavel/test_vychozi.mjs   (běžící náhled na :8000)
import { chromium } from './prohlizec.mjs';
const b = await chromium.launch();
let ok = 0, spatne = 0;
const over = (co, v, info = '') => { v ? ok++ : spatne++; console.log(v ? '✅' : '❌', co, info === '' ? '' : `· ${info}`); };
const stav = (p) => p.evaluate(() => ({
  obdobi: document.querySelector('[data-s][aria-pressed="true"]')?.dataset.s,
  noc: +document.getElementById('night').value,
  skutCas: document.getElementById('realTime').checked,
  pocasi: document.querySelector('[data-w][aria-pressed="true"]')?.dataset.w,
  skutPocasi: document.getElementById('realWeather').checked,
  eko: document.getElementById('ecoBox')?.checked ?? null,
  predvolba: document.querySelector('.nb-predvolby [aria-pressed="true"]')?.title,
  poloha: document.getElementById('poloha')?.getAttribute('aria-pressed'),
}));

// 1. nový návštěvník bez povolené polohy, v říjnu
const c1 = await b.newContext({ viewport: { width: 1400, height: 900 } });
const p1 = await c1.newPage(); const chyby = []; p1.on('pageerror', (e) => chyby.push(e.message));
await p1.clock.install({ time: new Date('2026-10-15T10:00:00') });
await p1.goto('http://localhost:8000/?vychozi', { waitUntil: 'load' }); await p1.waitForTimeout(3000);
const s = await stav(p1);
over('podzim (říjen)', s.obdobi === 'autumn', s.obdobi);
over('den (posuvník na 0)', s.noc === 0, s.noc);
over('skutečný čas vypnutý', !s.skutCas);
over('jasno', s.pocasi === 'clear', s.pocasi);
over('skutečné počasí vypnuté', !s.skutPocasi);
over('úsporný režim vypnutý', s.eko === false, String(s.eko));
over('předvolba Vše', s.predvolba === 'Vše', s.predvolba);
over('Moje poloha vypnutá (bez povolení se nikoho neptá)', s.poloha === 'false', s.poloha);
over('chyby stránky', !chyby.length, chyby.join(' | '));
// zapamatování: zapnu skutečné počasí, po novém načtení zůstane
await p1.evaluate(() => { const r = document.getElementById('realWeather'); r.checked = true; r.dispatchEvent(new Event('change')); });
await p1.reload({ waitUntil: 'load' }); await p1.waitForTimeout(2500);
over('zapnuté skutečné počasí si mapa pamatuje', (await stav(p1)).skutPocasi);
await c1.close();

// 1b. období podle kalendáře (Pavel 2026-11-21: žádná data u vzhledu, zima = výzdoba a Santa):
// únor = zima s jarmarkem, ručně zvolený podzim bez jarmarku; ručně zvolená zima v létě jarmark má.
// Sezónní start z mesto.json "sezonni_start" (Pavel 2026-11-23): 23. 11. – 29. 2. zima, sněžení a pohled na jarmark (náměstí)
const xmasNa = (p) => p.evaluate(() => window.__izo.viewer.world._items.some((i) => /xmas/.test(i.source?.tilesUrl || i.source?.url || '')));
const SEZONA = { '2026-02-10': 1, '2026-11-25': 1, '2026-12-01': 1 };
const naNamesti = (p) => p.evaluate(() => { const at = location.hash.split('@')[1]?.split(',').map(Number) || []; return at.length >= 3 && Math.abs(at[0] - 48.8487) < 0.002 && Math.abs(at[1] - 17.1285) < 0.003 && at[2] < 0.6; });
for (const [datum, ceka] of [['2026-02-10', 'winter'], ['2026-04-10', 'spring'], ['2026-07-10', 'summer'], ['2026-11-21', 'autumn'], ['2026-11-25', 'winter'], ['2026-12-01', 'winter']]) {
  const c = await b.newContext({ viewport: { width: 1400, height: 900 } });
  const p = await c.newPage(); p.on('pageerror', (e) => chyby.push(e.message));
  await p.clock.install({ time: new Date(`${datum}T10:00:00`) });
  await p.goto('http://localhost:8000/?vychozi', { waitUntil: 'load' }); await p.waitForTimeout(3000);
  const st = await stav(p);
  const sez = !!SEZONA[datum], nam = await naNamesti(p);
  let info = { ...st, naNamesti: nam };
  let v = st.obdobi === ceka && st.pocasi === (sez ? 'snow' : 'clear') && nam === sez;
  if (datum === '2026-02-10') {
    const xz = await xmasNa(p); await p.click('[data-s="autumn"]'); await p.waitForTimeout(1500); const xp = await xmasNa(p);
    v = v && xz && !xp; info = { ...info, jarmarkZima: xz, jarmarkPodzim: xp };
  }
  if (datum === '2026-07-10') {
    await p.click('[data-s="winter"]'); await p.waitForTimeout(1500); const xz = await xmasNa(p);
    v = v && xz; info = { ...info, jarmarkZimaVLete: xz };
  }
  over(`${datum}: ${ceka}, ${sez ? 'sněžení, pohled na jarmark' : 'jasno, celé město'}`, v, JSON.stringify(info));
  await c.close();
}

// 2. návštěvník, který polohu povolil a je v Hodoníně (náměstí)
const c2 = await b.newContext({ viewport: { width: 1400, height: 900 }, permissions: ['geolocation'], geolocation: { latitude: 48.8487, longitude: 17.1285, accuracy: 20 } });
const p2 = await c2.newPage();
await p2.goto('http://localhost:8000/?vychozi', { waitUntil: 'load' }); await p2.waitForTimeout(3500);
over('s povolenou polohou se zapne sama', (await stav(p2)).poloha === 'true', (await stav(p2)).poloha);
over('modrá tečka v mapě', await p2.evaluate(() => !!document.querySelector('.poloha-tecka')));
await c2.close();

// 3. povolená poloha, ale mimo mapu (Brno): potichu vypnutá, bez hlášky
const c3 = await b.newContext({ viewport: { width: 1400, height: 900 }, permissions: ['geolocation'], geolocation: { latitude: 49.195, longitude: 16.608, accuracy: 20 } });
const p3 = await c3.newPage();
await p3.goto('http://localhost:8000/?vychozi', { waitUntil: 'load' }); await p3.waitForTimeout(3500);
const t3 = await p3.evaluate(() => ({ poloha: document.getElementById('poloha')?.getAttribute('aria-pressed'), toast: document.getElementById('toast').hidden ? '' : document.getElementById('toast').textContent }));
over('mimo mapu: vypnutá a bez hlášky', t3.poloha === 'false' && !t3.toast.includes('mimo'), JSON.stringify(t3));
await c3.close();

console.log(`\n${ok} v pořádku, ${spatne} špatně`);
await b.close();
process.exit(spatne ? 1 : 0);
