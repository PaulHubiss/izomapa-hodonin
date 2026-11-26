// Video a fotky z mapy pro sociální sítě, podle předvolby (Pavel 2026-11-26, napady/VIDEO.md, fáze 1).
//   node nastroje-pavel/video.mjs                      → seznam předvoleb
//   node nastroje-pavel/video.mjs <předvolba> [--format 9:16,1:1] [--fps 30] [--zvetseni 2] [--zkouska]
// Předvolby: nastroje-pavel/video/predvolby/<jméno>.json (v gitu). Výstup: videa/<jméno>/ (zástupce na Google Disk):
//   video → <jméno>-<formát>.mp4, foto → <jméno>-<formát>-<záběr>.png, vždy kontrola-<formát>.png (snímky ze záběrů v mřížce).
// Potřebuje běžící náhled na http://localhost:8000 (nastroje-pavel/nahled_server.py) a ffmpeg. Jen lokálně, na web nepatří.
//
// Jak: čas stránky stojí (page.clock), každý snímek se posune přesně o 1/fps s a vyfotí → animace (auta, MHD, lidé, sníh)
// běží plynule bez ohledu na rychlost počítače a obraz je ostrý (PNG, žádné nahrávání obrazovky). Menu, ikonky a ovládání
// jsou skryté. Každý záběr = čerstvá stránka (roční období za běhu přepnout nejde, pokus 2026-11-17), přechody skládá ffmpeg.
//
// Předvolba: { nazev, druh: video|foto, formaty: ["1:1","4:5","9:16","16:9"], kratsi_strana: 1080, fps: 30, zvetseni: 1|2,
//   titulek: { nadpis, podnadpis } | false, zabery: [{ obdobi: jaro|leto|podzim|zima, cas: ISO čas, pocasi: clear|rain|snow…,
//   prechod: { druh: prolnuti|strih, delka: s }, delka: s, body: [{ t: s, ll: [lat, lon], m_na_px: metrů na pixel výstupu, noc: 0–1 }] }] }
// Body jsou klíčové snímky kamery; co bod neuvede, zůstává z předchozího. Délka záběru = čas posledního bodu, nebo „delka“,
// je-li delší: jeden bod + delka = kamera stojí (čas ve městě běží: auta, lidé, počasí). Mezi body jede kamera S-křivkou, přiblížení
// geometricky (stejně rychle dovnitř i ven). Foto bere z každého záběru první bod.
// Ostrost: pixel art je ostrý, když metrů na pixel stránky (m_na_px × zvetseni) = 0,1 × 2^k (0,1 · 0,2 · 0,4 · 0,8 …):
// pak prohlížeč kreslí přesně jedno patro pyramidy dlaždic 1 : 1. Jinak skript varuje.
// zvetseni 2: stránka má poloviční rozměr a ffmpeg ji zvětší 2× bez vyhlazování → každý pixel mapy je blok 2 × 2, se kterým
// lícuje barevná složka videa (4 : 2 : 0 má barvu jen po 2 × 2) → barevné hrany se nerozpijí. Hrubší, „retro“ pixely.
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const KOREN = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PREDVOLBY = path.join(KOREN, 'nastroje-pavel', 'video', 'predvolby');
const MESTO = JSON.parse(fs.readFileSync(path.join(KOREN, 'mesto.json'), 'utf8'));
const FORMATY = { '1:1': [1, 1], '4:5': [4, 5], '9:16': [9, 16], '16:9': [16, 9] };
const OBDOBI = ['jaro', 'leto', 'podzim', 'zima'];
const UM = 0.2;                                                          // metrů na pixel souřadnic prohlížeče (geo.MPP_OVERLAY)

const arg = (n) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : undefined; };
const JMENO = process.argv.slice(2).find((a, i, all) => !a.startsWith('--') && !(i > 0 && /^--(format|fps|zvetseni)$/.test(all[i - 1])));
const ZKOUSKA = process.argv.includes('--zkouska');

