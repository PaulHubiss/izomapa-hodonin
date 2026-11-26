// Vrstva Povodně (F4, web/js/83-povodne.js, data nastroje-pavel/povodne.py): node nastroje-pavel/test_povodne.mjs (běžící náhled na :8000)
// Výchozí vypnutá a nic nekreslí; po zapnutí kreslí záplavová území a zblízka z nich vykrojí domy; v místě stoleté vody je
// modrá, mimo ni ne; odkaz Sdílet ji nese („spovodnemi“); Čistá mapa ji vypne; zdroj DIBAVOD v patičce.
import { chromium, pripraveno } from './prohlizec.mjs';
import { sekce } from './sekce.mjs';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1400, height: 900 } });
await ctx.addInitScript(() => { window.__test = {}; });
const p = await ctx.newPage();
const chyby = []; p.on('pageerror', (e) => chyby.push(e.message));
let ok = 0, spatne = 0;
const over = (co, v, info = '') => { v ? ok++ : spatne++; console.log(v ? '✅' : '❌', co, info === '' ? '' : `· ${info}`); };
const otevri = async (hash) => { await p.goto('about:blank'); await p.goto(`http://localhost:8000/#${hash}`, { waitUntil: 'load' }); await pripraveno(p, 1500); };
// barva vrstvy efektů (#fx) v bodě obrazovky: modrý nádech = povodeň
const modra = (x, y) => p.evaluate(([x, y]) => { const c = document.getElementById('fx'), d = window.devicePixelRatio || 1;
  const [r, g, bl, a] = c.getContext('2d').getImageData(Math.round(x * d), Math.round(y * d), 1, 1).data; return a > 20 && bl > r + 30; }, [x, y]);

await otevri('leto@48.84421,17.12207,0.45');
over('přepínač je ve Vrstvách a výchozí vypnutý', await p.evaluate(() => { const v = document.getElementById('l-povodne'); return v && !v.closest('label').hidden && !v.checked; }));
over('vypnutá nic nekreslí', !(await p.evaluate(() => window.__test.povodne)));
await sekce(p, '#l-povodne'); await p.click('#l-povodne'); await p.waitForTimeout(900);
const st = await p.evaluate(() => window.__test.povodne);
over('zapnutá kreslí záplavová území', st && st.ploch >= 3, JSON.stringify(st));
over('zblízka vykrojí domy', st && st.vykrojeno > 10, st && `${st.vykrojeno} domů`);
// bod stoleté vody (střed výřezu leží v ní: medián domů v Q100) × roh mimo (sever výřezu, město)
const stred = await p.evaluate(() => { const r = document.getElementById('fx').getBoundingClientRect(); return [r.width / 2, r.height / 2]; });
let vzorku = 0; for (let dx = -120; dx <= 120; dx += 40) for (let dy = 40; dy <= 200; dy += 40) if (await modra(stred[0] + dx, stred[1] + dy)) vzorku++;
over('v záplavovém území je modrá', vzorku >= 3, `${vzorku} ze 35 bodů`);
await otevri('leto-spovodnemi@48.84421,17.12207,0.45');
over('odkaz se „spovodnemi“ vrstvu zapne', await p.evaluate(() => document.getElementById('l-povodne').checked));
const cista = await p.evaluate(() => { const b = [...document.querySelectorAll('.nb-predvolby button')].find((x) => x.title === 'Čistá mapa'); b?.click(); return !!b; });
over('Čistá mapa vrstvu vypne', cista && !(await p.evaluate(() => document.getElementById('l-povodne').checked)));
over('zdroj DIBAVOD v patičce', await p.evaluate(() => /DIBAVOD/.test(document.querySelector('#helpDlg .muted')?.textContent || '')));
over('chyby stránky', !chyby.length, JSON.stringify(chyby));
console.log(`\n${ok} v pořádku, ${spatne} špatně`);
await b.close(); process.exit(spatne ? 1 : 0);
