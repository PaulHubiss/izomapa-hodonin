// Ověření webkamer z Windy.com: node nastroje-pavel/windy_kamery.mjs <id> [id …]
// Pro každou vypíše název podle jejich vkládacího přehrávače, čas posledního snímku a počet snímků za den.
// (Vyhledávače u kamer Windy občas uvádějí jiné místo, než kamera skutečně ukazuje – 2026-11-16 „Hodonín náměstí“ = Sudoměřice.)
for (const id of process.argv.slice(2)) {
  const r = await fetch(`https://webcams.windy.com/webcams/public/embed/player/${id}/day`).catch(() => null);
  if (!r || !r.ok) { console.log(id, 'nedostupná', r && r.status); continue; }
  const h = await r.text();
  const nazev = (h.match(/<title>Webcam player - ([^<]*)<\/title>/) || [])[1];
  const casy = (h.match(/times: \[([^\]]*)\]/) || [])[1];
  const t = casy ? casy.split(',').map((s) => s.replace(/'/g, '').trim()) : [];
  console.log(id, '·', nazev || '?', '· snímků', t.length, '· poslední', t[t.length - 1] || '–');
}