if (!JMENO) {
  console.log('Předvolby (nastroje-pavel/video/predvolby/):');
  for (const f of fs.readdirSync(PREDVOLBY).filter((f) => f.endsWith('.json')).sort()) {
    const p = JSON.parse(fs.readFileSync(path.join(PREDVOLBY, f), 'utf8'));
    console.log(`  ${f.replace(/\.json$/, '').padEnd(20)} ${p.druh || 'video'} · ${(p.formaty || []).join(' ')} · ${p.nazev || ''}`);
  }
  console.log('\nnode nastroje-pavel/video.mjs <předvolba> [--format 9:16,1:1] [--fps 30] [--zvetseni 2] [--zkouska]');
  process.exit(0);
}

// ── předvolba: načíst a zkontrolovat ──────────────────────────────────────────────────────────────────────────────────────
const soubor = path.join(PREDVOLBY, `${JMENO}.json`);
if (!fs.existsSync(soubor)) { console.error(`❌ Předvolba ${JMENO} neexistuje (${path.relative(KOREN, soubor)}).`); process.exit(1); }
const P = JSON.parse(fs.readFileSync(soubor, 'utf8'));
const DRUH = P.druh || 'video', FPS = +(arg('fps') || P.fps || 30), KRATSI = P.kratsi_strana || 1080, ZV = +(arg('zvetseni') || P.zvetseni || 1);
const formaty = arg('format') ? arg('format').split(',') : (P.formaty || ['1:1']);
const chyba = (t) => { console.error(`❌ ${JMENO}: ${t}`); process.exit(1); };
if (!['video', 'foto'].includes(DRUH)) chyba(`druh musí být video nebo foto, ne „${DRUH}“`);
if (![1, 2].includes(ZV)) chyba('zvetseni může být 1 nebo 2');
for (const f of formaty) if (!FORMATY[f]) chyba(`neznámý formát „${f}“ (umím ${Object.keys(FORMATY).join(', ')})`);
if (!Array.isArray(P.zabery) || !P.zabery.length) chyba('chybí záběry (zabery)');

// body záběru doplnit o hodnoty z předchozích bodů
const ZABERY = P.zabery.map((z, i) => {
  if (!OBDOBI.includes(z.obdobi)) chyba(`záběr ${i + 1}: obdobi musí být ${OBDOBI.join(' / ')}`);
  if (!z.cas || isNaN(new Date(z.cas))) chyba(`záběr ${i + 1}: chybí nebo je špatně cas (ISO, např. 2026-07-15T10:30:00+02:00)`);
  if (!Array.isArray(z.body) || !z.body.length) chyba(`záběr ${i + 1}: chybí body kamery`);
  let pred = { noc: 0 };
  const body = z.body.map((b, k) => {
    const x = { ...pred, ...b }; pred = x;
    if (!x.ll || !x.m_na_px) chyba(`záběr ${i + 1}, bod ${k + 1}: první bod musí mít ll a m_na_px`);
    if (k && !(x.t > z.body[k - 1].t)) chyba(`záběr ${i + 1}, bod ${k + 1}: čas t musí růst`);
    const mstr = x.m_na_px * ZV, k2 = Math.log2(mstr / 0.1);
    if (Math.abs(k2 - Math.round(k2)) > 1e-6) console.warn(`⚠️ záběr ${i + 1}, bod ${k + 1}: ${mstr} m na pixel stránky není 0,1 × 2^k → v tomhle místě nebude ostré`);
    return x;
  });
  if (body[0].t !== 0) chyba(`záběr ${i + 1}: první bod musí mít t: 0`);
  // délka = poslední bod, nebo „delka“ záběru, je-li delší (jeden bod + delka = kamera stojí, Pavel 2026-11-26)
  const delka = Math.max(body[body.length - 1].t, +z.delka || 0);
  if (DRUH === 'video' && !(delka > 0)) chyba(`záběr ${i + 1}: nulová délka (přidej bod s časem, nebo delka)`);
  return { ...z, body, delka, prechod: i ? (z.prechod || { druh: 'strih' }) : null };
});

// stav kamery v čase s (sekundy záběru): S-křivka mezi body, přiblížení geometricky
const plynule = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
function kamera(body, s) {
  let k = 0; while (k < body.length - 2 && s > body[k + 1].t) k++;
  const a = body[k], b = body[Math.min(k + 1, body.length - 1)];
  const u = b.t > a.t ? plynule(Math.min(1, Math.max(0, (s - a.t) / (b.t - a.t)))) : 0;
  return { ll: [a.ll[0] + (b.ll[0] - a.ll[0]) * u, a.ll[1] + (b.ll[1] - a.ll[1]) * u],
    m: Math.exp(Math.log(a.m_na_px) + (Math.log(b.m_na_px) - Math.log(a.m_na_px)) * u), noc: a.noc + (b.noc - a.noc) * u };
}

