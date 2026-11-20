// Balíček pro ChatGPT: jedna nebo víc staveb, nové modely i opravy. Podklady, stavebnice, vzorové modely, data M přesně
// z rendereru a zkouška nanečisto.
//   node nastroje-pavel/chatgpt-modely/zabal.mjs <slug> [<slug> …]                 nové modely
//   node nastroje-pavel/chatgpt-modely/zabal.mjs --oprava=<slug>[,<slug>]          opravy podle komentáře z dashboardu
//   volby: --nazev=balik (jinak slug nebo davka-RRRR-MM-DD), --vzory=a,b,c, --fotky-navic=slozka (jen u jedné stavby)
// Předtím u nové stavby: pamatky/sestav.py --novy <slug> a podklady_*.py (podklady-soukrome/pamatky/<slug>/).
// Výstup: predani/chatgpt/<balik>.zip + <balik>-zadani.txt (text k vložení do ChatGPT), Finder ho ukáže.
// Zpátky: node nastroje-pavel/chatgpt-modely/prevezmi.mjs <balik>   (postup a zkušenosti: README.md vedle)
import fs from 'node:fs'; import path from 'node:path'; import { spawnSync } from 'node:child_process';
import * as THREE from 'three';
import { ROOT, PODKLADY, MESTO, server, prohlizec, vyrez } from '../../pamatky/_spolecne.mjs';
import { makeKit } from '../../pamatky/_kit.js';

const args = process.argv.slice(2), opt = Object.fromEntries(args.filter((a) => a.startsWith('--')).map((a) => { const [k, v] = a.slice(2).split('='); return [k, v ?? true]; }));
const nove = args.filter((a) => !a.startsWith('--')), opravy = opt.oprava ? String(opt.oprava).split(',') : [];
const vse = [...new Set([...nove, ...opravy])];
if (!vse.length || vse.some((s) => !/^[a-z0-9-]{1,40}$/.test(s))) { console.log('použití: zabal.mjs <slug> [<slug> …] [--oprava=a,b] [--nazev=balik]'); process.exit(1); }
const dnes = new Date().toISOString().slice(0, 10);
const BALIK = opt.nazev || (vse.length === 1 ? (opravy.length ? `${vse[0]}-oprava` : vse[0]) : `davka-${dnes}`);
const SAB = path.join(ROOT, 'nastroje-pavel/chatgpt-modely/sablona');
const VEN = path.join(ROOT, 'predani/chatgpt'), BAL = path.join(VEN, BALIK);
const rozhodnuti = (() => { try { return JSON.parse(fs.readFileSync(path.join(PODKLADY, 'rozhodnuti.json'), 'utf8')); } catch { return {}; } })();
for (const s of vse) {
  if (!fs.existsSync(path.join(ROOT, `pamatky/${s}.json`))) { console.log(`❌ ${s}: chybí pamatky/${s}.json – nejdřív sestav.py --novy ${s}`); process.exit(1); }
  if (!fs.existsSync(path.join(PODKLADY, s, 'podklad.md'))) { console.log(`❌ ${s}: chybí podklady – nejdřív pamatky/podklady_*.py ${s}`); process.exit(1); }
  if (opravy.includes(s) && !fs.existsSync(path.join(ROOT, `pamatky/${s}.js`))) { console.log(`❌ ${s}: oprava bez modelu pamatky/${s}.js`); process.exit(1); }
}
fs.rmSync(BAL, { recursive: true, force: true });
fs.mkdirSync(path.join(BAL, 'vzory'), { recursive: true });
const kopie = (z, kam) => { fs.mkdirSync(path.dirname(path.join(BAL, kam)), { recursive: true }); fs.copyFileSync(z, path.join(BAL, kam)); };
const r2 = (q) => Math.round(q * 10) / 10;
const detailni = MESTO.rozliseni === 'detailni';

