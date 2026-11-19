// E-mail z Workeru přes Cloudflare Email Routing (binding EMAIL v wrangler.jsonc). Obecný blok, žádné názvy projektu:
// přenositelný do dalších projektů na paulhubiss.cz (Pavel 2026-11-19, společný základ).
// Adresát musí být ověřený v Email Routing → Destination addresses; odesílatel musí být na doméně se zapnutým Email Routing.

const b64 = (s) => { const b = new TextEncoder().encode(s); let t = ''; for (const x of b) t += String.fromCharCode(x); return btoa(t); };
const zalom = (s) => s.replace(/.{1,76}/g, '$&\r\n');
const kodHlavicky = (s) => `=?UTF-8?B?${b64(s)}?=`;
const cistaAdresa = (s) => String(s || '').replace(/[\r\n<>"]/g, '').trim();

// Vrátí surový e-mail (MIME) jako text. Čeština v předmětu, jménu i těle přežije (UTF-8, base64).
export function mime({ od, odJmeno, komu, odpovedet, predmet, text, domena = 'paulhubiss.cz' }) {
  const h = [
    `From: ${odJmeno ? kodHlavicky(odJmeno) + ' ' : ''}<${cistaAdresa(od)}>`,
    `To: <${cistaAdresa(komu)}>`,
  ];
  if (odpovedet) h.push(`Reply-To: <${cistaAdresa(odpovedet)}>`);
  h.push(
    `Subject: ${kodHlavicky(predmet)}`,
    `Message-ID: <${crypto.randomUUID()}@${domena}>`, `Date: ${new Date().toUTCString()}`,
    `MIME-Version: 1.0`, `Content-Type: text/plain; charset=UTF-8`, `Content-Transfer-Encoding: base64`,
  );
  return h.join('\r\n') + '\r\n\r\n' + zalom(b64(text));
}

// Pošle e-mail; bez bindingu EMAIL nebo adresáta tiše nic (např. lokální zkouška).
export async function posli(env, zprava) {
  if (!env.EMAIL || !zprava.komu) return false;
  const { EmailMessage } = await import('cloudflare:email');
  await env.EMAIL.send(new EmailMessage(zprava.od, zprava.komu, mime(zprava)));
  return true;
}

export const platnyEmail = (s) => /^[^\s@<>"]{1,64}@[^\s@<>"]{1,190}\.[a-z]{2,}$/i.test(String(s || ''));

export async function otisk(s) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(b)].slice(0, 12).map((x) => x.toString(16).padStart(2, '0')).join('');
}

// Ověření Turnstile (ochrana proti robotům). Bez tajného klíče projde (lokální zkouška), s klíčem musí sedět token.
export async function turnstile(tajemstvi, token, ip) {
  if (!tajemstvi) return true;
  if (!token) return false;
  const f = new FormData(); f.append('secret', tajemstvi); f.append('response', String(token)); if (ip) f.append('remoteip', ip);
  try { return !!(await (await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: f })).json()).success; }
  catch { return false; }
}