// rozměry: výstup (kratší strana = kratsi_strana) a stránka (výstup / zvětšení)
function rozmer(f) {
  const [a, b] = FORMATY[f], s = KRATSI, sudy = (x) => Math.round(x / 2) * 2;
  const out = a <= b ? [s, sudy(s * b / a)] : [sudy(s * a / b), s];
  if (out.some((x) => x % (2 * ZV))) chyba(`rozměr ${out.join('×')} nejde dělit zvětšením ${ZV} na sudá čísla`);
  return { out, view: out.map((x) => x / ZV) };
}

const OUT = path.join(KOREN, 'videa', JMENO), TMP = path.join(KOREN, 'build', 'video', JMENO);
fs.mkdirSync(OUT, { recursive: true });
const pripona = ZKOUSKA ? '-zkouska' : '';
const nazevF = (f) => f.replace(':', 'x');

// ── prohlížeč ───────────────────────────────────────────────────────────────────────────────────────────────────────────
const prohlizec = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu-rasterization', '--ignore-gpu-blocklist'] });
const chyby = [];
let p, hlidaceVarovany = false;
// chyba v časovači stránky by přes clock.runFor shodila celý běh (2026-11-26: imgToWorld s NaN při zápisu polohy do adresy,
// 4 : 5, zima); v prohlížeči by jen skončila v konzoli → zapsat a jet dál
// Log na odhalení (Pavel 2026-11-26: „nemůžeš si na to odhalení napsat nějaký log?“): render vloží do SVÉ kopie stránky
// hlídače (HLIDACE níž) a při chybě zapíše jejich záznam do ladeni/video-chyby.log (JSON na řádek). Rozbor v napady/VIDEO.md.
let kde = '';
const LOG = path.join(KOREN, 'ladeni', 'video-chyby.log');
const tik = async (ms) => { try { await p.clock.runFor(ms); } catch (e) {
  const z = await p.evaluate(() => { const vp = window.__izo.viewer.viewport, c = vp.getCenter(true);
    const r = { stred: [c.x, c.y], zoom: vp.getZoom(true), hash: location.hash, cas: Date.now(), nan: window.__nanZaznam || [] };
    window.__nanZaznam = []; return r; }).catch((x) => ({ chyba_zaznamu: x.message }));
  chyby.push(`${kde}: ${e.message.split('\n')[0]}`);
  fs.mkdirSync(path.dirname(LOG), { recursive: true });
  fs.appendFileSync(LOG, JSON.stringify({ kdy: new Date().toISOString(), predvolba: JMENO, kde, chyba: e.message.split('\n').slice(0, 6).join(' | '), ...z }) + '\n');
} };
// hlídače NaN: v imgToWorld (než gz spadne) a v časovači zápisu polohy do adresy (stav pružin OpenSeadragonu)
const HLIDACE = [
  ['x = (r1 * d - b * r2) / det; y = (a * r2 - c * r1) / det; h = gz(x, y);',
   'x = (r1 * d - b * r2) / det; y = (a * r2 - c * r1) / det; if (!Number.isFinite(x) || !Number.isFinite(y)) window.__nanHlas({ kde: "imgToWorld", ix, iy, i, h, x, y, vx, vy }); h = gz(x, y);'],
  ['const c = viewer.viewport.getCenter(true), [x, y] = imgToWorld(c.x * W, c.y * W)',
   'const c = viewer.viewport.getCenter(true), _nan = window.__nanStred(c, viewer), [x, y] = imgToWorld(c.x * W, c.y * W)'],
];
const HLIDACE_INIT = () => {
  window.__nanZaznam = [];
  const pruz = (s) => s && { start: [s.start.value, s.start.time], cil: [s.target.value, s.target.time], ted: [s.current.value, s.current.time] };
  let posl = null;
  window.__nanStred = (c, viewer) => { const v = viewer.viewport;
    posl = { stred: [c.x, c.y], now: Date.now(), x: pruz(v.centerSpringX), y: pruz(v.centerSpringY), zoom: pruz(v.zoomSpring) };
    if (!Number.isFinite(c.x) || !Number.isFinite(c.y)) window.__nanZaznam.push({ kde: 'stred', ...posl }); };
  window.__nanHlas = (o) => { window.__nanZaznam.push({ ...o, pruziny: posl, stack: new Error().stack.split('\n').slice(1, 5).join(' < ') }); };
};
async function cekej(co, podminka, max = 90000) {                       // čeká skutečným časem, hodiny stránky jen pootočí
  const t0 = Date.now();
  let cekal = false;
  while (Date.now() - t0 < max) {
    if (await p.evaluate(podminka)) { if (cekal) await tik(17); return; }   // dlaždice dorazily mezi snímky: ještě je nakreslit
    cekal = true; await tik(16); await p.waitForTimeout(25);
  }
  const stav = await p.evaluate(() => { const w = window.__izo?.viewer.world; if (!w) return 'bez mapy';
    return [...Array(w.getItemCount()).keys()].map((i) => { const it = w.getItemAt(i); return `${i}:${it.getOpacity().toFixed(2)}:${it.getFullyLoaded() ? 'ok' : 'čeká'}:${(it.source.url || it.source.tilesUrl || '').slice(-40)}`; }); });
  throw new Error(`nedočkal jsem se: ${co}\n${JSON.stringify(stav, null, 1)}`);
}
const nacteno = () => { const z = window.__izo; if (!z || !z.viewer.world.getItemCount()) return false;
  const il = z.viewer.imageLoader; if (il.jobsInProgress > 0 || il.jobQueue.length) return false;   // žádná dlaždice na cestě
  const w = z.viewer.world, vb = z.viewer.viewport.getBounds(true);          // jen vrstvy v záběru (ty mimo se nenačítají nikdy)
  for (let i = 0; i < w.getItemCount(); i++) {                                // tón soumraku a noci (jednobarevný data: obrázek) kreslí mapa sama
    const it = w.getItemAt(i); if (String(it.source.url || '').startsWith('data:')) continue;
    if (it.getOpacity() > 0 && it.getBounds(true).intersection(vb) && !it.getFullyLoaded()) return false;
  }
  return true; };

