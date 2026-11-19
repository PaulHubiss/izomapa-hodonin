// Čerstvost souborů (Pavel 2026-11-17: „hlídej si ty soubory, aby se už nestalo, že se mi něco nenačte“):
// node nastroje-pavel/test_cerstvost.mjs
// Safari držel starý chodci.json, protože adresa nesla jen verzi dlaždic. Teď nese každý místní datový, JS a CSS soubor
// razítko sestavení (?s=…, build_html.py) a data se načítají s cache: 'no-cache'. Zkouška běží ve WebKitu (engine
// Safari, Pavlův prohlížeč) a ověří: (1) mapa hlásí stejné razítko jako site/index.html, (2) žádný místní soubor
// kromě dlaždic, obrázků a stránky samotné se nenačetl bez razítka, (3) cyklisté (d.kola) jsou načtení.
import { webkit, chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
const KOREN = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
let ok = 0, spatne = 0;
const over = (co, v, info) => { v ? ok++ : spatne++; console.log(v ? '✅' : '❌', co, info === undefined ? '' : `· ${JSON.stringify(info)}`); };
const razitko = (fs.readFileSync(path.join(KOREN, 'site', 'index.html'), 'utf8').match(/SEST = '([^']+)'/) || [])[1];
let b, engine = 'webkit';
try { b = await webkit.launch(); } catch { b = await chromium.launch(); engine = 'chromium (WebKit chybí: node node_modules/playwright-core/cli.js install webkit)'; }
const p = await (await b.newContext({ viewport: { width: 1290, height: 650 } })).newPage();
const nacteno = [];
p.on('request', (r) => { const u = new URL(r.url()); if (u.hostname === 'localhost') nacteno.push(u.pathname + u.search); });
await p.goto('http://localhost:8000/#leto@48.8530,17.1265,0.5', { waitUntil: 'load' }); await p.waitForTimeout(7000);
const stav = await p.evaluate(() => ({ sest: window.__izo?.sestaveni, kol: window.__izo?.CHODCI.cesty.filter((c) => c.kolo).length }));
over(`engine ${engine}: mapa hlásí razítko z site/index.html`, !!razitko && stav.sest === razitko, { site: razitko, mapa: stav.sest });
const bez = nacteno.filter((u) => /\.(json|js|css)(\?|$)/.test(u) && !/[?&]s=/.test(u) && !/^\/(tiles|preview|stromy)\//.test(u));
over('všechny místní .json/.js/.css nesou razítko sestavení', !bez.length, bez);
over('cyklisté načtení (chodci.json s d.kola)', stav.kol > 0, stav);
console.log(`\n${ok} v pořádku, ${spatne} špatně`);
await b.close();
process.exit(spatne ? 1 : 0);
