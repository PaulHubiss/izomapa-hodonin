// Zkouška režimu ?video (napady/VIDEO.md, fáze 2): node nastroje-pavel/test_video_rezim.mjs [--snimek] [--bez-renderu]
// Potřebuje náhledový server na :8000 (nahled_server.py). Ověří: režim jen na /?video a ne v site/, karta Video v menu,
// rámečky a bezpečné zóny ve volné ploše vedle panelu, přichycení přiblížení, převod středu na souřadnice, uložení
// předvolby, statický záběr (jeden bod + délka) a render tlačítkem Vyrobit až po přehratelné video (Range jako Safari).
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const KOREN = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const JMENO = 'zkouska-rezimu', SOUBOR = path.join(KOREN, 'nastroje-pavel', 'video', 'predvolby', `${JMENO}.json`), VYSTUP = path.join(KOREN, 'videa', JMENO);
let chyb = 0;
const ok = (podminka, text) => { console.log(`${podminka ? '✅' : '❌'} ${text}`); if (!podminka) chyb++; };

// 1. jen lokálně
ok(!fs.readFileSync(path.join(KOREN, 'site', 'index.html'), 'utf8').includes('_video'), 'site/index.html režim neobsahuje (na web se nedostane)');
ok(!fs.readdirSync(path.join(KOREN, 'site')).some((f) => /rezim|_video/.test(f)), 'v site/ nejsou soubory režimu');
const bez = await (await fetch('http://localhost:8000/')).text(), s = await (await fetch('http://localhost:8000/?video')).text();
ok(!bez.includes('/_video/rezim.js'), 'obyčejná mapa skript režimu nenačítá');
ok(s.includes('/_video/rezim.js') && s.includes('/_video/rezim.css'), '/?video skript a styl režimu načítá');

const b = await chromium.launch({ args: ['--use-angle=metal'] });
const p = await (await b.newContext({ viewport: { width: 1600, height: 1000 } })).newPage();
const chybyStranky = [];
p.on('pageerror', (e) => chybyStranky.push(e.message));
await p.goto('http://localhost:8000/?video#leto@48.8487,17.1285,1', { waitUntil: 'domcontentloaded' });
await p.waitForSelector('#nb-video:not([hidden]) .vr-sek', { timeout: 60000 });
await p.waitForTimeout(500);

// 2. karta v menu, rámečky a zóny
ok(await p.locator('#nbRail [data-vtab="video"].on').count() === 1, 'tlačítko Video v liště menu je zapnuté');
ok(await p.locator('#panel > .nb-pane:not([hidden])').count() === 1, 'v panelu je vidět jen karta Video');
ok(await p.locator('.vr-i').count() >= 10, `nápověda u prvků (${await p.locator('.vr-i').count()} otazníčků)`);
await p.locator('.vr-i').first().hover();
ok(await p.locator('#vr-tip:not([hidden])').count() === 1, 'nápověda se po najetí ukáže');
ok(await p.locator('.vr-ram').count() === 2, 'dva rámečky (9 : 16 a 1 : 1)');
ok(await p.locator('.vr-hlavni .vr-zona').count() === 3, 'hlavní 9 : 16 má tři bezpečné zóny');
const r = await p.locator('.vr-ram.vr-hlavni').boundingBox(), panelR = (await p.locator('#panel').boundingBox());
ok(Math.abs(r.height / r.width - 16 / 9) < 0.01, `hlavní rámeček má poměr 9 : 16 (${(r.height / r.width).toFixed(3)})`);
ok(r.x >= panelR.x + panelR.width && r.x + r.width <= 1600 && r.y >= 0 && r.y + r.height <= 1000, `rámeček je celý ve volné ploše vedle panelu (${Math.round(r.x)}–${Math.round(r.x + r.width)} px)`);
ok(await p.locator('#panel').evaluate((e) => e.scrollWidth - e.clientWidth) <= 0, 'panel nepřetéká do šířky');
ok(!(await p.locator('.pin').first().isVisible().catch(() => false)), 'ikonky míst jsou v režimu skryté');
await p.evaluate(() => window.__izo.viewer.viewport.zoomBy(1.3));
await p.waitForTimeout(1500);
const ost = await p.evaluate(() => { const v = window.__izo.viewer.viewport; return { mo: v.getBounds(true).width * window.__izo.W * 0.2 / v.getContainerSize().x, h: document.querySelector('.vr-ram.vr-hlavni').offsetHeight }; });
const mV = ost.mo * ost.h / 1920;
ok([0.1, 0.2, 0.4, 0.8, 1.6, 3.2].some((m) => Math.abs(mV / m - 1) < 0.003), `po přiblížení ostré: ${mV.toFixed(4)} m/px výstupu`);
ok(Math.abs(ost.h - r.height) < 2, 'rámeček po přiblížení drží velikost');

