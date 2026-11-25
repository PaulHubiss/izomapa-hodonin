// Cloudflare Pages Function: aktuální program kulturního zařízení pro kartu místa (mista.json → "program": "<zdroj>").
// Prohlížeč si cizí stránku sám načíst nesmí (CORS), proto ji přečte tenhle prostředník, vytáhne akce a vrátí JSON.
// Jen zdroje ze seznamu ZDROJE (žádný otevřený prostředník na cokoli); odpověď je hodinu v mezipaměti pro všechny návštěvníky.
// Dotaz: /api/program?zdroj=dkhodonin → {"akce": [{"nazev", "od", "do", "url", "druh"}], "zdroj": "<stránka programu>"}
// od/do jsou místní čas bez časového pásma ("2026-11-19T18:00"), prohlížeč je bere jako místní.
export const UA = 'izomapa (program v karte mista na mape mesta)';   // hlavička HTTP smí mít jen ASCII, bez diakritiky
export const ZDROJE = {
  // Dům kultury Hodonín: seznam akcí je v HTML (<div class="event">…), strojový výstup nemá
  dkhodonin: { url: 'https://www.dkhodonin.eu/program', zaklad: 'https://www.dkhodonin.eu', cti: parseDkHodonin },
  // Kino Svět (patří pod DK Hodonín, Pavel 2026-11-20): úvodní stránka má celý „Aktuální program“ po dnech (h4.movie-day
  // „20. 11. 2026 | pátek“, pod ním a.movie__link s časem „16:50 | Velký sál“ a názvem), strojový výstup nemá
  kinosvet: { url: 'https://www.kinosvet.eu/', zaklad: 'https://www.kinosvet.eu', cti: parseKinoSvet },
  // Vánoční jarmark (stránka akce DK Hodonín, Pavel 2026-11-25): program je souvislý text po dnech. Adresa platí pro rok 2026, na příští rok vyměnit.
  jarmark: { url: 'https://www.dkhodonin.eu/divadlo/1652-vanocni-jarmark', zaklad: 'https://www.dkhodonin.eu/divadlo/1652-vanocni-jarmark', cti: parseJarmark },
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

export function parseKinoSvet(html, zaklad) {
  const i = html.indexOf('Aktuální program');
  if (i < 0) return [];
  const akce = [], re = /class="movie-day[^"]*">\s*(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})|<a href="(\/program\/[^"]+)" class="movie__link">[\s\S]*?class="movie__time">\s*(\d{1,2}):(\d{2})[^<]*<[\s\S]*?class="movie__title-text">([\s\S]*?)<\/span>/g;
  const p = (x) => String(x).padStart(2, '0');
  const s = html.slice(i);
  let den = null, m;
  while ((m = re.exec(s))) {
    if (m[1]) { den = `${m[3]}-${p(m[2])}-${p(m[1])}`; continue; }
    if (!den) continue;
    akce.push({ nazev: ent(m[7]), od: `${den}T${p(m[5])}:${m[6]}`, do: null, url: new URL(m[4], zaklad).href, druh: 'film' });
  }
  return akce;
}

// Stránka jarmarku: <p><strong>ČT 3.12.</strong></p>, pod ním <p>16:30 Taneční studio…</p>. Rok je jen v záhlaví („od 29. 11. 2026“).
// Řádek bez času pod akcí (rozsvícení stromu „po příchodu průvodu“) se připíše k ní; podtitul dne nad první akcí a rozmezí dní
// („PO 21.12. - ÚT 22.12.“) se vynechávají: čas ani den se nedomýšlí, celý text je o klik dál na stránce DK. Konce vystoupení na webu nejsou (do = null).
const VYNECHAT = /^Setkání účastníků na pěší zóně/;         // sraz před průvodem, ne program na náměstí (Pavel 2026-11-25)
export function parseJarmark(html, zaklad) {
  const rok = /od\s+\d{1,2}\.\s*\d{1,2}\.\s*(\d{4})/.exec(html), akce = [], p2 = (x) => String(x).padStart(2, '0');
  if (!rok) return akce;
  let den = null, posl = null;
  for (const [, vnitrek] of html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)) {
    const t = ent(vnitrek.replace(/<[^>]+>/g, ' '));
    if (/^(PO|ÚT|ST|ČT|PÁ|SO|NE)\s+\d/.test(t)) {
      const d = /^\S+\s+(\d{1,2})\.\s*(\d{1,2})\.?$/.exec(t);
      den = d ? `${rok[1]}-${p2(d[2])}-${p2(d[1])}` : null; posl = null;
      continue;
    }
    if (!t) { den = null; continue; }                        // prázdný odstavec = konec dne
    const a = den && /^(\d{1,2}):(\d{2})\s+(.+)$/.exec(t);
    if (!a) { if (den && posl && !/^Pořadatel/.test(t)) posl.nazev += ` · ${t}`; continue; }
    if (VYNECHAT.test(a[3])) { posl = null; continue; }
    // „Easy line KONCERT“ → „Easy line (koncert)“: verzálky na konci jsou druh akce; „vánoční KONCERT“ je součást názvu
    const nazev = a[3].replace(/\s*[–-]?\s*(DĚTSKÉ DIVADLO)$/, (m, k) => ` (${k.toLowerCase()})`)
      .replace(/(\S+)\s+KONCERT$/, (m, w) => (w === 'vánoční' ? `${w} koncert` : `${w} (koncert)`))
      .replace(/ - /g, ' – ').replace(/“([^“”]*)”/g, '„$1“').trim();
    akce.push(posl = { nazev, od: `${den}T${p2(a[1])}:${a[2]}`, do: null, url: zaklad, druh: 'jarmark' });
  }
  return akce;
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
