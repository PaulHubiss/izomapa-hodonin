// Zkouška Workeru (worker/*.js) bez sítě: node nastroje-pavel/test_worker.mjs
// 1. každý prostředník z functions/api/ je ve Workeru zapojený (flights a pluhy obsluhuje autorův kód),
// 2. e-mail je platný MIME a čeština v něm přežije cestu (posta.js),
// 3. formulář Napište nám: kontrola vstupu a text e-mailu (zprava.js).
import { readdirSync, readFileSync } from 'node:fs';
import { PROSTREDNICI, textHlaseni, povoleno } from '../worker/index.js';
import { odkaz } from '../functions/api/program.js';
import { mime, platnyEmail } from '../worker/posta.js';
import { zkontroluj, textEmailu } from '../worker/zprava.js';

let chyby = 0;
const ok = (c, t) => { console.log(`${c ? '✅' : '❌'} ${t}`); if (!c) chyby++; };

const soubory = readdirSync(new URL('../functions/api/', import.meta.url)).filter((f) => f.endsWith('.js')).map((f) => f.slice(0, -3));
for (const s of soubory.filter((s) => !['flights', 'pluhy'].includes(s))) ok(PROSTREDNICI[s]?.onRequest, `prostředník ${s} zapojený ve worker/index.js`);
for (const s of Object.keys(PROSTREDNICI)) ok(soubory.includes(s), `prostředník ${s} má soubor ve functions/api/`);

const rozloz = (m) => {
  const [hlav, telo] = m.split('\r\n\r\n');
  const dek = (s) => Buffer.from(s, 'base64').toString('utf8');
  return { hlav, telo, text: dek(telo.replace(/\r\n/g, '')), predmet: dek(hlav.match(/^Subject: =\?UTF-8\?B\?(.+)\?=$/m)[1]) };
};
const h = rozloz(mime({ od: 'hlaseni@paulhubiss.cz', odJmeno: 'Izometrický Hodonín', komu: 'x@example.com',
  predmet: 'Hlášení: Kostel sv. Vavřince', text: textHlaseni({ title: 'Kostel sv. Vavřince', note: 'Věž má být vyšší, žluťoučký kůň.', lat: 48.8487, lon: 17.1285 }) }));
ok(/^Message-ID: </m.test(h.hlav) && /^Date: /m.test(h.hlav) && !/^Reply-To/m.test(h.hlav), 'hlavičky e-mailu (bez Reply-To)');
ok(h.telo.split('\r\n').every((r) => r.length <= 76), 'tělo zalomené po 76 znacích');
ok(h.text.includes('žluťoučký kůň') && h.text.includes('#leto@48.84870,17.12850,0.15'), 'hlášení: čeština a odkaz na místo');
ok(h.predmet === 'Hlášení: Kostel sv. Vavřince', `předmět „${h.predmet}“`);

// formulář
ok(zkontroluj({ druh: 'xxx', text: 'ahoj světe' }).chyba, 'neznámý druh odmítnut');
ok(zkontroluj({ druh: 'jine', text: 'abc' }).chyba, 'příliš krátký text odmítnut');
ok(zkontroluj({ druh: 'jine', text: 'Dobrý den', email: 'nesmysl' }).chyba, 'špatný e-mail odmítnut');
ok(!platnyEmail('a@b.cz\r\nBcc: x@y.cz') && platnyEmail('pavel.novak@seznam.cz'), 'e-mail: vložení hlavičky neprojde, běžná adresa ano');
const { z } = zkontroluj({ druh: 'misto', text: '  U jezu je hezká vyhlídka.  ', jmeno: 'Jana', email: 'jana@example.cz', misto: 'Jez', lat: '48.85', lon: '17.13' });
ok(z && z.text === 'U jezu je hezká vyhlídka.' && z.lat === 48.85, 'platná zpráva očištěná');
const zp = rozloz(mime({ od: 'hlaseni@paulhubiss.cz', komu: 'x@example.com', odpovedet: z.email, predmet: 'Návrh místa: U jezu', text: textEmailu(z, 'https://hodonin.paulhubiss.cz') }));
ok(/^Reply-To: <jana@example.cz>$/m.test(zp.hlav), 'zpráva: Reply-To na odesílatele');
ok(zp.text.includes('Místo: Jez') && zp.text.includes('Od: Jana <jana@example.cz>') && zp.text.includes('#leto@48.85000,17.13000'), 'zpráva: místo, odesílatel, odkaz');
const bez = textEmailu(zkontroluj({ druh: 'jine', text: 'Pěkná mapa!' }).z, 'https://x');
ok(bez.includes('nevyplnil e-mail') && !bez.includes('Na mapě'), 'zpráva bez e-mailu a polohy');

// bezpečnostní průchod 2026-11-26: Worker pouští dál jen to, co mapa používá; vars v wrangler.jsonc musí sedět s mesto.json
const bezKom = (t) => { let o = '', s = false; for (let i = 0; i < t.length; i++) { const c = t[i];
  if (s) { o += c; if (c === '\\') o += t[++i]; else if (c === '"') s = false; continue; }
  if (c === '"') { s = true; o += c; continue; }
  if (c === '/' && t[i + 1] === '/') { while (i < t.length && t[i] !== '\n') i++; o += '\n'; continue; }
  o += c; } return o.replace(/,(\s*[}\]])/g, '$1'); };
const WR = JSON.parse(bezKom(readFileSync(new URL('../worker/wrangler.jsonc', import.meta.url), 'utf8'))).vars || {};
const MJ = JSON.parse(readFileSync(new URL('../mesto.json', import.meta.url), 'utf8'));
ok(JSON.stringify(WR.HASICI) === JSON.stringify(MJ.hasici), `wrangler vars HASICI = mesto.json hasici (${JSON.stringify(WR.HASICI)})`);
ok(WR.LETADLA === !!MJ.letadla && WR.PLUHY === !!MJ.pluhy, `wrangler vars LETADLA/PLUHY = mesto.json (${WR.LETADLA}/${WR.PLUHY})`);
const Q = (s) => new URLSearchParams(s);
ok(povoleno('/api/hasici', Q('kraj=116&okres=3706&dni=7'), WR) && !povoleno('/api/hasici', Q('kraj=116&okres=3706&dni=8'), WR)
  && !povoleno('/api/hasici', Q('kraj=1&okres=2&dni=7'), WR), 'hasiči: jen čísla z mesto.json');
ok(povoleno('/api/flights', Q(''), WR) === !!MJ.letadla && povoleno('/api/pluhy', Q(''), WR) === !!MJ.pluhy, 'letadla a sypače jen zapnuté');
ok(povoleno('/api/program', Q('zdroj=x'), WR) && povoleno('/api/report', Q(''), WR), 'ostatní cesty beze změny');
ok(odkaz('javascript:alert(1)', 'https://www.dkhodonin.eu') === 'https://www.dkhodonin.eu' && odkaz('/akce/1', 'https://www.dkhodonin.eu') === 'https://www.dkhodonin.eu/akce/1',
  'program: odkaz jen http(s)');

console.log(chyby ? `\n❌ ${chyby} chyb` : '\n✅ vše v pořádku');
process.exit(chyby ? 1 : 0);