// 1) data M a terén přesně z rendereru: místo modelu podstrčíme výpis (soubor modelu nemusí existovat)
const VYPIS = `export default function (M, K) {
  const r = M.ram, ext = Math.max(r.L, r.W) / 2 + 20, krok = 1, nx = Math.ceil(2 * ext / krok) + 1, h = [];
  for (let j = 0; j < nx; j++) for (let i = 0; i < nx; i++) h.push(Math.round(K.vyska(r.x - ext + i * krok, r.y - ext + j * krok) * 100) / 100);
  window.__VYPIS = { M: JSON.parse(JSON.stringify(M)), teren: { x0: r.x - ext, y0: r.y - ext, krok, nx, ny: nx, h } };
}`;
const srv = await server(), port = srv.address().port, browser = await prohlizec();
const radky = [];
for (const slug of vse) {
  const d = JSON.parse(fs.readFileSync(path.join(ROOT, `pamatky/${slug}.json`), 'utf8')), POD = path.join(PODKLADY, slug), SB = `stavby/${slug}`;
  const page = await browser.newPage();
  await page.route(new RegExp(`/pamatky/${slug}\\.js(\\?|$)`), (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: VYPIS }));
  await page.goto(`http://127.0.0.1:${port}/render.html?mpp=0.2&tile=1024&season=summer&dir=${vyrez(d).dir}&alpha=0&v=${Date.now()}&pam=vse&pamextra=${slug}&pamatka=${slug}`);
  await page.waitForFunction(() => window.READY === true, null, { timeout: 300000, polling: 300 });
  const V = await page.evaluate(() => ({ vypis: window.__VYPIS, log: window.PAM_LOG }));
  await page.close();
  if (!V.vypis) { console.log(`❌ ${slug}: renderer model nezavolal`, V.log); process.exit(1); }
  const M = V.vypis.M;
  fs.mkdirSync(path.join(BAL, SB, 'data'), { recursive: true });
  fs.writeFileSync(path.join(BAL, SB, 'data/M.json'), JSON.stringify(M));
  fs.writeFileSync(path.join(BAL, SB, 'data/teren.json'), JSON.stringify(V.vypis.teren));

  // 2) půdorys v rámci K.F se stranami světa (spočítá stejná stavebnice)
  const K = makeKit({ THREE, W: {}, R: {}, X: {}, pushTri() {}, vyska: () => M.g }, M);
  const ose = (ang) => ['východ', 'severovýchod', 'sever', 'severozápad', 'západ', 'jihozápad', 'jih', 'jihovýchod'][((Math.round(ang / (Math.PI / 4)) % 8) + 8) % 8];
  const SV = { V: 'východ', SV: 'severovýchod', S: 'sever', SZ: 'severozápad', Z: 'západ', JZ: 'jihozápad', J: 'jih', JV: 'jihovýchod' };
  let pud = `Rám: L ${r2(M.ram.L)} × W ${r2(M.ram.W)} m. **+s míří na ${ose(M.ram.a)}, +t na ${ose(M.ram.a + Math.PI / 2)}.** `
    + `Zdi od K.dno = ${r2(K.dno)} m. Kamera mapy je na jihozápadě, směr k ní v (s, t): [${K.F.kDivakovi.map(r2)}].\n`;
  M.budovy.forEach((b, i) => {
    const P = K.pudorys(i, K.F, 0.25);
    pud += `\n## K.pudorys(${i}) – ${P.length} bodů proti směru hodin, výška z dat ${r2(b.e - M.g)} m nad terénem\n\n`
      + 'Body jsou jen pro orientaci, v kódu je hledej podle polohy a směru (pořadí se s daty mění).\n\n'
      + '`' + JSON.stringify(P.map(([s, t]) => [r2(s), r2(t)])) + '`\n\n| od | do | délka m | fasáda na (sv) | vidět z mapy | soused (štít) |\n|---|---|---|---|---|---|\n';
    for (const e of K.hrany(K.F, P)) pud += `| [${e.A.map(r2)}] | [${e.B.map(r2)}] | ${r2(e.L)} | ${SV[e.sv]} (${e.sv}) | ${e.divak > 0.2 ? 'ano' : e.divak > -0.2 ? 'z boku' : 'ne'} | ${e.soused > 0.5 ? 'ano – bez oken' : ''} |\n`;
  });
  fs.writeFileSync(path.join(BAL, SB, 'data/pudorys.md'), `# Půdorys „${d.nazev}“ v rámci K.F\n\n${pud}`);
  let laser = null; try { laser = JSON.parse(fs.readFileSync(path.join(POD, 'laser.json'), 'utf8')).celek; } catch { /* bez laseru */ }
  fs.writeFileSync(path.join(BAL, SB, 'data/limity.json'), JSON.stringify({ trojuhelniku: detailni ? 25000 : 15000,
    vyska_dat: r2(Math.max(...(d.budovy || []).map((q) => q.top - q.base), 0)), laser_p98: laser?.p98 ?? null }));

  // 3) podklady stavby
  for (const f of ['podklad.md', 'orto.jpg', 'laser.json']) if (fs.existsSync(path.join(POD, f))) kopie(path.join(POD, f), `${SB}/podklady/${f}`);
  for (const f of fs.existsSync(path.join(POD, 'fotky')) ? fs.readdirSync(path.join(POD, 'fotky')) : []) if (/\.(jpe?g|png|webp|json)$/i.test(f)) kopie(path.join(POD, 'fotky', f), `${SB}/podklady/fotky/${f}`);
  // další fotky: fotky/<slug>/ automaticky, jiná složka přes --fotky-navic=slug:slozka[,slug:slozka] (nebo jen slozka u jedné stavby)
  const navic = [path.join(ROOT, 'fotky', slug)];
  for (const p of opt['fotky-navic'] ? String(opt['fotky-navic']).split(',') : []) {
    const [a, b] = p.includes(':') ? p.split(':') : [vse.length === 1 ? slug : '', p];
    if (a === slug) navic.push(path.resolve(ROOT, b));
  }
  for (const dir of navic) if (fs.existsSync(dir)) for (const f of fs.readdirSync(dir)) {
    if (/\.(jpe?g|png|webp)$/i.test(f)) kopie(path.join(dir, f), `${SB}/podklady/fotky/navic-${f.replace(/[^\w.-]+/g, '_')}`);
    else if (/^zdroje\.(txt|json)$/.test(f)) kopie(path.join(dir, f), `${SB}/podklady/fotky/navic-${f}`);
  }

  // 4) oprava: současný model do kořene, komentář z dashboardu a snímky z našeho rendereru
  if (opravy.includes(slug)) {
    kopie(path.join(ROOT, `pamatky/${slug}.js`), `${slug}.js`);
    const kom = rozhodnuti[slug]?.komentar || opt.komentar || '';
    if (!kom) console.log(`⚠️ ${slug}: v dashboardu není komentář (rozhodnuti.json) – doplň --komentar="…"`);
    fs.mkdirSync(path.join(BAL, SB, 'oprava'), { recursive: true });
    fs.writeFileSync(path.join(BAL, SB, 'oprava/komentar.md'), `# Komentář autora mapy k modelu ${slug}\n\n${kom || '(bez komentáře)'}\n`);
    const n = spawnSync(process.execPath, [path.join(ROOT, 'pamatky/nahled.mjs'), slug, '--velky', '--zoom=1.6'], { cwd: ROOT, encoding: 'utf8' });
    if (n.status) console.log(`⚠️ ${slug}: náhled selhal\n${n.stdout}${n.stderr}`);
    const ND = path.join(POD, 'nahled');
    for (const f of ['arch.png', 'po_225.png', 'po_135.png', 'po_315.png', 'po_45.png']) if (fs.existsSync(path.join(ND, f))) kopie(path.join(ND, f), `${SB}/oprava/${f.replace('po_', 'mapa_az')}`);
    if (fs.existsSync(path.join(POD, 'model.md'))) kopie(path.join(POD, 'model.md'), `${SB}/oprava/predchozi-poznamky.md`);
  }
  radky.push(`| \`${slug}\` | ${d.nazev} | ${opravy.includes(slug) ? '**oprava**' : 'nová'} | ${d.budovy?.[0]?.addr || ''} |`);
}
await browser.close(); srv.close();

