// Pomocník pro zkoušky: menu B (web/nase.js) drží hledání, přepínače a seznamy v sekcích, které bývají zavřené.
// Před klikem na prvek uvnitř sekce ji otevře přes lištu, jako by to udělal člověk.
export async function sekce(p, sel) {
  const k = await p.evaluate((s) => document.querySelector(s)?.closest('.nb-pane')?.dataset.pane || null, sel);
  if (!k) return;                                           // prvek mimo sekce (nebo stránka bez naší vrstvy)
  const otevrena = await p.evaluate((k) => !document.body.classList.contains('nb-zavreno') && !document.getElementById('nb-' + k).hidden, k);
  if (!otevrena) { await p.click(`.nb-rail [data-tab="${k}"]`); await p.waitForTimeout(100); }
}
