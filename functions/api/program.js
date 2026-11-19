// Cloudflare Pages Function: aktuální program kulturního zařízení pro kartu místa (mista.json → "program": "<zdroj>").
// Prohlížeč si cizí stránku sám načíst nesmí (CORS), proto ji přečte tenhle prostředník, vytáhne akce a vrátí JSON.
// Jen zdroje ze seznamu ZDROJE (žádný otevřený prostředník na cokoli); odpověď je hodinu v mezipaměti pro všechny návštěvníky.
// Dotaz: /api/program?zdroj=dkhodonin → {"akce": [{"nazev", "od", "do", "url", "druh"}], "zdroj": "<stránka programu>"}
// od/do jsou místní čas bez časového pásma ("2026-11-19T18:00"), prohlížeč je bere jako místní.
export const UA = 'izomapa (program v karte mista na mape mesta)';   // hlavička HTTP smí mít jen ASCII, bez diakritiky
export const ZDROJE = {
  // Dům kultury Hodonín: seznam akcí je v HTML (<div class="event">…), strojový výstup nemá
  dkhodonin: { url: 'https://www.dkhodonin.eu/program', zaklad: 'https://www.dkhodonin.eu', cti: parseDkHodonin },
};

const ent = (s) => s.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n)).replace(/\s+/g, ' ').trim();
// „od 19. 11. 2026 v 18:00“ → "2026-11-19T18:00"
const datum = (s) => {
  const m = /(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})(?:\s*v\s*(\d{1,2}):(\d{2}))?/.exec(s || '');
  if (!m) return null;
  const p = (x) => String(x).padStart(2, '0');
  return `${m[3]}-${p(m[2])}-${p(m[1])}T${p(m[4] || 0)}:${p(m[5] || 0)}`;
};

export function parseDkHodonin(html, zaklad) {
  const akce = [];
  for (const kus of html.split('<div class="event"').slice(1)) {
    const odkaz = /<a href="([^"]+)"/.exec(kus), nazev = /class="event__heading">([\s\S]*?)<\/h3>/.exec(kus);
    const od = /class="event__date">([\s\S]*?)<\/div>/.exec(kus), doo = /class="event__time">([\s\S]*?)<\/div>/.exec(kus);
    const druh = /event__link--(?!no-ticket)([a-z-]+)/.exec(kus);
    if (!odkaz || !nazev || !od) continue;
    akce.push({ nazev: ent(nazev[1]), od: datum(od[1]), do: doo ? datum(doo[1]) : null, url: new URL(ent(odkaz[1]), zaklad).href, druh: druh ? druh[1] : null });
  }
  return akce.filter((a) => a.od);
}

export async function onRequest({ request }) {
  const z = ZDROJE[new URL(request.url).searchParams.get('zdroj')];
  const json = (o, status = 200, max = 3600) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': `public, max-age=${max}` } });
  if (!z) return json({ akce: [] }, 400, 0);
  const cache = caches.default, key = new Request(z.url + '#izomapa-program');
  let r = await cache.match(key);
  if (!r) {
    const up = await fetch(z.url, { headers: { 'user-agent': UA } });
    if (!up.ok) return json({ akce: [], zdroj: z.url }, 502, 0);
    r = json({ akce: z.cti(await up.text(), z.zaklad), zdroj: z.url });
    await cache.put(key, r.clone());
  }
  return r;
}
