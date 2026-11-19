// Zkouška F7, odkaz na pohled: node nastroje-pavel/test_sdileni.mjs
// Otevře kartu (5 budov, památka, místo ze seznamu), vypne vrstvu, klikne na Sdílet v kartě, zkopírovaný odkaz otevře
// v nové stránce a porovná nadpis a řádky karty i stav vrstev. Nakonec odkaz bez karty (tlačítko nahoře) a chyby stránky.
import { chromium, pripraveno } from './prohlizec.mjs';   // engine podle PROHLIZEC (chromium, webkit, firefox)
import { sekce } from './sekce.mjs';
const URL0 = 'http://localhost:8000/';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1200, height: 800 }, permissions: ['clipboard-read', 'clipboard-write'] });
const chyby = [];
const nova = async (url) => {
  const p = await ctx.newPage(); p.on('pageerror', (e) => chyby.push(e.message));
  await p.goto(url, { waitUntil: 'load' }); await pripraveno(p); return p;
};
const karta = (p) => p.evaluate(() => ({
  open: !document.querySelector('#card').hidden,
  nadpis: document.querySelector('#cardTitle').textContent,
  radky: [...document.querySelectorAll('#cardDl dt')].map((dt) => `${dt.textContent}: ${dt.nextElementSibling.textContent}`).join(' | '),
  doprava: document.querySelector('#l-traffic').checked, popisky: document.querySelector('#l-labels').checked,
}));
// na počítači Sdílet otevře nabídku (2026-11-18), odkaz zkopíruje až „Kopírovat odkaz“
const sdilej = async (p, sel) => { await p.click(sel); await p.click('#shareMenu [data-k="kopirovat"]'); await p.waitForTimeout(300); return p.evaluate(() => navigator.clipboard.readText()); };
let ok = 0, spatne = 0;
const porovnej = (co, a, c, url) => {
  const shoda = c.open && a.nadpis === c.nadpis && a.radky === c.radky && a.doprava === c.doprava && a.popisky === c.popisky;
  shoda ? ok++ : spatne++;
  console.log(shoda ? '✅' : '❌', co, '·', a.nadpis, shoda ? '' : `\n   čekal: ${JSON.stringify(a)}\n   dostal: ${JSON.stringify(c)}\n   odkaz: ${url}`);
};

