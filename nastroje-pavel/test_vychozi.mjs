// Výchozí stav mapy pro nového návštěvníka (Pavel 2026-11-19): podzim, den, skutečný čas NE, jasno, skutečné počasí NE,
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

// 1. nový návštěvník bez povolené polohy, mimo dobu vánoční výzdoby (říjen)
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

// 1b. v době vánoční výzdoby (assets/vanoce.json, 1. 12.): zima s jarmarkem, bez padajícího sněhu (Pavel 2026-11-20);
// podzim zvolený ručně nebo odkazem výzdobu nemá
const c1b = await b.newContext({ viewport: { width: 1400, height: 900 } });
const p1b = await c1b.newPage(); p1b.on('pageerror', (e) => chyby.push(e.message));
await p1b.clock.install({ time: new Date('2026-12-01T10:00:00') });
await p1b.goto('http://localhost:8000/?vychozi', { waitUntil: 'load' }); await p1b.waitForTimeout(3000);
const xmas = () => p1b.evaluate(() => window.__izo.viewer.world._items.some((i) => /xmas/.test(i.source?.tilesUrl || i.source?.url || '')));
const sb = await stav(p1b), xz = await xmas();
await p1b.click('[data-s="autumn"]'); await p1b.waitForTimeout(1500);
const xp = await xmas();
over('výzdoba: zima, jasno, jarmark; na podzim bez jarmarku', sb.obdobi === 'winter' && sb.pocasi === 'clear' && xz && !xp, JSON.stringify({ ...sb, jarmarkZima: xz, jarmarkPodzim: xp }));
await c1b.close();

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
