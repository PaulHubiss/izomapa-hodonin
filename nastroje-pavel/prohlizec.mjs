// Engine prohlížeče pro zkoušky: PROHLIZEC=chromium|webkit|firefox (výchozí chromium).
// Zkoušky importují `chromium` odsud místo z 'playwright' → beze změny kódu běží v enginu, který si vybereš.
// WebKit = Safari (Pavlův prohlížeč), Firefox; instalace: sh nastroje-pavel/instaluj-webkit.sh. Všechno najednou:
// node nastroje-pavel/zkousky.mjs.
// Rozdíly enginů, které se tu vyrovnají (zjištěno 2026-11-17):
//  - přepínače GPU Chromia (--use-angle=metal…) jiné enginy neznají → nepředávají se,
//  - WebKit a Firefox neznají oprávnění ke schránce (clipboard-read/-write) → vynechají se,
//  - Firefox: upravené buildy Playwrightu (142 i 159) na macOS 27 nenaběhnou (izolace procesů, „Could not find profile
//    folder“). Jede BĚŽNÝ Firefox z /Applications (brew install --cask firefox) přes playwright-core ze Společných
//    nástrojů (1.65.1, kanál moz-firefox = WebDriver BiDi), 2026-11-17. ⚠️ Po instalaci ho JEDNOU spustit normálně
//    (open -a Firefox, pak zavřít) – do té doby si nezaloží profil a hlásí taky „Could not find profile folder“.
//    Knihovny projektu zůstávají na verzích od autora (jiný Playwright = jiné Chromium = jiné barvy dlaždic).
import * as pw from 'playwright';
import os from 'node:os';
export const ENGINE = process.env.PROHLIZEC || 'chromium';
const pwNove = ENGINE === 'firefox' ? await import(`${os.homedir()}/Claude/Spolecne-nastroje/node_modules/playwright-core/index.mjs`).catch(() => null) : null;
const e = (pwNove && pwNove.firefox) || pw[ENGINE];
if (!e) throw new Error(`neznámý PROHLIZEC=${ENGINE} (chromium, webkit, firefox)`);
const uprav = (o = {}) => (ENGINE === 'chromium' || !o.permissions ? o : { ...o, permissions: o.permissions.filter((p) => !p.startsWith('clipboard')) });
export const chromium = {
  async launch(o = {}) {
    // Chromium na GPU (Metal) jako render dlaždic a video, pokud zkouška nemá vlastní přepínače (dřív SwiftShader = CPU)
    const opt = ENGINE === 'chromium' ? { ...o, args: o.args || ['--use-angle=metal', '--enable-gpu-rasterization', '--ignore-gpu-blocklist'] } : { ...o, args: undefined };
    if (ENGINE === 'firefox' && pwNove) opt.channel = 'moz-firefox';     // běžný Firefox z /Applications
    const b = await e.launch(opt);
    const nc = b.newContext.bind(b);
    // WebKit a Firefox bez okna nedovolí číst schránku (NotAllowedError): náhradní schránka v paměti stránky,
    // tlačítko Sdílet do ní zapíše a zkouška si odkaz přečte stejně jako v Chromiu
    b.newContext = async (x) => {
      const c = await nc(uprav(x));
      if (ENGINE !== 'chromium') await c.addInitScript(() => { let s = ''; Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (t) => { s = String(t); }, readText: async () => s, write: async () => {}, read: async () => [] } }); });
      return c;
    };
    b.newPage = async (x) => (await b.newContext(x)).newPage();
    return b;
  },
};
export const { webkit, firefox } = pw;

// Mapa je připravená: běží, žádná dlaždice v záběru na cestě, lidé načtení. Místo pevného „počkej 6 s“ po načtení
// stránky (Pavel 2026-11-17: zkoušky jsou pomalé) – obvykle hotovo za 1–2 s. `navic` = pár snímků na dokreslení.
export async function pripraveno(p, navic = 300) {
  await p.waitForFunction(() => {
    const z = window.__izo; if (!z || !document.querySelector('#loading')?.hidden || !z.CHODCI?.ok) return false;
    const v = z.viewer, il = v.imageLoader; if (il.jobsInProgress > 0 || il.jobQueue.length) return false;
    const w = v.world, vb = v.viewport.getBounds(true);
    for (let i = 0; i < w.getItemCount(); i++) {
      const it = w.getItemAt(i); if (String(it.source.url || '').startsWith('data:')) continue;   // tón noci kreslí app.html sám
      if (it.getOpacity() > 0 && it.getBounds(true).intersection(vb) && !it.getFullyLoaded()) return false;
    }
    return true;
  }, null, { timeout: 30000, polling: 100 });
  await p.waitForTimeout(navic);
}