// 5) společné: stavebnice, návod, šablony, vzory
kopie(path.join(ROOT, 'pamatky/_kit.js'), '_kit.js');
kopie(path.join(ROOT, 'pamatky/_drobne.js'), '_drobne.js');
kopie(path.join(ROOT, 'pamatky/README.md'), 'NAVOD.md');
kopie(path.join(ROOT, 'node_modules/three/build/three.module.min.js'), 'three.module.min.js');
kopie(path.join(SAB, 'zkouska.mjs'), 'zkouska.mjs');
kopie(path.join(SAB, 'nahled.py'), 'nahled.py');
const schvalene = JSON.parse(fs.readFileSync(path.join(ROOT, 'pamatky/schvalene.json'), 'utf8'));
// výchozí vzory jen ze schválených; --vzory=a,b vybírá ručně i neschválené (srovnání Claude × ChatGPT: vzory od ChatGPT,
// aby neviděl naše verze týchž staveb); stavby z balíčku nikdy
const vzory = (opt.vzory ? String(opt.vzory).split(',') : ['galerie-dum-umeni', 'radnice', 'fara', 'sportovni-hala', 'zakladni-skola'].filter((q) => schvalene.includes(q)))
  .filter((q) => !vse.includes(q) && fs.existsSync(path.join(ROOT, `pamatky/${q}.js`)));
