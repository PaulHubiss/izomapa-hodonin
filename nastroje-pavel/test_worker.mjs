// Zkouška Workeru (worker/*.js) bez sítě: node nastroje-pavel/test_worker.mjs
// 1. každý prostředník z functions/api/ je ve Workeru zapojený (flights obsluhuje autorův kód),
// 2. e-mail je platný MIME a čeština v něm přežije cestu (posta.js),
// 3. formulář Napište nám: kontrola vstupu a text e-mailu (zprava.js).
import { readdirSync } from 'node:fs';
import { PROSTREDNICI, textHlaseni } from '../worker/index.js';
import { mime, platnyEmail } from '../worker/posta.js';
import { zkontroluj, textEmailu } from '../worker/zprava.js';

let chyby = 0;
const ok = (c, t) => { console.log(`${c ? '✅' : '❌'} ${t}`); if (!c) chyby++; };

const soubory = readdirSync(new URL('../functions/api/', import.meta.url)).filter((f) => f.endsWith('.js')).map((f) => f.slice(0, -3));
for (const s of soubory.filter((s) => s !== 'flights')) ok(PROSTREDNICI[s]?.onRequest, `prostředník ${s} zapojený ve worker/index.js`);
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

console.log(chyby ? `\n❌ ${chyby} chyb` : '\n✅ vše v pořádku');
process.exit(chyby ? 1 : 0);
