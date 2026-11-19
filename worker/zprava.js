// Formulář „Napište nám“ (Pavel 2026-11-19): POST /api/zprava → kontrola, Turnstile, limit, uložení do D1 (tabulka
// zpravy, worker/sql/zpravy.sql) a e-mail Pavlovi s Reply-To na odesílatele, když vyplnil e-mail.
// Obecné kromě textů v CFG – do jiného projektu stačí změnit CFG.
import { posli, platnyEmail, otisk, turnstile } from './posta.js';

export const DRUHY = { misto: 'Návrh místa', napad: 'Nápad na mapu', chyba: 'Chyba v aplikaci', jine: 'Vzkaz' };
const LIMIT_ZA_HODINU = 5;

const json = (d, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });

// Ověří a očistí data z formuláře. Vrací { chyba } nebo { z } (zpráva připravená k uložení).
export function zkontroluj(d) {
  const druh = String(d.druh || '');
  if (!DRUHY[druh]) return { chyba: 'Vyberte prosím, o co jde.' };
  const text = String(d.text || '').trim().slice(0, 2000);
  if (text.length < 5) return { chyba: 'Napište prosím aspoň pár slov.' };
  const email = String(d.email || '').trim().slice(0, 200);
  if (email && !platnyEmail(email)) return { chyba: 'E-mail nevypadá správně. Můžete ho i vynechat.' };
  const lat = +d.lat, lon = +d.lon, maPolohu = Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;
  return { z: {
    druh, text, email: email || null,
    jmeno: String(d.jmeno || '').trim().slice(0, 80) || null,
    misto: String(d.misto || '').trim().slice(0, 120) || null,
    lat: maPolohu ? lat : null, lon: maPolohu ? lon : null,
  } };
}

export function textEmailu(z, kde) {
  const mapa = z.lat != null ? `${kde}/#leto@${z.lat.toFixed(5)},${z.lon.toFixed(5)},0.15` : null;
  return [
    `${DRUHY[z.druh]} z mapy Hodonína (formulář Napište nám).`, ``,
    z.text, ``,
    `Od: ${z.jmeno || '(bez jména)'}${z.email ? ` <${z.email}>` : ''}`,
    z.misto ? `Místo: ${z.misto}` : null,
    mapa ? `Na mapě: ${mapa}` : null,
    ``,
    z.email ? `Odpovědět jde rovnou tlačítkem Odpovědět.` : `Odesílatel nevyplnil e-mail, odpovědět nejde.`,
    `(Poslal Worker hodonin-mapa, worker/zprava.js.)`,
  ].filter((r) => r !== null).join('\n');
}

export async function prijmiZpravu(req, env, ctx, kde) {
  let d; try { d = await req.json(); } catch { return json({ ok: false, msg: 'Zprávu se nepodařilo přečíst.' }, 400); }
  const { chyba, z } = zkontroluj(d);
  if (chyba) return json({ ok: false, msg: chyba }, 400);
  const ip = req.headers.get('cf-connecting-ip') || '';
  if (!(await turnstile(env.ZPRAVA_TURNSTILE_SECRET, d.token, ip))) return json({ ok: false, msg: 'Ověření, že nejste robot, se nepovedlo. Zkuste to prosím znovu.' }, 403);
  const dev = await otisk(ip + '|zprava|' + (env.SALT || 'izo'));
  const n = await env.DB.prepare("SELECT COUNT(*) n FROM zpravy WHERE dev = ? AND created > datetime('now', '-1 hour')").bind(dev).first();
  if (n && n.n >= LIMIT_ZA_HODINU) return json({ ok: false, msg: 'Z tohoto zařízení přišlo za poslední hodinu už dost zpráv. Zkuste to prosím později.' }, 429);
  await env.DB.prepare('INSERT INTO zpravy (druh, text, jmeno, email, misto, lat, lon, dev) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(z.druh, z.text, z.jmeno, z.email, z.misto, z.lat, z.lon, dev).run();
  ctx.waitUntil(posli(env, {
    od: env.HLASENI_OD || 'hlaseni@paulhubiss.cz', odJmeno: 'Izometrický Hodonín', komu: env.HLASENI_EMAIL,
    odpovedet: z.email, predmet: `${DRUHY[z.druh]}: ${z.text.slice(0, 50).replace(/\s+/g, ' ')}${z.text.length > 50 ? '…' : ''}`,
    text: textEmailu(z, kde),
  }).catch((e) => console.error('e-mail se zprávou:', e)));
  return json({ ok: true });
}