// 3. statický záběr: jen 1 : 1, jeden bod, délka 2 s
await p.locator('.vr-seg').nth(1).getByRole('button', { name: '9 : 16' }).click();       // formáty: odebrat 9 : 16 → zbude 1 : 1
await p.getByRole('button', { name: '+ Nový záběr' }).click();
await p.getByLabel('Délka (s)').fill('2'); await p.getByLabel('Délka (s)').dispatchEvent('change');
const stred = await p.evaluate(() => { const g = document.querySelector('.vr-kriz').getBoundingClientRect(), v = window.__izo.viewer.viewport;
  const q = v.pointFromPixel(new OpenSeadragon.Point(g.left + g.width / 2, g.top + g.height / 2), true); return [q.x * window.__izo.W, q.y * window.__izo.W]; });
await p.getByLabel('Název').fill('Zkouška režimu');
await p.getByLabel('Jméno souboru').fill(JMENO);
await p.getByRole('button', { name: 'Uložit' }).click();
await p.waitForFunction(() => /Uloženo|selhal|neodpovídá|Vyplň/.test(document.querySelector('#vr-zprava')?.textContent || ''), null, { timeout: 10000 });
ok(fs.existsSync(SOUBOR), `předvolba uložená (${path.relative(KOREN, SOUBOR)})`);
const d = fs.existsSync(SOUBOR) ? JSON.parse(fs.readFileSync(SOUBOR, 'utf8')) : null;
if (d) {
  ok(d.formaty.join() === '1:1', 'formát jen 1 : 1');
  ok(d.zabery[0].body.length === 1 && d.zabery[0].delka === 2, 'statický záběr: jeden bod a délka 2 s');
  const [ix, iy] = await p.evaluate(([lat, lon]) => window.__izo.ll2img(lat, lon), d.zabery[0].body[0].ll);
  ok(Math.hypot(ix - stred[0], iy - stred[1]) < 1, `bod = střed rámečku (odchylka ${Math.hypot(ix - stred[0], iy - stred[1]).toFixed(2)} px)`);
  ok(/^\d{4}-\d\d-\d\dT\d\d:\d\d:00[+-]\d\d:\d\d$/.test(d.zabery[0].cas), `čas záběru s posunem (${d.zabery[0].cas})`);
}
const zle = (await fetch('http://localhost:8000/_video/predvolba', { method: 'POST', body: JSON.stringify({ jmeno: '../ven', data: { zabery: [{}] } }) })).status;
ok(zle === 400, 'jméno s cestou server odmítne');
ok((await fetch('http://localhost:8000/_video/vystup/..%2F..%2Fsite/index.html')).status === 404, 'výstupy mimo videa/ server nevydá');

// 4. render tlačítkem (zkušebně), až po přehratelné video
if (!process.argv.includes('--bez-renderu') && d) {
  await p.getByRole('button', { name: '🎬 Vyrobit' }).click();
  await p.waitForFunction(() => /Vyrábím/.test(document.querySelector('.vr-beh-stav')?.textContent || ''), null, { timeout: 15000 });
  await p.waitForFunction(() => /Hotovo|chybou/.test(document.querySelector('.vr-beh-stav')?.textContent || ''), null, { timeout: 300000, polling: 1000 });
  const stavT = await p.locator('.vr-beh-stav').textContent();
  ok(stavT.startsWith('Hotovo'), `render: ${stavT}`);
  const mp4 = path.join(VYSTUP, `${JMENO}-1x1-zkouska.mp4`);
  ok(fs.existsSync(mp4), `video vzniklo (${path.relative(KOREN, mp4)})`);
  const rz = await fetch(`http://localhost:8000/_video/vystup/${JMENO}/${JMENO}-1x1-zkouska.mp4`, { headers: { Range: 'bytes=0-99' } });
  ok(rz.status === 206 && (await rz.arrayBuffer()).byteLength === 100, 'video jde stahovat po kouscích (Range 206, Safari ho přehraje)');
  ok(await p.locator('video.vr-nahled').count() === 1, 'v kartě je náhled videa');
  const dur = +execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', mp4], { encoding: 'utf8' });
  ok(Math.abs(dur - 0.4) < 0.1, `statický záběr 2 s zkušebně = ${dur.toFixed(2)} s (pětina)`);
}

if (process.argv.includes('--snimek')) {
  await p.getByRole('button', { name: '+ Nový záběr' }).click();
  await p.screenshot({ path: path.join(KOREN, 'snimky', 'video-rezim.png') });
}
ok(!chybyStranky.length, `bez chyb stránky${chybyStranky.length ? ': ' + chybyStranky.join(' | ') : ''}`);
await b.close();
fs.rmSync(SOUBOR, { force: true }); fs.rmSync(VYSTUP, { recursive: true, force: true });     // po sobě: zkušební předvolba a výstup
console.log(chyb ? `\n❌ ${chyb} chyb` : '\n✅ vše prošlo');
process.exit(chyb ? 1 : 0);
