// Převzetí víc balíků od ChatGPT za sebou (po jednom, ať se snímky do dashboardu neperou o paměť):
//   node nastroje-pavel/chatgpt-modely/prevezmi_davky.mjs <balik> <balik> … [--pouzij]
// Pro každý balík pustí prevezmi.mjs se stejnými volbami a na konci vypíše, které skončily chybou.
import { spawnSync } from 'node:child_process';
import path from 'node:path';
const args = process.argv.slice(2), volby = args.filter((a) => a.startsWith('--')), baliky = args.filter((a) => !a.startsWith('--'));
const skript = path.join(path.dirname(new URL(import.meta.url).pathname), 'prevezmi.mjs'), chyby = [];
for (const b of baliky) {
  console.log(`\n████ ${b} ████`);
  const r = spawnSync(process.execPath, [skript, b, ...volby], { stdio: 'inherit' });
  if (r.status !== 0) chyby.push(b);
}
console.log(chyby.length ? `\n❌ chyba u: ${chyby.join(', ')}` : `\n✅ všech ${baliky.length} balíků v pořádku`);
process.exit(chyby.length ? 1 : 0);