// čistý obraz: jen mapa a animace, titulek vlevo dole, nad bezpečnou zónou formátu (video/zony.json, stejné jako rámeček v ?video)
const ZONY = JSON.parse(fs.readFileSync(path.join(KOREN, 'nastroje-pavel', 'video', 'zony.json'), 'utf8'));
const TITULEK = P.titulek === false ? null : { nadpis: MESTO.titulek || MESTO.nazev, podnadpis: 'Mapa z otevřených dat · vytvořeno nástrojem izomapa', ...(P.titulek || {}) };
async function upravVzhled(f, [w, h]) {
  const s = Math.min(w, h), px = (k) => Math.round(s * k), zn = ZONY[f] || {};
  const dole = Math.max(px(0.04), Math.round(h * (zn.dole || 0) + s * 0.02)), vlevo = Math.max(px(0.04), Math.round(w * (zn.vlevo || 0) + s * 0.02));
  await p.addStyleTag({ content: `body > *:not(#map) { display: none !important; } .pin { display: none !important; }
  body > div#video-titulek { position: fixed; left: ${vlevo}px; bottom: ${dole}px; z-index: 50; padding: ${px(0.014)}px ${px(0.02)}px;
    background: rgba(12, 16, 28, .72); color: #fff; border-radius: ${px(0.009)}px; font-family: var(--display, system-ui); line-height: 1.15; display: block !important; }
  #video-titulek b { display: block; font-size: ${px(0.042)}px; font-weight: 700; }
  #video-titulek span { display: block; margin-top: ${px(0.004)}px; font-size: ${px(0.019)}px; opacity: .85; }` });
  if (TITULEK) await p.evaluate(([n, t]) => { const d = document.createElement('div'); d.id = 'video-titulek';
    d.innerHTML = '<b></b><span></span>'; d.querySelector('b').textContent = n; d.querySelector('span').textContent = t; document.body.append(d); },
  [TITULEK.nadpis, TITULEK.podnadpis]);
}

