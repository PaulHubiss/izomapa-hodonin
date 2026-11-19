// Video z mapy pro sociální sítě: node nastroje-pavel/video.mjs [--strana 1080] [--fps 30] [--zkouska]
// Výstup: videa/hodonin-<strana>.mp4 a videa/hodonin-<strana>.gif (videa/ = zástupce na Google Disk).
// Potřebuje běžící náhled na http://localhost:8000 (nastroje-pavel/nahled_server.py) a ffmpeg.
//
// Jak: čas stránky stojí (page.clock), každý snímek se posune přesně o 1/fps s a vyfotí → animace (auta, MHD, lidé, sníh)
// běží plynule bez ohledu na rychlost počítače a obraz je ostrý (PNG, žádné nahrávání obrazovky). Menu, ikonky a ovládání
// jsou skryté, vlevo dole je titulek. Scény: A = průlet léto ve dne, B = zima: den, pak setmění se světly.
// Přechod léto → zima prolne ffmpeg (xfade). Na pixel art 1 : 1 nebo 1 : 2, při zmenšení GIFu nejbližší soused.
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : d; };
const STRANA = +arg('strana', 1080), FPS = +arg('fps', 30), ZKOUSKA = process.argv.includes('--zkouska');
const KOREN = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const TMP = path.join(KOREN, 'build', 'video'), OUT = path.join(KOREN, 'videa');
const MESTO = JSON.parse(fs.readFileSync(path.join(KOREN, 'mesto.json'), 'utf8'));
const sek = (s) => Math.round(s * FPS * (ZKOUSKA ? 0.2 : 1));          // zkouška: pětina snímků, rychlá kontrola scén

// místa (lat, lon) a měřítko = obrazovkových px na px obrazu (0,5 = celé půlpixely, ostré)
const TIC = [48.8531, 17.1264], NAMESTI = [48.8487, 17.1285], MERITKO = 0.5;

fs.rmSync(TMP, { recursive: true, force: true }); fs.mkdirSync(path.join(TMP, 'a'), { recursive: true }); fs.mkdirSync(path.join(TMP, 'b'), { recursive: true });
fs.mkdirSync(OUT, { recursive: true });

const b = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu-rasterization', '--ignore-gpu-blocklist'] });
const chyby = [];
let p;
// Každá scéna v čerstvé stránce s ročním obdobím z adresy: přepnutí období za běhu (setSeason) se zastavenými hodinami
// nedonačte dlaždice středního čtverce ani za 15 s (pokus 2026-11-17), se skutečným časem za 2 s. Přechod prolne ffmpeg.
async function otevri(obdobi, cas) {
  if (p) await p.close();
  p = await (await b.newContext({ viewport: { width: STRANA, height: STRANA }, deviceScaleFactor: 1 })).newPage();
  p.on('pageerror', (e) => chyby.push(e.message));
  await p.clock.install({ time: new Date(cas) });
  await p.goto(`http://localhost:8000/#${obdobi}@${NAMESTI[0]},${NAMESTI[1]},0.5`, { waitUntil: 'domcontentloaded' });
  await cekej('mapa', () => !!window.__izo && document.querySelector('#loading').hidden);
  await upravVzhled();
}

const tik = async (ms) => { await p.clock.runFor(ms); };
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
  for (let i = 0; i < w.getItemCount(); i++) {                                // tón soumraku a noci (jednobarevný data: obrázek) kreslí app.html sám
    const it = w.getItemAt(i); if (String(it.source.url || '').startsWith('data:')) continue;
    if (it.getOpacity() > 0 && it.getBounds(true).intersection(vb) && !it.getFullyLoaded()) return false;
  }
  return true; };
// čistý obraz: jen mapa a animace, titulek vlevo dole
const upravVzhled = async () => {
await p.addStyleTag({ content: `body > *:not(#map) { display: none !important; } .pin { display: none !important; }
  body > div#video-titulek { position: fixed; left: ${Math.round(STRANA * 0.04)}px; bottom: ${Math.round(STRANA * 0.04)}px; z-index: 50; padding: ${Math.round(STRANA * 0.014)}px ${Math.round(STRANA * 0.02)}px;
    background: rgba(12, 16, 28, .72); color: #fff; border-radius: 10px; font-family: var(--display, system-ui); line-height: 1.15; display: block !important; }
  #video-titulek b { display: block; font-size: ${Math.round(STRANA * 0.042)}px; font-weight: 700; }
  #video-titulek span { display: block; margin-top: 4px; font-size: ${Math.round(STRANA * 0.019)}px; opacity: .85; }` });
await p.evaluate(([n, s]) => { const d = document.createElement('div'); d.id = 'video-titulek';
  d.innerHTML = `<b></b><span></span>`; d.querySelector('b').textContent = n; d.querySelector('span').textContent = s; document.body.append(d); },
  [MESTO.titulek || MESTO.nazev, 'Mapa z otevřených dat · vytvořeno nástrojem izomapa']);
};

