// Všechny zkoušky mapy ve všech enginech (Pavel 2026-11-17: „musíme to mít otestované pro všechny typy prohlížečů“):
// node nastroje-pavel/zkousky.mjs [chromium webkit firefox] [--jen test_chodci,test_start]
// Chromium = Chrome, Edge, Opera · WebKit = Safari (Pavlův prohlížeč, i iPhone) · Firefox. Každá zkouška se pustí
// s PROHLIZEC=<engine> (nastroje-pavel/prohlizec.mjs); na konci tabulka ✅/❌ a u neúspěšných posledních pár řádků výpisu.
// Potřebuje běžící náhled na :8000. Instalace WebKitu a Firefoxu: sh nastroje-pavel/instaluj-webkit.sh
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
const DIR = path.dirname(new URL(import.meta.url).pathname);
const args = process.argv.slice(2);
const ji = args.indexOf('--jen'), jen = ji >= 0 ? args[ji + 1].split(',') : null;
const enginy = args.filter((a, i) => !a.startsWith('--') && (ji < 0 || i !== ji + 1));
const ENGINY = enginy.length ? enginy : ['chromium', 'webkit', 'firefox'];
// test_live_mhd jen vypisuje (živý proud, výsledek se mění), test_zoom měří a trvá dlouho → zvlášť, ne v souhrnu
const ZKOUSKY = fs.readdirSync(DIR).filter((f) => /^test_.*\.mjs$/.test(f) && !['test_live_mhd.mjs', 'test_zoom.mjs'].includes(f))
  .map((f) => f.replace(/\.mjs$/, '')).filter((f) => !jen || jen.includes(f)).sort();
const vysledky = {};
for (const e of ENGINY) for (const z of ZKOUSKY) {
  process.stdout.write(`${e.padEnd(9)} ${z.padEnd(22)} `);
  const t0 = Date.now();
  const r = spawnSync('node', [path.join(DIR, `${z}.mjs`)], { env: { ...process.env, PROHLIZEC: e }, encoding: 'utf8', timeout: 6 * 60e3 });
  const vystup = (r.stdout || '') + (r.stderr || ''), ok = r.status === 0;
  const souhrn = (vystup.match(/(\d+) v pořádku, (\d+) špatně/) || []).slice(1).join('/');
  (vysledky[z] ||= {})[e] = ok ? '✅' : '❌';
  console.log(`${ok ? '✅' : '❌'} ${souhrn ? souhrn + ' ' : ''}(${Math.round((Date.now() - t0) / 1000)} s)`);
  if (!ok) console.log(vystup.split('\n').filter((l) => /❌|Error|error/.test(l)).slice(0, 6).map((l) => '      ' + l.slice(0, 220)).join('\n'));
}
console.log(`\n${'zkouška'.padEnd(22)} ${ENGINY.map((e) => e.padEnd(9)).join(' ')}`);
for (const z of ZKOUSKY) console.log(`${z.padEnd(22)} ${ENGINY.map((e) => (vysledky[z][e] || '–').padEnd(8)).join(' ')}`);
const spatne = Object.values(vysledky).flatMap((v) => Object.values(v)).filter((v) => v === '❌').length;
console.log(spatne ? `\n❌ ${spatne} neprošlo` : '\n✅ vše prošlo ve všech enginech');
process.exit(spatne ? 1 : 0);
