// Zkouška modelu nanečisto, bez prohlížeče: spustí <slug>.js nad stejnými daty, jaká mu dá mapa, a zkontroluje ho.
//   node zkouska.mjs <slug>             (model = <slug>.js vedle tohoto souboru, data stavby/<slug>/data/)
//   node zkouska.mjs <slug> jiny.js
//   node zkouska.mjs                    (všechny stavby v balíčku, které už mají model)
// Vypíše chyby a čísla, uloží vystup/<slug>/trojuhelniky.json. Obrázky z nich nakreslí: python3 nahled.py <slug>
import fs from 'node:fs'; import path from 'node:path'; import { pathToFileURL, fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import * as THREE from './three.module.min.js';
import { makeKit } from './_kit.js';

const DIR = path.dirname(fileURLToPath(import.meta.url));
if (!process.argv[2]) {                                                  // bez argumentu: postupně všechny stavby s modelem
  let spatne = 0;
  for (const s of fs.readdirSync(path.join(DIR, 'stavby')).sort()) {
    if (!fs.existsSync(path.join(DIR, `${s}.js`))) { console.log(`— ${s}: model ${s}.js zatím není\n`); continue; }
    const r = spawnSync(process.execPath, [fileURLToPath(import.meta.url), s], { encoding: 'utf8' });
    console.log(`=== ${s} ===\n${r.stdout}${r.stderr || ''}`); if (r.status) spatne++;
  }
  process.exit(spatne ? 1 : 0);
}
const SLUG = process.argv[2], SD = path.join(DIR, 'stavby', SLUG, 'data');
if (!fs.existsSync(SD)) { console.log(`❌ stavba ${SLUG} v balíčku není (složky ve stavby/: ${fs.readdirSync(path.join(DIR, 'stavby')).join(', ')})`); process.exit(1); }
const M = JSON.parse(fs.readFileSync(path.join(SD, 'M.json'), 'utf8'));
const T = JSON.parse(fs.readFileSync(path.join(SD, 'teren.json'), 'utf8'));
const LIMIT = JSON.parse(fs.readFileSync(path.join(SD, 'limity.json'), 'utf8'));
const soubor = path.resolve(DIR, process.argv[3] || `${SLUG}.js`);

// terén: bilineárně z mřížky (stejné hodnoty jako v mapě)
const vyska = (x, y) => {
  const fx = Math.max(0, Math.min(T.nx - 1.001, (x - T.x0) / T.krok)), fy = Math.max(0, Math.min(T.ny - 1.001, (y - T.y0) / T.krok));
  const i = Math.floor(fx), j = Math.floor(fy), u = fx - i, v = fy - j, h = (a, b) => T.h[b * T.nx + a];
  return (h(i, j) * (1 - u) + h(i + 1, j) * u) * (1 - v) + (h(i, j + 1) * (1 - u) + h(i + 1, j + 1) * u) * v;
};
const B = { W: { n: 'W', t: [] }, R: { n: 'R', t: [] }, X: { n: 'X', t: [] } };
const pushTri = (buf, a, b, d, col) => buf.t.push([a, b, d, col]);       // body jsou [x, z, -y] (osy three.js)
const stromy = [];

let fn;
try { fn = (await import(pathToFileURL(soubor).href)).default; }
catch (e) { console.log(`❌ Model nejde načíst (${path.basename(soubor)}): ${e.message}`); process.exit(1); }
if (typeof fn !== 'function') { console.log('❌ Model musí mít `export default function (M, K) { … }`'); process.exit(1); }
try { fn(M, makeKit({ THREE, W: B.W, R: B.R, X: B.X, pushTri, vyska, sezona: 'summer', noc: false, stromy }, M)); }
catch (e) { console.log(`❌ Model spadl: ${e.stack}`); process.exit(1); }

// ---------- kontroly ----------
const inPoly = (x, y, P) => { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [xi, yi] = P[i], [xj, yj] = P[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; };
const distSeg = (px, py, [ax, ay], [bx, by]) => { const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy || 1e-9, k = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / L)); return Math.hypot(px - ax - dx * k, py - ay - dy * k); };
const venku = (x, y) => {                                                // o kolik metrů leží bod mimo půdorys (0 = uvnitř)
  if (M.budovy.some((b) => inPoly(x, y, b.p))) return 0;
  let d = 1e9; for (const b of M.budovy) for (let i = 0; i < b.p.length; i++) d = Math.min(d, distSeg(x, y, b.p[i], b.p[(i + 1) % b.p.length]));
  return d;
};
const vse = [...B.W.t, ...B.R.t, ...B.X.t];
let nan = 0, zmax = -1e9, zmin = 1e9, mimo = 0, mimoMax = 0, soused = 0; const mimoPriklad = [];
const out = [];
for (const [buf, list] of Object.entries({ W: B.W.t, R: B.R.t, X: B.X.t })) for (const [a, b, d, col] of list) {
  const P = [a, b, d].map((p) => [p[0], -p[2], p[1]]);                    // zpět na x (východ), y (sever), z (výška)
  if (P.flat().some((q) => !Number.isFinite(q))) { nan++; continue; }
  for (const [x, y, z] of P) {
    zmax = Math.max(zmax, z); zmin = Math.min(zmin, z);
    if (z > M.g + 0.5 && M.budovy.length) {               // drobná památka nemá půdorys: přesah se neměří
      const v = venku(x, y);
      if (v > 1.0) { mimo++; mimoMax = Math.max(mimoMax, v); if (mimoPriklad.length < 5) mimoPriklad.push([x, y, z].map((q) => +q.toFixed(1))); }
      if ((M.okoli || []).some((q) => inPoly(x, y, q.p) && q.p.every((_, i) => distSeg(x, y, q.p[i], q.p[(i + 1) % q.p.length]) > 0.3))) soused++;   // hranice se sousedem není zásah
    }
  }
  const c = (Array.isArray(col) ? col : [0.5, 0.5, 0.5]).map((q) => +(+q).toFixed(3));
  out.push([buf, P.map(([x, y, z]) => [+(x - M.ram.x).toFixed(2), +(y - M.ram.y).toFixed(2), +(z - M.g).toFixed(2)]), c]);
}
const n = vse.length;
console.log(`Model ${path.basename(soubor)}: ${n} trojúhelníků (zdi s okny W ${B.W.t.length}, střechy R ${B.R.t.length}, pevné X ${B.X.t.length})`);
console.log(`Výška nad terénem: nejvýš ${(zmax - M.g).toFixed(1)} m, nejníž ${(zmin - M.g).toFixed(1)} m (data: budova ${LIMIT.vyska_dat} m, laser p98 ${LIMIT.laser_p98 ?? '?'} m)`);
const chyby = [], varovani = [];
if (!n) chyby.push('model nenakreslil nic');
if (nan) chyby.push(`${nan} trojúhelníků má neplatné souřadnice (NaN)`);
if (n > LIMIT.trojuhelniku) varovani.push(`víc trojúhelníků než doporučených ${LIMIT.trojuhelniku}`);
if (mimo) varovani.push(`${mimo} bodů nad terénem leží víc než 1 m mimo půdorys (nejvíc ${mimoMax.toFixed(1)} m), např. ${JSON.stringify(mimoPriklad)} – v pořádku jen u říms, stříšek, schodů a soch`);
if (soused) chyby.push(`${soused} bodů zasahuje do sousední budovy (M.okoli)`);
if (LIMIT.laser_p98 && zmax - M.g > LIMIT.laser_p98 + 4) varovani.push('model je o víc než 4 m vyšší než laser (věž? jinak chyba výšky)');
if (LIMIT.laser_p98 && zmax - M.g < LIMIT.laser_p98 - 2) varovani.push('model je o víc než 2 m nižší než laser');
if (zmin - M.g > -0.05) varovani.push('zdi nezačínají pod terénem: použij K.dno jako spodek zdí');
// pevná čísla bodů půdorysu (P[17]) se rozbijí, když se budova v datech překreslí
const idx = fs.readFileSync(soubor, 'utf8').match(/\b[A-Za-z_]\w*\[\d+\]\s*\[\s*[01]\s*\]|\bP\[\d+\]/g);
if (idx && idx.length > 3) varovani.push(`model používá pevná čísla bodů půdorysu (${[...new Set(idx)].slice(0, 4).join(', ')}…): hledej body a hrany podle polohy a směru (K.hrany: sv, L, divak), ne podle pořadí`);
for (const c of chyby) console.log('❌ ' + c);
for (const v of varovani) console.log('⚠️ ' + v);
if (!chyby.length && !varovani.length) console.log('✅ bez chyb a varování');
const VD = path.join(DIR, 'vystup', SLUG); fs.mkdirSync(VD, { recursive: true });
const ring = (P) => P.map(([x, y]) => [+(x - M.ram.x).toFixed(2), +(y - M.ram.y).toFixed(2)]);
fs.writeFileSync(path.join(VD, 'trojuhelniky.json'), JSON.stringify({ slug: M.slug, pudorys: M.budovy.map((b) => ring(b.p)), okoli: (M.okoli || []).map((q) => ring(q.p)), t: out }));
console.log(`Uloženo vystup/${SLUG}/trojuhelniky.json → obrázky: python3 nahled.py ${SLUG}`);
process.exit(chyby.length ? 1 : 0);
