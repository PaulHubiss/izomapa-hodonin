// Zabalí všechny dávky výběru najednou (2026-11-27): jedna dávka = jeden balík davka-RRRR-MM-DD-<písmeno>.
//   node nastroje-pavel/chatgpt-modely/zabal_vyber.mjs nastroje-pavel/chatgpt-modely/vybery/11.json [--datum=2026-11-27] [--jen=a,b] [--jeden]
// --jeden = všechny dávky do jednoho balíku davka-RRRR-MM-DD-vse (zadání: po skupinách, průběžný zip po každé)
// Stavby najde podle názvu a skupiny v pamatky/<slug>.json (zapsal je vyber.py --zapis). Na konci ukáže složku ve Finderu.
import fs from 'node:fs'; import path from 'node:path'; import { spawnSync } from 'node:child_process';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const args = process.argv.slice(2), opt = Object.fromEntries(args.filter((a) => a.startsWith('--')).map((a) => a.slice(2).split('=')));
const V = JSON.parse(fs.readFileSync(path.resolve(args.find((a) => !a.startsWith('--'))), 'utf8'));
const datum = opt.datum || new Date().toISOString().slice(0, 10), jen = opt.jen ? opt.jen.split(',') : null;
const slugy = {};
for (const f of fs.readdirSync(path.join(ROOT, 'pamatky')).filter((f) => f.endsWith('.json'))) {
  let d; try { d = JSON.parse(fs.readFileSync(path.join(ROOT, 'pamatky', f), 'utf8')); } catch { continue; }
  if (d && d.skupina === V.skupina && d.nazev) slugy[d.nazev] = f.slice(0, -5);
}
let chyba = false;
if ('jeden' in opt) {                                   // všechno do jednoho balíku (Pavel 2026-11-27: „nemám čas dělat 11 chatů“)
  const s = [], skupiny = [];
  for (const [dv, stavby] of Object.entries(V.davky)) {
    if (jen && !jen.includes(dv)) continue;
    const ss = Object.keys(stavby).map((n) => slugy[n] || (console.log(`❌ ${dv}: „${n}“ nemá pamatky/<slug>.json`), chyba = true, null)).filter(Boolean);
    s.push(...ss); skupiny.push(`${dv}) ${ss.join(', ')}`);
  }
  const nazev = `davka-${datum}-vse`;
  const r = spawnSync(process.execPath, [path.join(ROOT, 'nastroje-pavel/chatgpt-modely/zabal.mjs'), ...s, `--nazev=${nazev}`, '--bez-finderu'], { cwd: ROOT, encoding: 'utf8' });
  console.log(`${r.status === 0 ? '✅' : '❌'} ${s.length} staveb v jednom balíku ${nazev}`);
  if (r.status !== 0) { console.log((r.stdout + r.stderr).trim().split('\n').slice(-8).join('\n')); process.exit(1); }
  // velký balík: po skupinách a průběžný zip, ať se při přerušení chatu neztratí hotová práce
  const zf = path.join(ROOT, 'predani/chatgpt', `${nazev}-zadani.txt`);
  fs.appendFileSync(zf, `\n\nJe to ${s.length} staveb, proto postupuj po skupinách v tomto pořadí:\n${skupiny.join('\n')}\n` +
    `Po každé dokončené skupině mi dej průběžný zip ${nazev}-od-chatgpt.zip se VŠEMI dosud hotovými stavbami (ať se při přerušení nic neztratí) ` +
    `a pokračuj další skupinou bez čekání na mě. U každé stavby dodrž celý postup ze ZADANI.md včetně oprav, i u posledních skupin.\n`);
  spawnSync('open', ['-R', path.join(ROOT, 'predani/chatgpt', `${nazev}.zip`)]);
  process.exit(chyba ? 1 : 0);
}
for (const [dv, stavby] of Object.entries(V.davky)) {
  if (jen && !jen.includes(dv)) continue;
  const s = Object.keys(stavby).map((n) => slugy[n] || (console.log(`❌ ${dv}: „${n}“ nemá pamatky/<slug>.json – nejdřív vyber.py --zapis`), chyba = true, null)).filter(Boolean);
  if (!s.length) continue;
  const r = spawnSync(process.execPath, [path.join(ROOT, 'nastroje-pavel/chatgpt-modely/zabal.mjs'), ...s, `--nazev=davka-${datum}-${dv}`, '--bez-finderu'], { cwd: ROOT, encoding: 'utf8' });
  const out = (r.stdout + r.stderr).trim().split('\n');
  console.log(`${r.status === 0 ? '✅' : '❌'} ${dv}: ${s.length} staveb · ${out.at(-1)}`);
  if (r.status !== 0) { chyba = true; console.log(out.slice(-8).join('\n')); }
}
spawnSync('open', [path.join(ROOT, 'predani/chatgpt')]);
process.exit(chyba ? 1 : 0);
