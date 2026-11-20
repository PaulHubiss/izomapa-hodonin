// Srovnání modelů Claude × ChatGPT v našem rendereru (Pavel 2026-11-20: „pak je porovnáme a vybereme lepší“).
//   node nastroje-pavel/chatgpt-modely/porovnej.mjs <balik> [<balik> …]
// Pro každou stavbu z predani/chatgpt/<balik>/od-chatgpt/<slug>.js vykreslí současný pamatky/<slug>.js a verzi od ChatGPT
// (podstrčenou přes page.route, nic se nepřepíše) ze stejných pohledů: od JZ zblízka jako mapa, od JV a okolí v měřítku mapy.
// Obrázky navrhy/porovnani/<slug>-claude.png a -gpt.png (mimo git, vyrobí se znovu), seznam navrhy/porovnani/seznam.json
// pro stránku navrhy/srovnani.html (Vybírač variant, volba se ukládá do volby/srovnani.json).
// Vybraná verze ChatGPT se pak převezme: prevezmi.mjs <balik> --pouzij=slug1,slug2 (naše se zálohuje).
import fs from 'node:fs'; import path from 'node:path';
import { ROOT, server, prohlizec, vyrez } from '../../pamatky/_spolecne.mjs';

const baliky = process.argv.slice(2).filter((a) => !a.startsWith('--'));
if (!baliky.length) { console.log('použití: porovnej.mjs <balik> [<balik> …]'); process.exit(1); }
const OUT = path.join(ROOT, 'navrhy/porovnani'); fs.mkdirSync(OUT, { recursive: true });
const srv = await server(), port = srv.address().port, browser = await prohlizec();
const seznam = [];
for (const b of baliky) {
  const OD = path.join(ROOT, 'predani/chatgpt', b, 'od-chatgpt');
  for (const f of fs.readdirSync(OD).filter((x) => x.endsWith('.js')).sort()) {
    const slug = f.replace(/\.js$/, ''), d = JSON.parse(fs.readFileSync(path.join(ROOT, `pamatky/${slug}.json`), 'utf8')), v = vyrez(d);
    const gpt = fs.readFileSync(path.join(OD, f), 'utf8');
    const stats = {};
    for (const kdo of ['claude', 'gpt']) {
      const page = await browser.newPage();
      if (kdo === 'gpt') await page.route(new RegExp(`/pamatky/${slug}\\.js(\\?|$)`), (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: gpt }));
      await page.goto(`http://127.0.0.1:${port}/render.html?mpp=0.2&tile=1024&season=summer&dir=${v.dir}&alpha=0&v=${Date.now()}&pam=vse&pamextra=${slug}`);
      await page.waitForFunction(() => window.READY === true, null, { timeout: 300000, polling: 300 });
      const R = v.RAD + 6, span = v.span;
      const png = await page.evaluate(async ({ fx, fy, fz, R, span }) => {
        const S = 640, views = [[225, R, span / 1.4, false], [135, R, span / 1.2, false], [225, 0, span * 1.9, true]];
        const c = document.createElement('canvas'); c.width = S * 3; c.height = S; const x = c.getContext('2d');
        for (let i = 0; i < views.length; i++) { const [az, r, sp, tr] = views[i], im = new Image(); im.src = window.renderView(az, fx, fy, fz, r, sp, tr); await im.decode(); x.drawImage(im, i * S, 0, S, S); }
        return c.toDataURL('image/png');
      }, { fx: v.fx, fy: v.fy, fz: v.fz, R, span });
      stats[kdo] = await page.evaluate((s) => window.PAM_STATS[s] || null, slug);
      fs.writeFileSync(path.join(OUT, `${slug}-${kdo}.png`), Buffer.from(png.split(',')[1], 'base64'));
      await page.close();
    }
    seznam.push({ slug, nazev: d.nazev, balik: b, claude: stats.claude?.trojuhelniku, gpt: stats.gpt?.trojuhelniku });
    console.log(`${slug.padEnd(28)} Claude ${String(stats.claude?.trojuhelniku ?? '–').padStart(6)} · ChatGPT ${String(stats.gpt?.trojuhelniku ?? '–').padStart(6)} trojúhelníků`);
  }
}
fs.writeFileSync(path.join(OUT, 'seznam.json'), JSON.stringify(seznam, null, 1));
await browser.close(); srv.close();
console.log(`hotovo: ${seznam.length} staveb → navrhy/porovnani/, stránka http://nastroje.localhost/p/Izomapa/navrhy/srovnani.html`);
