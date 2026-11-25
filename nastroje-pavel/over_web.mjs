// Kontrola ostrého webu po nasazení: node nastroje-pavel/over_web.mjs [--bez-prohlizece]
// Přesměrování http → https, 404, hlavičky, kdo a co nasadil, shoda souborů se site/ (bajty), vzorek dlaždic, API prostředníků
// a načtení stránky v Chromiu a WebKitu (bez chyb, dlaždice načtené). Vše jen čte.
import fs from 'node:fs';
import { execSync } from 'node:child_process';
import * as pw from 'playwright';
const URL0 = 'https://hodonin.paulhubiss.cz';
const SITE = new URL('../site/', import.meta.url).pathname;
let spatne = 0;
const over = (co, v, info = '') => { if (!v) spatne++; console.log(v ? '✅' : '❌', co, info === '' ? '' : `· ${info}`); };
const ber = (c, o) => fetch(`${URL0}/${c}`, { cache: 'no-store', ...o });

const r = await fetch('http://hodonin.paulhubiss.cz/', { redirect: 'manual' });
over('http → https', r.status >= 301 && r.status <= 308 && (r.headers.get('location') || '').startsWith(URL0), `${r.status} ${r.headers.get('location')}`);
const n4 = await ber('neexistuje-' + Date.now()); over('neexistující stránka vrací 404', n4.status === 404, n4.status);
const u = await ber(''); over('hlavičky: HSTS, CSP nebo X-Content-Type-Options', u.status === 200 && u.headers.get('strict-transport-security') && u.headers.get('x-content-type-options') === 'nosniff');
const nas = await (await ber('nasazeno.json')).json(), head = execSync('git rev-parse HEAD').toString().trim();
over('nasazený commit', execSync(`git merge-base --is-ancestor ${nas.commit} ${head} && echo ano`).toString().trim() === 'ano', `${nas.commit.slice(0, 8)} z ${nas.mac} (${nas.cas})`);

const soubory = ['index.html', 'tiles.json', 'overlay.json', 'mhd.json', 'chodci.json', 'ulice.json', 'search.json', 'nase.js', 'nase.css', 'kategorie.js',
  ...fs.readdirSync(SITE + 'overlay').map((f) => 'overlay/' + f)];
const T = JSON.parse(fs.readFileSync(SITE + 'tiles.json')), dl = [];
const projdi = (d) => { for (const f of fs.readdirSync(SITE + d, { withFileTypes: true })) f.isDirectory() ? projdi(`${d}/${f.name}`) : dl.push(`${d}/${f.name}`); };
projdi('tiles');
for (let i = 0; i < 40; i++) soubory.push(dl[Math.floor((i + 0.5) * dl.length / 40)]);      // rovnoměrný vzorek dlaždic
const jine = [];
for (const s of soubory.filter((s) => fs.existsSync(SITE + s))) {
  const q = await ber(s === 'index.html' ? '' : `${s}?v=kontrola${Date.now()}`), a = Buffer.from(await q.arrayBuffer()), b = fs.readFileSync(SITE + s);
  if (q.status !== 200 || !a.equals(b)) jine.push(`${s} (${q.status}, ${a.length} × ${b.length} B)`);
}
over(`soubory shodné se site/ (${soubory.length}, z toho 40 dlaždic z ${dl.length})`, !jine.length, jine.join(' | '));
const w = await ber(dl[0]); over('dlaždice: image/webp a dlouhá mezipaměť', w.headers.get('content-type') === 'image/webp' && /max-age=31536000/.test(w.headers.get('cache-control') || ''), `${w.headers.get('content-type')} ${w.headers.get('cache-control')}`);
over('verze dlaždic po čtvercích v tiles.json', Object.values(T.chunks).every((c) => Object.values(c).every((d) => !d || !d.Image || d.ver)));
for (const a of ['program?zdroj=dkhodonin', 'program?zdroj=kinosvet', 'program?zdroj=jarmark', 'vyluky?oblast=' + encodeURIComponent('Hodonínsko')]) {
  const q = await ber('api/' + a), n = (await q.text()).length; over('api/' + decodeURIComponent(a), q.status === 200, `${q.status}, ${n} B`);
}

if (!process.argv.includes('--bez-prohlizece')) for (const e of ['chromium', 'webkit']) {
  const b = await pw[e].launch(), p = await (await b.newContext({ viewport: { width: 1400, height: 900 } })).newPage();
  const chyby = [], nacteno = []; p.on('pageerror', (x) => chyby.push(x.message));
  p.on('response', (x) => { if (x.url().includes('/tiles/') || x.url().startsWith(URL0)) nacteno.push(x.status()); });
  await p.goto(`${URL0}/#leto@48.8487,17.1285,0.45`, { waitUntil: 'load' }); await p.waitForTimeout(7000);
  const s = await p.evaluate(() => ({ nacita: !document.getElementById('loading')?.hidden, ulice: document.getElementById('l-ulice')?.checked, pinu: document.querySelectorAll('.pin.ikp').length }));
  over(`${e}: stránka běží bez chyb`, !chyby.length && !s.nacita && s.pinu > 50 && !nacteno.some((k) => k >= 400), `${nacteno.length} odpovědí, ikonek ${s.pinu}, názvy ulic ${s.ulice ? 'zapnuté' : 'vypnuté'} ${chyby.join(' | ')}`);
  await b.close();
}
console.log(spatne ? `\n❌ ${spatne} neprošlo` : '\n✅ web v pořádku');
process.exit(spatne ? 1 : 0);
