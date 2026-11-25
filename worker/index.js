// Vstup Cloudflare Workeru pro mapu (Pavel + Claude 2026-11-19). Nahrazuje Cloudflare Pages.
// Proč vlastní soubor a ne autorův hlaseni/worker.js: autorův kód necháváme beze změny, ať jde slučovat jeho novinky.
//
//   /api/<jméno>     naše prostředníky z functions/api/<jméno>.js (stejné soubory jako na Pages a v nahled_server.py)
//   POST /api/report hlášení nepřesnosti → autorův kód (D1) + e-mail Pavlovi (textHlaseni níž)
//   POST /api/zprava formulář „Napište nám“ (worker/zprava.js)
//   /admin, /api/admin/*, /api/flights, /api/pluhy → autorův kód (heslo ADMIN_PASSWORD; před ním Cloudflare Access)
//   ostatní          statické soubory ze site/ (sem se Worker nedostane, podává je Cloudflare rovnou, viz run_worker_first)
//
// Přenositelné do dalších projektů na paulhubiss.cz: PROSTREDNICI + posta.js + zprava.js + předání zbytku aplikaci.
import autor from '../hlaseni/worker.js';
import { posli } from './posta.js';
import { prijmiZpravu } from './zprava.js';
import * as program from '../functions/api/program.js';
import * as vyluky from '../functions/api/vyluky.js';
import * as hasici from '../functions/api/hasici.js';

// Nový prostředník = soubor ve functions/api/ + řádek tady (Worker neumí načítat soubory podle jména za běhu).
// Že tu žádný nechybí, hlídá nastroje-pavel/test_worker.mjs.
export const PROSTREDNICI = { program, vyluky, hasici };

const KDE = 'https://hodonin.paulhubiss.cz';

export function textHlaseni(d, kde = KDE) {
  const mapa = d.lat && d.lon ? `${kde}/#leto@${(+d.lat).toFixed(5)},${(+d.lon).toFixed(5)},0.15` : kde;
  return [
    `Nové hlášení nepřesnosti na mapě Hodonína.`, ``,
    `Místo: ${d.title || d.target}`, `Text: ${String(d.note || '').trim().slice(0, 500)}`, ``,
    `Na mapě: ${mapa}`, `Administrace: ${kde}/admin`, ``,
    `(Poslal Worker hodonin-mapa, worker/index.js.)`,
  ].join('\n');
}

export default {
  async fetch(req, env, ctx) {
    const p = new URL(req.url).pathname;
    const m = p.match(/^\/api\/([a-z]+)$/);
    if (m && PROSTREDNICI[m[1]]) return PROSTREDNICI[m[1]].onRequest({ request: req, env, waitUntil: (x) => ctx.waitUntil(x) });
    if (p === '/api/zprava' && req.method === 'POST') return prijmiZpravu(req, env, ctx, KDE);

    if (p === '/api/report' && req.method === 'POST') {
      const kopie = req.clone();
      const odp = await autor.fetch(req, env, ctx);
      if (odp.ok) ctx.waitUntil(kopie.json().then((d) => posli(env, {
        od: env.HLASENI_OD || 'hlaseni@paulhubiss.cz', odJmeno: 'Izometrický Hodonín', komu: env.HLASENI_EMAIL,
        predmet: 'Hlášení: ' + String(d.title || d.target).slice(0, 60), text: textHlaseni(d),
      })).catch((e) => console.error('e-mail o hlášení:', e)));
      return odp;
    }
    return autor.fetch(req, env, ctx);
  },
};
