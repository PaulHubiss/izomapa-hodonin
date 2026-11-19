// Cloudflare Pages Function: probíhající a chystané výluky IDS JMK pro jednu oblast (mesto.json "vyluky": {"oblast": "Hodonínsko"}).
// Zdroj je rozhraní webu idsjmk.cz (/api/web/lockout, stejná data jako jejich stránka Výluky). Výluky nemají polohu,
// jen čísla linek, oblast a termín; které se týkají mapy, rozhodne prohlížeč podle linek, které po mapě jezdí.
// Dotaz: /api/vyluky?oblast=Hodonínsko → {"vyluky": [{id, nazev, od, do, probiha, linky, url}], "zdroj"}; mezipaměť 10 min.
export const UA = 'izomapa (vyluky na mape mesta)';        // hlavička HTTP smí mít jen ASCII
const API = 'https://www.idsjmk.cz/api/web/lockout';

export function preved(data, oblast) {
  const ted = Date.now(), out = [];
  for (const v of [...(data.current || []), ...(data.future || [])]) {
    if (v.isCancelled || !(v.lockoutFilterAreas || []).includes(oblast)) continue;
    const doo = v.dateTo && !v.dateTo.startsWith('9999') ? v.dateTo : null;
    if (doo && new Date(doo).getTime() < ted) continue;
    // linky: z výčtu u výluky (bývá prázdný), jinak čísla linek z nadpisu („Výluka na lince S91…“, „linky 664 a 912“)
    // linka ve výčtu má vlastní platnost: stará oznámení bez konce („Předčasné ukončení výluky…“ z 2025) ji mají dávno prošlou
    const linky = new Set((v.lockoutLinks || []).filter((l) => !l.validTo || new Date(l.validTo).getTime() >= ted)
      .map((l) => String(l.fullLinkName || '').trim()).filter(Boolean));
    const nazev = (v.title && (v.title.cs || v.title.en)) || '';
    for (const m of nazev.matchAll(/\b(?:linky?|linkách|lince)\s+([A-Z]?\d{1,3}(?:\s*(?:,|a|a\s+)\s*[A-Z]?\d{1,3})*)/gi)) for (const c of m[1].split(/\s*(?:,|\sa\s)\s*/)) linky.add(c.trim());
    for (const m of nazev.matchAll(/\b([SR]\d{1,3})\b/g)) linky.add(m[1]);
    out.push({ id: v.id, nazev: nazev.replace(/^(Aktualizace|Změna):\s*/i, '').trim(), od: v.dateFrom, do: doo, probiha: v.type === 'CURRENT',
               linky: [...linky], url: `https://www.idsjmk.cz/lockouts/detail/${v.id}` });
  }
  return out.sort((a, b) => (b.probiha - a.probiha) || new Date(a.od) - new Date(b.od));
}

export async function onRequest({ request }) {
  const oblast = (new URL(request.url).searchParams.get('oblast') || '').slice(0, 60);
  const json = (o, status = 200, max = 600) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': `public, max-age=${max}` } });
  if (!oblast) return json({ vyluky: [] }, 400, 0);
  const cache = caches.default, key = new Request(`${API}?izomapa=${encodeURIComponent(oblast)}`);
  let r = await cache.match(key);
  if (!r) {
    const up = await fetch(API, { headers: { 'user-agent': UA, accept: 'application/json' } });
    if (!up.ok) return json({ vyluky: [] }, 502, 0);
    r = json({ vyluky: preved(await up.json(), oblast), zdroj: 'https://www.idsjmk.cz/lockouts/all/current' });
    await cache.put(key, r.clone());
  }
  return r;
}
