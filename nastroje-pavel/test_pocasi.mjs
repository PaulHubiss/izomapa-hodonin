// Počasí v sekci Dnes (Pavel 2026-11-25: „přestalo fungovat“): node nastroje-pavel/test_pocasi.mjs   (běžící náhled na :8000)
// Odpovědi Open-Meteo jsou předstírané: 1. hned správně, 2. první dotaz odmítnutý (429), druhý správně → počasí se objeví samo
// do 15 s bez obnovení stránky, 3. spojení spadne → totéž. Při výpadku nejsou na stránce chyby.
import { chromium } from './prohlizec.mjs';
import { sekce } from './sekce.mjs';
const hod = [...Array(168)].map((_, i) => { const d = new Date(Date.now() + i * 3600e3); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:00`; });
const den = [...new Set(hod.map((t) => t.slice(0, 10)))].slice(0, 7), N = (a, v) => a.map(() => v);
const TELO = JSON.stringify({ current: { temperature_2m: 7.4, apparent_temperature: 5, weather_code: 3, is_day: 1, wind_speed_10m: 12, precipitation: 0, wind_direction_10m: 270 },
  hourly: { time: hod, temperature_2m: N(hod, 7), weather_code: N(hod, 3), precipitation_probability: N(hod, 10), is_day: N(hod, 1) },
  daily: { time: den, weather_code: N(den, 3), temperature_2m_max: N(den, 9), temperature_2m_min: N(den, 2), precipitation_probability_max: N(den, 10) } });
const b = await chromium.launch();
let ok = 0, spatne = 0;
const over = (co, v, info = '') => { v ? ok++ : spatne++; console.log(v ? '✅' : '❌', co, info === '' ? '' : `· ${info}`); };
for (const [jm, prvni] of [['dotaz projde napoprvé', null], ['první dotaz odmítnutý (429)', '429'], ['první spojení spadne', 'spadne']]) {
  const p = await (await b.newContext({ viewport: { width: 1400, height: 900 } })).newPage();
  const chyby = []; p.on('pageerror', (e) => { if (!e.message.includes('open-meteo')) chyby.push(e.message); });   // Firefox hlásí i předstíraný výpadek sítě
  let n = 0;
  await p.route(/api\.open-meteo\.com/, (r) => {
    const predpoved = r.request().url().includes('hourly=');
    if (predpoved && ++n === 1 && prvni) return prvni === '429' ? r.fulfill({ status: 429, headers: { 'access-control-allow-origin': '*' }, body: '{"error":true}' }) : r.abort();
    return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: TELO });
  });
  await p.goto('http://localhost:8000/#leto', { waitUntil: 'load' }); await p.waitForTimeout(4000);
  if (prvni) over(`${jm}: zatím bez počasí`, n === 1 && await p.evaluate(() => document.getElementById('dnesPocasi').hidden), `${n} dotaz`);
  const t0 = Date.now();
  const videt = await p.waitForFunction(() => !document.getElementById('dnesPocasi').hidden, null, { timeout: 15000 }).then(() => true, () => false);
  await sekce(p, '#dnesPocasi'); await p.waitForTimeout(300);
  const s = await p.evaluate(() => ({ teplota: document.querySelector('.pc-teplota')?.textContent, bunek: document.querySelectorAll('.pc-rada li').length, vyska: document.getElementById('dnesPocasi').getBoundingClientRect().height }));
  over(`${jm}: počasí je vidět`, videt && /^7/.test(s.teplota || '') && s.bunek === 10 && s.vyska > 100, `${JSON.stringify(s)}, po ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  over(`${jm}: bez chyb na stránce`, !chyby.length, chyby.join(' | '));
  await p.context().close();
}
console.log(`\n${ok} v pořádku, ${spatne} špatně`);
await b.close();
process.exit(spatne ? 1 : 0);
