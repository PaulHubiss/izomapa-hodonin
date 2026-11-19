// Před spuštěním (2026-11-18): písmo a OpenSeadragon z našeho webu, sekce Soukromí, stránka 404, hlavičky.
// node nastroje-pavel/test_soukromi.mjs   (běžící náhled na :8000, po build_html.py)
import fs from 'node:fs';
import { chromium, pripraveno } from './prohlizec.mjs';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1400, height: 900 } });
const p = await ctx.newPage();
const chyby = []; p.on('pageerror', (e) => chyby.push(e.message));
const dotazy = []; p.on('request', (r) => dotazy.push(r.url()));
const selhalo = []; p.on('requestfailed', (r) => { if (r.url().startsWith('http://localhost')) selhalo.push(r.url()); });
let ok = 0, spatne = 0;
const over = (co, v, info = '') => { v ? ok++ : spatne++; console.log(v ? '✅' : '❌', co, info === '' ? '' : `· ${info}`); };

await p.goto('http://localhost:8000/#leto', { waitUntil: 'load' }); await pripraveno(p, 800);
const cizi = dotazy.filter((u) => /fonts\.googleapis|fonts\.gstatic|cdnjs\.cloudflare|unpkg|jsdelivr/.test(u));
over('žádný dotaz na Google Fonts ani cizí knihovny', !cizi.length, cizi.slice(0, 3).join(' '));
const pismo = await p.evaluate(async () => { await document.fonts.ready;
  // řez 400 je vidět hned; 600 a kurzívu prohlížeč stáhne, až je něco na stránce použije
  return { ss3: document.fonts.check('400 15px "Source Sans 3"', 'Hodonín'),
    naseno: [...document.fonts].filter((f) => f.family.includes('Source Sans 3') && f.status === 'loaded').length,
    osd: typeof OpenSeadragon !== 'undefined' && OpenSeadragon.version?.versionStr }; });
over('Source Sans 3 načtené z našeho webu', pismo.ss3 && pismo.naseno > 0 && dotazy.some((u) => /\/pismo-ss3-latin\.woff2/.test(u)), JSON.stringify(pismo));
over('OpenSeadragon 4.1.0 z našeho webu', pismo.osd === '4.1.0' && dotazy.some((u) => /\/openseadragon\.min\.js/.test(u)), pismo.osd);
over('všechny místní soubory se načetly', !selhalo.length, selhalo.join(' '));

await p.evaluate(() => document.getElementById('helpDlg').showModal());
const projekt = await p.evaluate(() => document.querySelector('#helpDlg .nb-napo-okno[data-zal="projekt"]')?.textContent || '');
over('Nápověda › O projektu: Soukromí (bez cookies, služby, Cloudflare)', /Soukromí/.test(projekt) && /nepoužívá cookies/.test(projekt)
  && /Open-Meteo/.test(projekt) && /KORDIS/.test(projekt) && /Cloudflare/.test(projekt));

const p4 = await ctx.newPage(); const sel4 = []; p4.on('requestfailed', (r) => sel4.push(r.url()));
const r4 = await p4.goto('http://localhost:8000/404.html', { waitUntil: 'load' });
const s4 = await p4.evaluate(async () => { await document.fonts.ready; const a = document.querySelector('a');
  return { h1: document.querySelector('h1')?.textContent, odkaz: a?.getAttribute('href'), pismo: document.fonts.check('700 28px "Source Sans 3"', 'Tahle stránka v Hodoníně není'),
    sirka: document.documentElement.scrollWidth <= innerWidth }; });
over('stránka 404: nadpis, odkaz zpět na mapu, naše písmo', r4.ok() && s4.h1 && s4.odkaz === '/' && s4.pismo && !sel4.length, JSON.stringify({ ...s4, sel4 }));
await p4.setViewportSize({ width: 360, height: 640 });
over('stránka 404 na telefonu nepřetéká', await p4.evaluate(() => document.documentElement.scrollWidth <= innerWidth));

const h = fs.existsSync('site/_headers') ? fs.readFileSync('site/_headers', 'utf8') : '';
over('site/_headers: noindex, nosniff, frame-ancestors, Permissions-Policy', /X-Robots-Tag: noindex/.test(h) && /X-Content-Type-Options: nosniff/.test(h)
  && /frame-ancestors 'self'/.test(h) && /Permissions-Policy:/.test(h) && !/Strict-Transport-Security/.test(h));
over('chyby stránky', !chyby.length, chyby.join(' | '));
console.log(`\n${ok} v pořádku, ${spatne} špatně`);
await b.close();
process.exit(spatne ? 1 : 0);