async function otevri(z, f, view) {
  if (p) await p.context().close();
  const ctx = await prohlizec.newContext({ viewport: { width: view[0], height: view[1] }, deviceScaleFactor: 1 });
  await ctx.addInitScript(HLIDACE_INIT);
  await ctx.route((u) => u.pathname === '/' || u.pathname === '/index.html', async (r) => {
    const res = await r.fetch(); let t = await res.text();
    for (const [a, b] of HLIDACE) if (t.includes(a)) t = t.replace(a, b); else if (!hlidaceVarovany) { hlidaceVarovany = true; console.warn('⚠️ hlídač NaN nenašel místo v kódu mapy (změnil se?):', a.slice(0, 50)); }
    await r.fulfill({ response: res, body: t });
  });
  p = await ctx.newPage();
  p.on('pageerror', (e) => chyby.push(e.message));
  await p.clock.install({ time: new Date(z.cas) });
  // výřez v adrese = šířka prvního bodu v km: mapa ho nastaví se zpožděním po načtení a přepsala by kameru (2026-11-26)
  const b0 = z.body[0], km = (view[0] * b0.m_na_px * ZV / 1000).toFixed(4);
  await p.goto(`http://localhost:8000/#${z.obdobi}@${b0.ll[0]},${b0.ll[1]},${km}`, { waitUntil: 'domcontentloaded' });
  await cekej('mapa', () => !!window.__izo && document.querySelector('#loading').hidden);
  await upravVzhled(f, view);
  if (z.pocasi) await p.evaluate((w) => window.__izo.setWeather(w), z.pocasi);
}

// kamera: m_na_px je na pixel VÝSTUPU; stránka má zvetseni× větší pixely → obrazovkových px na px prohlížeče = UM / (m × ZV)
const nastav = (k) => p.evaluate(([lat, lon, m, n]) => {
  const z = window.__izo, v = z.viewer.viewport, [ix, iy] = z.ll2img(lat, lon);
  v.zoomTo(m * z.W / v.getContainerSize().x, null, true); v.panTo(new OpenSeadragon.Point(ix / z.W, iy / z.W), true);
  const e = document.querySelector('#night'), hod = Math.round(n * 100);
  if (+e.value !== hod) { e.value = hod; e.dispatchEvent(new Event('input')); }
}, [k.ll[0], k.ll[1], UM / (k.m * ZV), k.noc]);

const ffmpeg = (a) => execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...a], { stdio: 'inherit' });
const vysledky = [], kontroly = [];
// průběh pro režim ?video (nahled_server.py čte řádky PRUBEH hotovo/celkem): snímky všech formátů, fotka = 1
const nSnimku = (z) => DRUH === 'foto' ? 1 : Math.max(2, Math.round(z.delka * FPS * (ZKOUSKA ? 0.2 : 1)));
const CELKEM = formaty.length * ZABERY.reduce((s, z) => s + nSnimku(z), 0);
let hotovo = 0;
const prubeh = (krok = 1) => { hotovo += krok; if (hotovo === CELKEM || hotovo % 10 === 0) console.log(`PRUBEH ${hotovo}/${CELKEM}`); };

