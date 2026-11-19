// Výška sekcí panelu (obsah, ne okno): node nastroje-pavel/vyska_panelu.mjs [šířka×výška]
// Pro každou záložku: výška obsahu sekce v px a výška jednoho řádku seznamu/přepínače. Na srovnání před a po úpravě.
import { chromium } from 'playwright';
const [w, h] = (process.argv[2] || '1440x900').split('x').map(Number);
const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: w, height: h } })).newPage();
await p.goto('http://localhost:8000/#leto', { waitUntil: 'load' }); await p.waitForTimeout(5000);
for (const k of ['vzhled', 'vrstvy', 'mista', 'dnes', 'kamery']) {
  const tab = p.locator(`#nbRail [data-tab="${k}"]`); if (!(await tab.isVisible())) continue;
  if (!((await tab.getAttribute('class')) || '').includes('on')) await tab.click();
  await p.waitForTimeout(300);
  console.log(k.padEnd(7), JSON.stringify(await p.evaluate((k) => {
    const s = document.getElementById('nb-' + k), r = s.getBoundingClientRect();
    const radek = s.querySelector('.nb-layers label, .places li, .ver-sk > summary');
    const otevrene = [...s.querySelectorAll('details')].filter((d) => d.open).map((d) => d.querySelector('summary').textContent.trim());
    return { vyska: Math.round(r.height), radek: radek ? Math.round(radek.getBoundingClientRect().height) : null, otevrene };
  }, k)));
}
await b.close();
