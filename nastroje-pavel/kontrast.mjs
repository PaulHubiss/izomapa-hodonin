// Kontrast textu na skle nad mapou (2026-11-18, před spuštěním). axe-core tohle neumí: pod průhledným panelem nevidí mapu.
// Postup jako Hnuti-Pro-web `kontrola:kontrast`: u každého viditelného textu v panelu, liště, kartě a hlavičce se změří
// jeho barva, pak se všem textům dá průhledná barva a snímek ukáže skutečné pozadí (sklo + rozmazaná mapa). Kontrast se
// počítá proti 90. percentilu světlosti pod textem (nejhorší rozumný případ, ne jeden zbloudilý pixel).
//   node nastroje-pavel/kontrast.mjs [summer winter …]      (běžící náhled na :8000)
// Hranice WCAG 2.1 AA: 4,5 : 1 běžný text, 3 : 1 velký (od 24 px, nebo od 18,66 px tučně).
import { chromium, pripraveno } from './prohlizec.mjs';

//   node nastroje-pavel/kontrast.mjs winter --varianta C     (varianta skla ze sklo_css.mjs)
//   … --varianta C+Y   (sklo C a k tomu úprava lišty Y)
import { VARIANTY, LISTA } from './sklo_css.mjs';
const argv = process.argv.slice(2), vi = argv.indexOf('--varianta');
if (vi >= 0) { process.env.KONTRAST_CSS = argv[vi + 1].split('+').map((k) => (VARIANTY[k] || LISTA[k]).css).join(' '); argv.splice(vi, 2); }
const OBDOBI = argv.length ? argv : ['summer', 'winter'];
const TOKEN = { summer: 'leto', winter: 'zima', autumn: 'podzim', spring: 'jaro' };
const SEKCE = ['vzhled', 'vrstvy', 'mista', 'dnes'];
const b = await chromium.launch();
const vysledky = [];
for (const ob of OBDOBI) for (const sirka of [1280, 390]) {
  const ctx = await b.newContext({ viewport: { width: sirka, height: 860 }, isMobile: sirka < 700, hasTouch: sirka < 700, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  // výřez na náměstí, nejvíc pestrá a světlá místa (v zimě sníh na střechách)
  await p.goto(`http://localhost:8000/#${TOKEN[ob]}@48.8487,17.1285,0.5`, { waitUntil: 'load' }); await pripraveno(p, 2500);
  if (process.env.KONTRAST_CSS) await p.addStyleTag({ content: process.env.KONTRAST_CSS });   // varianta vzhledu (sklo_varianty.mjs)
  for (const k of SEKCE) {
    const tl = p.locator(`.nb-rail [data-tab="${k}"]`);
    if (!(await tl.isVisible())) continue;
    if ((await tl.getAttribute('aria-pressed')) !== 'true') await tl.click();
    await p.waitForTimeout(500);
    const texty = await p.evaluate(() => {
      const out = [], vidim = (e) => { const r = e.getBoundingClientRect(); return r.width > 2 && r.height > 2 && r.bottom > 0 && r.top < innerHeight && getComputedStyle(e).visibility !== 'hidden'; };
      for (const e of document.querySelectorAll('#panel *, #nbRail *, .nb-hlava-mobil *')) {
        const vlastni = [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()); if (!vlastni || !vidim(e)) continue;
        const cs = getComputedStyle(e); if (+cs.opacity === 0) continue;
        const r = e.getBoundingClientRect(), px = parseFloat(cs.fontSize), w = +cs.fontWeight;
        // jen text, který je opravdu vidět: na jeho středu je on sám (ne posunutý mimo seznam, ne pod jiným prvkem)
        const nahore = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        // (ne „nahore.contains(e)“: položky ve sbalené skupině mají rozměry a na jejich místě leží panel, který je obsahuje)
        if (!nahore || !(nahore === e || e.contains(nahore))) continue;
        e.dataset.kontrast = out.length;
        out.push({ text: e.textContent.trim().slice(0, 28), barva: cs.color, px, tucne: w >= 700, rect: [r.left, r.top, r.width, r.height] });
      }
      return out;
    });
    // pozadí bez textu: průhledné písmo, bez stínu, bez ikon (ikony jsou taky „popředí“)
    await p.addStyleTag({ content: '#panel *, #nbRail *, .nb-hlava-mobil * { color: transparent !important; text-shadow: none !important; caret-color: transparent !important; } #panel svg, #nbRail svg, #nbRail img { visibility: hidden !important; }' });
    await p.waitForTimeout(200);
    // texty, kterým průhlednost nezabrala (vložená barva s !important), by měření zkreslily → vynechat a nahlásit
    const nezabralo = await p.evaluate(() => [...document.querySelectorAll('[data-kontrast]')].filter((e) => !/rgba\(.*,\s*0\)|transparent/.test(getComputedStyle(e).color)).map((e) => +e.dataset.kontrast));
    if (nezabralo.length) console.log(`  (${ob} ${sirka} ${k}: ${nezabralo.length} textů bez průhlednosti vynecháno)`);
    for (const i of nezabralo.sort((a, c) => c - a)) texty.splice(i, 1);
    const png = (await p.screenshot()).toString('base64');
    const mereni = await p.evaluate(async ({ png, texty }) => {
      const im = new Image(); im.src = `data:image/png;base64,${png}`; await im.decode();
      const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const g = c.getContext('2d'); g.drawImage(im, 0, 0);
      const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
      const L = (r, gg, bb) => 0.2126 * lin(r) + 0.7152 * lin(gg) + 0.0722 * lin(bb);
      return texty.map((t) => {
        const [x, y, w, h] = t.rect.map(Math.round), d = g.getImageData(Math.max(0, x), Math.max(0, y), Math.max(1, Math.min(w, c.width - x)), Math.max(1, Math.min(h, c.height - y))).data;
        const ls = []; for (let i = 0; i < d.length; i += 16) ls.push(L(d[i], d[i + 1], d[i + 2])); ls.sort((a, b) => a - b);
        const pozadi = ls[Math.floor(ls.length * 0.9)] ?? 0;
        const [r, gg, bb] = t.barva.match(/[\d.]+/g).map(Number), popredi = L(r, gg, bb);
        const pomer = (Math.max(popredi, pozadi) + 0.05) / (Math.min(popredi, pozadi) + 0.05);
        const hranice = t.px >= 24 || (t.tucne && t.px >= 18.66) ? 3 : 4.5;
        return { ...t, pomer: Math.round(pomer * 100) / 100, hranice };
      });
    }, { png, texty });
    for (const m of mereni) vysledky.push({ ob, sirka, sekce: k, ...m });
    await p.evaluate(() => { document.querySelectorAll('style').forEach((s) => s.textContent.includes('caret-color: transparent') && s.remove());
      document.querySelectorAll('[data-kontrast]').forEach((e) => delete e.dataset.kontrast); });
  }
  await ctx.close();
}
await b.close();
const spatne = vysledky.filter((v) => v.pomer < v.hranice);
const nejhorsi = [...vysledky].sort((a, c) => a.pomer - c.pomer).slice(0, 12);
console.log(`změřeno ${vysledky.length} textů, pod hranicí ${spatne.length}`);
console.log('nejhorší:');
for (const v of nejhorsi) console.log(`  ${v.pomer < v.hranice ? '❌' : '✅'} ${v.pomer.toFixed(2).padStart(5)} : 1 (min ${v.hranice}) · ${v.ob} ${v.sirka} ${v.sekce} · ${v.px}px${v.tucne ? ' tučně' : ''} ${v.barva} · „${v.text}“`);
const skupiny = {}; for (const v of spatne) { const k = `${v.barva} ${v.px}px`; skupiny[k] = (skupiny[k] || 0) + 1; }
if (spatne.length) console.log('pod hranicí podle barvy a velikosti:', JSON.stringify(skupiny));
process.exit(spatne.length ? 1 : 0);
