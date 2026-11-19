// Výjezdy hasičů z veřejného přehledu HZS Jihomoravského kraje (udalosti.firebrno.cz, stejná data jako jejich mapa).
// Sdílený modul (jeden zdroj, žádné kopie): načítá ho prohlížeč (web/app.html, přímo z mapy) i prostředník
// functions/api/hasici.js (záloha a lokální náhled přes nastroje-pavel/api_lokalne.mjs).
// Proč prohlížeč přímo (2026-11-16): HZS posílá Access-Control-Allow-Origin: *, ale spojení z Cloudflaru k nim
// nenaváže (502 po 20 s, nejspíš blokují adresy datacenter); z prohlížeče návštěvníka odpověď do 0,1 s.
export const API = 'https://udalosti.firebrno.cz/api/';
export const ZDROJ = 'https://udalosti.firebrno.cz/';
// číselník https://udalosti.firebrno.cz/api/typy (2026-11-15)
export const TYPY = { 3100: 'Požár', 3200: 'Dopravní nehoda', 3400: 'Únik nebezpečných látek', 3500: 'Technická pomoc', 3550: 'Záchrana osob a zvířat',
  3700: 'Jiná událost', 3800: 'Planý poplach', 3900: 'Technologický test', 3600: 'Formálně založená událost', 6000: 'Pohotovost', 5000: 'Událost na objekt' };
const SKRYT = new Set([3600, 3900, 6000]);                 // formální, testy, pohotovost: na mapě nic nedělají
// stavy https://udalosti.firebrno.cz/api/stavy: probíhající = převzatá až likvidovaná, ostatní z výběru „všechny“ jsou ukončené
const PROBIHA = [210, 400, 410, 420, 430, 440];
const UKONCENO = [500, 510, 520, 600, 610, 620, 700, 710, 750, 760, 780, 800];

// adresa dotazu na výjezdy za posledních `dni` dní v kraji (a okrese)
export function dotaz(kraj, okres, dni = 7) {
  const u = new URL(API);
  u.searchParams.set('casOd', new Date(Date.now() - dni * 86400e3).toISOString()); u.searchParams.set('casDo', new Date(Date.now() + 3600e3).toISOString());
  u.searchParams.set('krajId', kraj); if (okres) u.searchParams.set('okresId', okres);
  for (const s of [...PROBIHA, ...UKONCENO]) u.searchParams.append('stavIds', s);
  return u;
}

// S-JTSK (Křovák, kladné X k jihu a Y k západu, jak je posílá HZS) → WGS84 [lat, lon]; Besselův elipsoid, posun a otočení
// sedmi parametry do WGS84, přesnost kolem 1 m (ověřeno proti pyproj)
export function jtsk2wgs(X, Y, H = 200) {
  const e = 0.081696831215303, n = 0.97992470462083, konst = 12310230.12797036, sinUQ = 0.863499969506341, cosUQ = 0.504348889819882;
  const sinVQ = 0.420215144586493, cosVQ = 0.907424504992097, alfa = 1.000597498371542, k = 1.003419163966575;
  const ro = Math.hypot(X, Y), eps = 2 * Math.atan(Y / (ro + X)), D = eps / n, S = 2 * Math.atan(Math.exp(Math.log(konst / ro) / n)) - Math.PI / 2;
  const sinS = Math.sin(S), cosS = Math.cos(S), sinU = sinUQ * sinS - cosUQ * cosS * Math.cos(D), cosU = Math.sqrt(1 - sinU * sinU);
  const sinDV = Math.sin(D) * cosS / cosU, cosDV = Math.sqrt(1 - sinDV * sinDV);
  const sinV = sinVQ * cosDV - cosVQ * sinDV, cosV = cosVQ * cosDV + sinVQ * sinDV, L0 = 2 * Math.atan(sinV / (1 + cosV)) / alfa;
  const t0 = Math.exp(2 / alfa * Math.log((1 + sinU) / cosU / k));
  let pom = (t0 - 1) / (t0 + 1), sinB;
  do { sinB = pom; pom = t0 * Math.exp(e * Math.log((1 + e * sinB) / (1 - e * sinB))); pom = (pom - 1) / (pom + 1); } while (Math.abs(pom - sinB) > 1e-15);
  const B0 = Math.atan(pom / Math.sqrt(1 - pom * pom));
  const a = 6377397.15508, e2 = 1 - (1 - 1 / 299.152812853) ** 2, N = a / Math.sqrt(1 - e2 * Math.sin(B0) ** 2);
  const x = (N + H) * Math.cos(B0) * Math.cos(L0), y = (N + H) * Math.cos(B0) * Math.sin(L0), z = ((1 - e2) * N + H) * Math.sin(B0);
  const r = Math.PI / 180 / 3600, wx = -4.99821 * r, wy = -1.58676 * r, wz = -5.2611 * r, m = 3.543e-6;
  const xn = 570.69 + (1 + m) * (x + wz * y - wy * z), yn = 85.69 + (1 + m) * (-wz * x + y + wx * z), zn = 462.84 + (1 + m) * (wy * x - wx * y + z);
  const a2 = 6378137, f2 = 298.257223563, ab = f2 / (f2 - 1), p = Math.hypot(xn, yn), e22 = 1 - (1 - 1 / f2) ** 2;
  const th = Math.atan(zn * ab / p), st = Math.sin(th), ct = Math.cos(th);
  const B = Math.atan((zn + e22 * ab * a2 * st ** 3) / (p - e22 * a2 * ct ** 3)), L = 2 * Math.atan(yn / (p + xn));
  return [B * 180 / Math.PI, L * 180 / Math.PI];
}

// odpověď HZS → [{id, cas, typ, typId, probiha, obec, ulice, popis, lat, lon}]
export function preved(data) {
  return (data || []).filter((u) => !SKRYT.has(u.typId) && u.gis1 && u.gis2).map((u) => {
    const [lat, lon] = jtsk2wgs(+u.gis2, +u.gis1);
    return { id: u.id, cas: u.casOhlaseni, typ: TYPY[u.typId] || 'Událost', typId: u.typId, probiha: PROBIHA.includes(u.stavId),
             obec: u.obec || null, ulice: u.ulice || null, popis: (u.poznamkaProMedia || '').trim() || null, lat: +lat.toFixed(6), lon: +lon.toFixed(6) };
  });
}