for (const q of vzory) kopie(path.join(ROOT, `pamatky/${q}.js`), `vzory/${q}.js`);

// 6) zadání s doplněnými údaji
const zad = fs.readFileSync(path.join(SAB, 'ZADANI.md'), 'utf8')
  .replaceAll('{BALIK}', BALIK).replaceAll('{LIMIT}', detailni ? '25 000' : '15 000')
  .replaceAll('{ROZLISENI}', detailni ? '0,1 m na pixel (detailní)' : '0,2 m na pixel (základní)').replaceAll('{DETAIL}', detailni ? '0,15 m' : '0,3 m')
  .replaceAll('{STAVBY}', '| slug | název | druh | adresa |\n|---|---|---|---|\n' + radky.join('\n'));
fs.writeFileSync(path.join(BAL, 'ZADANI.md'), zad);

// 7) zip + text k vložení
const zip = path.join(VEN, `${BALIK}.zip`); fs.rmSync(zip, { force: true });
const z = spawnSync('zip', ['-qr', zip, '.'], { cwd: BAL });
if (z.status !== 0) { console.log('❌ zip selhal', String(z.stderr)); process.exit(1); }
const jmena = vse.map((q) => JSON.parse(fs.readFileSync(path.join(ROOT, `pamatky/${q}.json`), 'utf8')).nazev);
const txt = `V příloze je balíček ${BALIK}.zip: podklady a nástroje pro 3D modely staveb do izometrické mapy Hodonína `
  + `(${vse.length === 1 ? jmena[0] : vse.length + (vse.length < 5 ? ' stavby: ' : ' staveb: ') + jmena.join(', ')}${opravy.length ? '; opravy: ' + opravy.join(', ') : ''}).\n`
  + `Rozbal ho, přečti si ZADANI.md a postupuj přesně podle něj u všech staveb (model, zkouška node zkouska.mjs <slug>, `
  + `obrázek python3 nahled.py <slug>, 2–4 kola oprav, kontrolní seznam, poznámky <slug>.md). Pracuj samostatně až do konce.\n`
  + `Výsledek mi vrať jako jeden zip ke stažení ${BALIK}-od-chatgpt.zip (pro každou stavbu <slug>.js a <slug>.md).\n`;
fs.writeFileSync(path.join(VEN, `${BALIK}-zadani.txt`), txt);
console.log(`✅ ${path.relative(ROOT, zip)} (${(fs.statSync(zip).size / 1e6).toFixed(1)} MB): ${vse.map((q) => q + (opravy.includes(q) ? ' (oprava)' : '')).join(', ')}; vzory: ${vzory.join(', ')}`);
console.log(`--- text k vložení (${path.relative(ROOT, path.join(VEN, BALIK + '-zadani.txt'))}) ---\n${txt}`);
if (!opt['bez-finderu']) spawnSync('open', ['-R', zip]);
