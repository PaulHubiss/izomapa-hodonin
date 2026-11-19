// Cloudflare Pages Functions (functions/api/<jméno>.js) pro lokální náhled: node nastroje-pavel/api_lokalne.mjs <jméno> [dotaz]
// Spustí stejnou funkci onRequest jako Cloudflare (mezipaměť caches.default je tu prázdná, drží ji nahled_server.py)
// a tělo odpovědi vypíše na výstup; návratový kód 0 = odpověď 200. Volá ho nastroje-pavel/nahled_server.py pro /api/…
const [jmeno, dotaz = ''] = process.argv.slice(2);
if (!/^[a-z]+$/.test(jmeno || '')) process.exit(2);
globalThis.caches = { default: { match: async () => null, put: async () => {} } };
const { onRequest } = await import(`../functions/api/${jmeno}.js`);
const r = await onRequest({ request: new Request(`http://localhost/api/${jmeno}?${dotaz}`) });
process.stdout.write(await r.text());
process.exit(r.status === 200 ? 0 : 1);
