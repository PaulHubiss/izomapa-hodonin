// Bezpečnostní kontrola modelů od ChatGPT (cizí program, spouští se při renderu mapy):
//   node nastroje-pavel/chatgpt-modely/kontrola_kodu.mjs <soubor.js> […]
// Model smí používat jen M, K, Math, Number, Array, Object, JSON, String, Infinity, NaN, isFinite, parseFloat, parseInt
// a import z './_drobne.js'. Hlásí cokoli jiného: globální objekty prohlížeče a Node (window, document, fetch, globalThis,
// process, require, eval, Function, setTimeout…), jiné importy, dynamický import a přístup přes řetězce (['constructor']).
// Nenahrazuje čtení podezřelých modelů, ale z 17 souborů vybere ty, které číst je potřeba. Výstup: ✅ / ❌ na soubor.
import fs from 'node:fs';
// top, self, parent, frames bývají v modelech obyčejné proměnné (vršek střechy) → jen když se přes ně sahá na okno
const ZAKAZ = /\b(window|document|globalThis|(?:top|self|parent|frames)(?=\s*\.\s*(?:location|document|postMessage|fetch|open|eval))|fetch|XMLHttpRequest|WebSocket|navigator|location|localStorage|sessionStorage|indexedDB|caches|cookie|process|require|module|exports|Buffer|eval|Function|setTimeout|setInterval|requestAnimationFrame|queueMicrotask|Worker|postMessage|importScripts|Reflect|Proxy|Symbol|WebAssembly|atob|btoa|crypto)\b/g;
const PODEZRELE = /constructor|__proto__|prototype|\[\s*['"`][a-zA-Z_$]+['"`]\s*\]|\bimport\s*\(|\bnew\s+(?!Set|Map|Array)\w+/g;
let spatne = 0;
for (const f of process.argv.slice(2)) {
  // nejdřív řetězce (jinak by „//“ v adrese https:// uřízlo zbytek řádku jako komentář), obsah řetězců zvlášť, pak komentáře
  const kod = fs.readFileSync(f, 'utf8'), retezce = [];
  const bez = kod.replace(/(['"`])(?:\\.|(?!\1)[^\\\n])*\1/g, (s) => { retezce.push(s.slice(1, -1)); return '""'; }).replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g, '');
  const nalezy = [];
  for (const s of retezce) if (/constructor|__proto__|prototype|\beval\b|\bFunction\b|https?:|javascript:|<script/i.test(s)) nalezy.push(`řetězec „${s.slice(0, 30)}“`);
  // vlastní proměnná téhož jména (const window = {…okna…}) není okno prohlížeče
  const vlastni = new Set([...bez.matchAll(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g)].map((m) => m[1]));
  for (const m of bez.matchAll(ZAKAZ)) if (!vlastni.has(m[1])) nalezy.push(m[1]);
  for (const m of bez.matchAll(PODEZRELE)) nalezy.push(m[0]);
  for (const m of kod.matchAll(/^\s*import\s[^;]*from\s*['"]([^'"]+)['"]/gm)) if (m[1] !== './_drobne.js') nalezy.push(`import ${m[1]}`);
  if (!/export\s+default\s+(async\s+)?function|export\s+default\s*\(/.test(kod)) nalezy.push('chybí export default function');
  const radku = kod.split('\n').length, jm = f.split('/').pop();
  if (nalezy.length) { spatne++; console.log(`❌ ${jm} (${radku} ř.): ${[...new Set(nalezy)].join(', ')}`); }
  else console.log(`✅ ${jm} (${radku} ř.): jen M, K a matematika`);
}
process.exit(spatne ? 1 : 0);
