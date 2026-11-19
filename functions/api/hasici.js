// Cloudflare Pages Function: výjezdy hasičů za posledních N dní z veřejného přehledu HZS Jihomoravského kraje.
// ⚠️ Od 2026-11-16 jen ZÁLOHA: mapa se ptá HZS přímo z prohlížeče (web/hasici_data.js), protože spojení z Cloudflaru
// k udalosti.firebrno.cz nenaváže (502 po 20 s). Lokálně (nastroje-pavel/api_lokalne.mjs) funguje.
// Dotaz: /api/hasici?kraj=116&okres=3706&dni=7 (čísla z mesto.json "hasici") → {"udalosti": [{id, cas, typ, stav, probiha,
// obec, ulice, popis, lat, lon}], "zdroj"}; poloha převedená z S-JTSK do WGS84. Mezipaměť 60 s (jejich mapa se obnovuje po minutě).
import { dotaz, preved, jtsk2wgs, ZDROJ } from '../../web/hasici_data.js';
export { jtsk2wgs, preved };
export const UA = 'izomapa (vyjezdy hasicu na mape mesta)';   // hlavička HTTP smí mít jen ASCII

export async function onRequest({ request }) {
  const q = new URL(request.url).searchParams, cele = (k, max) => { const v = Number.parseInt(q.get(k), 10); return Number.isInteger(v) && v > 0 && v <= max ? v : null; };
  const kraj = cele('kraj', 9999), okres = cele('okres', 99999), dni = cele('dni', 31) || 7;
  const json = (o, status = 200, max = 60) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': `public, max-age=${max}` } });
  if (!kraj) return json({ udalosti: [] }, 400, 0);
  const cache = caches.default, key = new Request(`https://udalosti.firebrno.cz/api/?izomapa=${kraj}-${okres}-${dni}`);
  let r = await cache.match(key);
  if (!r) {
    const up = await fetch(dotaz(kraj, okres, dni), { headers: { 'user-agent': UA, accept: 'application/json' }, signal: AbortSignal.timeout(8000) }).catch(() => null);
    if (!up || !up.ok) return json({ udalosti: [] }, 502, 0);
    r = json({ udalosti: preved(await up.json()), zdroj: ZDROJ });
    await cache.put(key, r.clone());
  }
  return r;
}
