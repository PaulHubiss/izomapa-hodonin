// Kontrola přístupnosti mapy (WCAG 2.1 A/AA + best-practice) nástrojem axe-core – před spuštěním (Pavel 2026-11-18).
// Vzor Hnuti-Pro-web/web/scripts/kontrola-pristupnosti.mjs. Mapa je jedna stránka s mnoha stavy, proto se neprochází
// sitemapa, ale stavy: úvod, každá sekce menu, karta místa, Nápověda (všechny záložky) a stránka 404, na telefonu i počítači.
//   node nastroje-pavel/pristupnost.mjs            (běžící náhled na :8000; PROHLIZEC=webkit pro Safari)
// axe-core je ve Společných nástrojích (~/Claude/Spolecne-nastroje/node_modules/axe-core), vkládá se do stránky.
// ⚠️ Co NEměří: kontrast textu na skle nad mapou (axe nevidí, co je pod průhledným panelem – hlásí to jako „incomplete“),
// smysluplnost textů a ovládání klávesnicí v mapě. Zelená = „nic strojově zjistitelného“, ne „přístupné pro člověka“.
import os from 'node:os';
import path from 'node:path';
import { chromium, pripraveno } from './prohlizec.mjs';

const AXE = path.join(os.homedir(), 'Claude/Spolecne-nastroje/node_modules/axe-core/axe.min.js');
const SIRKY = [390, 1280];
const ZALOZKY = ['vzhled', 'vrstvy', 'mista', 'dnes', 'kamery', 'hledat'];
const nalezy = new Map();
const zmer = async (p, stav, sirka) => {
  await p.addScriptTag({ path: AXE });
  const v = await p.evaluate(async () => (await window.axe.run(document, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] },
    resultTypes: ['violations'] })).violations.map((x) => ({ id: x.id, impact: x.impact, help: x.help,
    uzly: x.nodes.map((n) => `${n.target.join(' ')}${n.any[0]?.message ? ` (${n.any[0].message.slice(0, 90)})` : ''}`) })));
  for (const x of v) {
    if (!nalezy.has(x.id)) nalezy.set(x.id, { ...x, uzly: new Set(), stavy: new Set() });
    const z = nalezy.get(x.id); x.uzly.forEach((u) => z.uzly.add(u)); z.stavy.add(`${stav}@${sirka}`);
  }
  console.log(v.length ? '⚠️' : '✅', String(sirka).padStart(4), stav.padEnd(22), v.map((x) => x.id).join(', '));
};

const b = await chromium.launch();
for (const sirka of SIRKY) {
  const ctx = await b.newContext({ viewport: { width: sirka, height: 860 }, isMobile: sirka < 700, hasTouch: sirka < 700 });
  const p = await ctx.newPage();
  await p.goto('http://localhost:8000/#leto@48.8487,17.1285,0.5', { waitUntil: 'load' }); await pripraveno(p, 1200);
  await zmer(p, 'úvod', sirka);
  for (const k of ZALOZKY) {
    const tl = p.locator(`.nb-rail [data-tab="${k}"]`);
    if (!(await tl.count()) || !(await tl.isVisible())) continue;
    if ((await tl.getAttribute('aria-pressed')) !== 'true') await tl.click();
    await p.waitForTimeout(400);
    await zmer(p, `menu ${k}`, sirka);
  }
  await p.keyboard.press('Escape');
  await p.evaluate(() => { const z = window.__izo; z.showPamatka(z.PAMATKY.find((q) => q.nazev.startsWith('Zámek'))); });
  await p.waitForTimeout(500); await zmer(p, 'karta místa', sirka);
  await p.evaluate(() => document.getElementById('cardClose')?.click());
  await p.evaluate(() => document.getElementById('helpDlg').showModal());
  for (const z of ['ovladani', 'vrstvy', 'projekt']) {
    await p.evaluate((z) => document.querySelector(`#helpDlg [data-zal="${z}"]`).click(), z); await p.waitForTimeout(200);
    await zmer(p, `nápověda ${z}`, sirka);
  }
  await p.goto('http://localhost:8000/404.html', { waitUntil: 'load' }); await zmer(p, 'stránka 404', sirka);
  await ctx.close();
}
await b.close();

if (!nalezy.size) { console.log('\nŽádné porušení WCAG 2.1 A/AA, které by šlo najít strojově.'); process.exit(0); }
const poradi = { critical: 0, serious: 1, moderate: 2, minor: 3 };
console.log(`\n═══ ${nalezy.size} porušených pravidel ═══`);
for (const z of [...nalezy.values()].sort((a, c) => (poradi[a.impact] ?? 9) - (poradi[c.impact] ?? 9))) {
  console.log(`\n[${(z.impact || '?').toUpperCase()}] ${z.id} — ${z.help}`);
  console.log(`  stavy: ${[...z.stavy].slice(0, 6).join(', ')}${z.stavy.size > 6 ? ' …' : ''} · prvků ${z.uzly.size}`);
  for (const u of [...z.uzly].slice(0, 6)) console.log(`   · ${u}`);
}
process.exit(1);