for (const f of formaty) {
  const { out, view } = rozmer(f), dirF = path.join(TMP, nazevF(f));
  fs.rmSync(dirF, { recursive: true, force: true });
  const kontrola = [];                                                   // snímky do kontrolní mřížky
  console.log(`\n▶ ${f}: výstup ${out.join(' × ')}${ZV > 1 ? `, stránka ${view.join(' × ')} (zvětšení ${ZV}×)` : ''}`);

  if (DRUH === 'foto') {
    for (const [i, z] of ZABERY.entries()) {
      await otevri(z, f, view);
      await nastav(kamera(z.body, 0));
      await tik(3000); await cekej('dlaždice', nacteno);                 // 3 s chodu: auta a lidé se rozmístí
      const syrovy = path.join(dirF, `${i + 1}.png`), cil = path.join(OUT, `${JMENO}-${nazevF(f)}-${i + 1}${pripona}.png`);
      fs.mkdirSync(dirF, { recursive: true });
      await p.screenshot({ path: syrovy });
      if (ZV > 1) ffmpeg(['-i', syrovy, '-vf', `scale=iw*${ZV}:ih*${ZV}:flags=neighbor`, cil]); else fs.copyFileSync(syrovy, cil);
      kontrola.push(cil); vysledky.push(cil); prubeh();
    }
  } else {
    const delky = [];
    for (const [i, z] of ZABERY.entries()) {
      const dir = path.join(dirF, String(i + 1)); fs.mkdirSync(dir, { recursive: true });
      await otevri(z, f, view);
      const n = nSnimku(z);                                              // zkouška: pětina snímků, rychlá kontrola scén
      await nastav(kamera(z.body, 0)); await cekej('start', nacteno);
      for (let j = 0; j < n; j++) {
        kde = `${f} záběr ${i + 1} snímek ${j + 1}`;
        await nastav(kamera(z.body, z.delka * j / (n - 1)));
        await tik(1000 / FPS); await cekej('dlaždice', nacteno);
        await p.screenshot({ path: path.join(dir, String(j + 1).padStart(5, '0') + '.png') });
        prubeh();
      }
      delky.push(n / FPS);
      for (const j of [1, Math.ceil(n / 2), n]) kontrola.push(path.join(dir, String(j).padStart(5, '0') + '.png'));
      console.log(`  záběr ${i + 1}: ${n} snímků`);
    }
    // složení: přechody (prolnutí = xfade, střih = concat), zvětšení bez vyhlazování, H.264 pro sítě
    const vstupy = ZABERY.flatMap((z, i) => ['-framerate', String(FPS), '-i', path.join(dirF, String(i + 1), '%05d.png')]);
    const casti = []; let cur = '[0:v]', celkem = delky[0];
    for (let i = 1; i < ZABERY.length; i++) {
      const pr = ZABERY[i].prechod, d = Math.min((pr.delka || 1) * (ZKOUSKA ? 0.2 : 1), delky[i - 1], delky[i]) ;
      if (pr.druh === 'prolnuti') { casti.push(`${cur}[${i}:v]xfade=transition=fade:duration=${d.toFixed(3)}:offset=${(celkem - d).toFixed(3)}[v${i}]`); celkem += delky[i] - d; }
      else { casti.push(`${cur}[${i}:v]concat=n=2:v=1:a=0[v${i}]`); celkem += delky[i]; }
      cur = `[v${i}]`;
    }
    casti.push(`${cur}scale=iw*${ZV}:ih*${ZV}:flags=neighbor,format=yuv420p[ven]`);
    const mp4 = path.join(OUT, `${JMENO}-${nazevF(f)}${pripona}.mp4`);
    ffmpeg([...vstupy, '-filter_complex', casti.join(';'), '-map', '[ven]',
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-tune', 'animation', '-movflags', '+faststart', mp4]);
    vysledky.push(mp4);
  }
  // kontrolní mřížka: u videa začátek, střed a konec každého záběru (řádek = záběr), u fotek všechny
  const mrizka = path.join(OUT, `kontrola-${nazevF(f)}${pripona}.png`);
  // (bez `magick montage`: ten chce písmo na popisky a bez něj končí chybou, i když obrázek vyrobí)
  const sl = DRUH === 'foto' ? Math.min(kontrola.length, 4) : 3, radky = [];
  for (let i = 0; i < kontrola.length; i += sl) radky.push('(', ...kontrola.slice(i, i + sl), '-resize', '360x360', '-bordercolor', '#222', '-border', '6', '+append', ')');
  execFileSync('magick', [...radky, '-background', '#222', '-append', mrizka]);
  console.log(`  kontrola: ${path.relative(KOREN, mrizka)}`); kontroly.push(mrizka);
  if (DRUH === 'video') fs.rmSync(dirF, { recursive: true, force: true });        // snímky jsou stovky MB, mřížka si vzala své
}
await prohlizec.close();
if (chyby.length) console.log('⚠️ chyby stránky:', [...new Set(chyby)], `\n   záznam pro rozbor: ${path.relative(KOREN, LOG)}`);
console.log('\nHotovo:');
for (const f of vysledky) console.log(' ', path.relative(KOREN, f), (fs.statSync(f).size / 1e6).toFixed(1), 'MB');
for (const f of [...vysledky, ...kontroly]) console.log('VYSTUP', path.relative(KOREN, f));   // pro režim ?video