const pohled = (ll, meritko = MERITKO) => p.evaluate(([lat, lon, m]) => {
  const z = window.__izo, v = z.viewer.viewport, [ix, iy] = z.ll2img(lat, lon);
  v.zoomTo(m * z.W / v.getContainerSize().x, null, true); v.panTo(new OpenSeadragon.Point(ix / z.W, iy / z.W), true);
}, [ll[0], ll[1], meritko]);
const noc = (n) => p.evaluate((n) => { const e = document.querySelector('#night'); e.value = Math.round(n * 100); e.dispatchEvent(new Event('input')); }, n);

let cislo = { a: 0, b: 0 };
async function snimek(kam) {
  await tik(1000 / FPS);
  await cekej('dlaždice', nacteno);
  await p.screenshot({ path: path.join(TMP, kam, String(++cislo[kam]).padStart(5, '0') + '.png') });
}
const plynule = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

// A: průlet od informačního centra na Masarykovo náměstí (léto, den), chvíli stát
await otevri('leto', '2026-07-15T10:30:00+02:00');                      // letní dopoledne: provoz a MHD ve dne
await p.evaluate(() => { window.__izo.setWeather('clear'); });
await noc(0); await pohled(TIC); await cekej('start', nacteno);
for (let k = 0, n = sek(8); k < n; k++) {
  const t = plynule(k / (n - 1));
  await pohled([TIC[0] + (NAMESTI[0] - TIC[0]) * t, TIC[1] + (NAMESTI[1] - TIC[1]) * t]);
  await snimek('a');
}
for (let k = 0; k < sek(2); k++) await snimek('a');
console.log('scéna A', cislo.a, 'snímků');

// B: zima na náměstí (sníh), den → noc se světly
await otevri('zima', '2026-01-14T15:30:00+01:00');                      // zimní odpoledne, setmí se v záběru
await p.evaluate(() => window.__izo.setWeather('snow'));
await noc(0); await pohled(NAMESTI); await cekej('zima', nacteno);
for (let k = 0; k < sek(2.5); k++) await snimek('b');
for (let k = 0, n = sek(3.5); k < n; k++) { await noc(plynule(k / (n - 1))); await snimek('b'); }
for (let k = 0; k < sek(2.5); k++) await snimek('b');
console.log('scéna B', cislo.b, 'snímků');
await b.close();
if (chyby.length) console.log('⚠️ chyby stránky:', chyby);

// složení: A a B prolnout (1 s), H.264 pro sítě, GIF v poloviční velikosti (nejbližší soused = ostré pixely)
const prolnuti = ZKOUSKA ? 0.2 : 1, delkaA = cislo.a / FPS;
const mp4 = path.join(OUT, `hodonin-${STRANA}${ZKOUSKA ? '-zkouska' : ''}.mp4`), gif = mp4.replace(/\.mp4$/, '.gif');
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', path.join(TMP, 'a', '%05d.png'), '-framerate', String(FPS), '-i', path.join(TMP, 'b', '%05d.png'),
  '-filter_complex', `[0][1]xfade=transition=fade:duration=${prolnuti}:offset=${(delkaA - prolnuti).toFixed(3)},format=yuv420p`,
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-tune', 'animation', '-movflags', '+faststart', mp4], { stdio: 'inherit' });
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', mp4, '-filter_complex',
  `fps=15,scale=${STRANA / 2}:-1:flags=neighbor,split[x][y];[x]palettegen=max_colors=192:stats_mode=diff[p];[y][p]paletteuse=dither=none:diff_mode=rectangle`, gif], { stdio: 'inherit' });
for (const f of [mp4, gif]) console.log(path.relative(KOREN, f), (fs.statSync(f).size / 1e6).toFixed(1), 'MB');