const p = await nova(URL0);
// budovy: 5 s adresou z různých míst středového čtverce, i ty v husté zástavbě
const budovy = await p.evaluate(async () => {
  const d = await fetch('overlay/c0_0.json').then((q) => q.json());
  const s = d.buildings.filter((x) => x.addr && x.addr.length);
  return [0.1, 0.3, 0.5, 0.7, 0.9].map((f) => s[Math.floor(f * s.length)]);
});
await sekce(p, '#l-traffic'); await p.click('#l-traffic');      // vypnout dopravu: odkaz to musí nést
for (const [i, bud] of budovy.entries()) {
  await p.evaluate((x) => window.__izo.showBuilding(x), bud);
  const a = await karta(p), url = await sdilej(p, '#cardShare');
  const q = await nova(url); porovnej(`budova ${i + 1}`, a, await karta(q), url); await q.close();
}
// památka
await p.evaluate(() => window.__izo.showPamatka(window.__izo.PAMATKY[0]));
{ const a = await karta(p), url = await sdilej(p, '#cardShare'); const q = await nova(url); porovnej('památka', a, await karta(q), url); await q.close(); }
// místo ze seznamu „Místa a příběhy“
await sekce(p, '#places'); await p.click('#places button');
await p.waitForTimeout(800);
{ const a = await karta(p), url = await sdilej(p, '#cardShare'); const q = await nova(url); porovnej('místo', a, await karta(q), url); await q.close(); }
// tlačítko nahoře bez otevřené karty: jen pohled a vrstvy, karta zavřená
await p.click('#cardClose'); await sekce(p, '#l-labels'); await p.click('#l-labels');
{
  const url = await sdilej(p, '#share'), q = await nova(url), c = await karta(q);
  const shoda = !c.open && !c.doprava && !c.popisky && /bezpopisku/.test(url) && /bezdopravy/.test(url);
  shoda ? ok++ : spatne++;
  console.log(shoda ? '✅' : '❌', 'pohled bez karty ·', url); await q.close();
}
// nabídka sdílení na počítači: 4 položky celé v okně, nalevo od tlačítka, odkazy nesou adresu pohledu, Esc a klik vedle zavřou
{
  await p.click('#share'); await p.waitForTimeout(200);
  const m = await p.evaluate(() => {
    const n = document.getElementById('shareMenu'), r = n.getBoundingClientRect(), t = document.getElementById('share').getBoundingClientRect();
    const h = (k) => n.querySelector(`[data-k="${k}"]`).getAttribute('href') || '';
    return { videt: !n.hidden && r.width > 100, polozek: n.querySelectorAll('[role="menuitem"]').length - (navigator.share ? 1 : 0),
      dalsi: !!n.querySelector('[data-k="dalsi"]') === !!navigator.share,
      vOkne: r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight, vlevo: r.right <= t.left,
      fb: h('facebook'), wa: h('whatsapp'), mail: h('email'), fokus: document.activeElement?.dataset.k };
  });
  const enc = encodeURIComponent('#');
  const v1 = m.videt && m.polozek === 4 && m.dalsi && m.vOkne && m.vlevo && m.fokus === 'kopirovat';
  const v2 = m.fb.startsWith('https://www.facebook.com/sharer/sharer.php?u=') && m.fb.includes(enc) && m.wa.startsWith('https://wa.me/?text=') && m.mail.startsWith('mailto:?subject=');
  for (const [v, co] of [[v1, 'nabídka sdílení: 4 položky, v okně, nalevo od tlačítka, fokus na první'], [v2, 'odkazy Facebook, WhatsApp, e-mail nesou adresu pohledu']]) {
    v ? ok++ : spatne++; console.log(v ? '✅' : '❌', co, v ? '' : JSON.stringify(m));
  }
  await p.keyboard.press('Escape'); await p.waitForTimeout(100);
  const esc = await p.evaluate(() => document.getElementById('shareMenu').hidden && document.activeElement?.id === 'share');
  await p.click('#share'); await p.mouse.click(300, 400); await p.waitForTimeout(100);
  const vedle = await p.evaluate(() => document.getElementById('shareMenu').hidden);
  const v3 = esc && vedle; v3 ? ok++ : spatne++; console.log(v3 ? '✅' : '❌', 'Esc (fokus zpět) a klik vedle nabídku zavřou', v3 ? '' : JSON.stringify({ esc, vedle }));
  await p.click('#cardClose').catch(() => {});
}
// rozložení karty: Sdílet nepřekrývá křížek ani nadpis, mezera ke křížku a odstup shora stejné (počítač i mobil)
for (const [w, h] of [[1200, 800], [390, 844]]) {
  await p.setViewportSize({ width: w, height: h }); await p.waitForTimeout(300);
  await p.evaluate((x) => window.__izo.showBuilding(x), budovy[2]); await p.waitForTimeout(300);
  const m = await p.evaluate(() => {
    const r = (id) => document.getElementById(id).getBoundingClientRect();
    const s = r('cardShare'), c = r('cardClose'), t = document.getElementById('cardTitle');
    const rng = document.createRange(); rng.selectNodeContents(t); const tx = [...rng.getClientRects()];
    const textPrava = Math.max(...tx.map((q) => q.right)), textHore = Math.min(...tx.map((q) => q.top)), textDole = Math.max(...tx.map((q) => q.bottom));
    const kc = document.getElementById('card'), k = kc.getBoundingClientRect(), ram = parseFloat(getComputedStyle(kc).borderRightWidth);
    return { mezera: +(c.left - s.right).toFixed(1), okraj: +(k.right - ram - c.right).toFixed(1), horniS: +s.top.toFixed(1), horniC: +c.top.toFixed(1), vyskaS: s.height, vyskaC: c.height,
             sirkaS: s.width, sirkaC: c.width, textDoSdilet: +(s.left - textPrava).toFixed(1), textPodTlacitky: textHore >= s.bottom || textDole <= s.top };
  });
  const v = m.mezera === m.okraj && m.horniS === m.horniC && m.vyskaS === m.vyskaC && m.sirkaS === m.sirkaC && (m.textDoSdilet >= 4 || m.textPodTlacitky);
  v ? ok++ : spatne++;
  console.log(v ? '✅' : '❌', `karta ${w} px ·`, JSON.stringify(m));
}
console.log(`\n${ok} v pořádku, ${spatne} špatně · chyby stránky: ${chyby.length ? chyby.join(' / ') : 'žádné'}`);
await b.close();
process.exit(spatne || chyby.length ? 1 : 0);
