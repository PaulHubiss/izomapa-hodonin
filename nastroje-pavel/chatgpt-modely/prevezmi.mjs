// Převzetí modelů od ChatGPT: najde nejnovější ~/Downloads/<balik>-od-chatgpt*.zip (nebo zadaný soubor), rozbalí ho do
// predani/chatgpt/<balik>/od-chatgpt/ a pustí zkoušku z balíčku na každou stavbu.
//   node nastroje-pavel/chatgpt-modely/prevezmi.mjs <balik> [cesta.zip]        rozbalit a vyzkoušet (nic nepřepíše)
//   node nastroje-pavel/chatgpt-modely/prevezmi.mjs <balik> --pouzij[=a,b]     až po přečtení kódu: modely do pamatky/,
//        poznámky <slug>.md jako model.md do podkladů (staré se zálohují do balíčku), pak náhled a snímky do dashboardu
// Kód od ChatGPT je cizí program: před --pouzij ho Claude celý přečte (spouští se při renderu mapy).
import fs from 'node:fs'; import path from 'node:path'; import os from 'node:os'; import { spawnSync } from 'node:child_process';
import { ROOT, PODKLADY } from '../../pamatky/_spolecne.mjs';

const args = process.argv.slice(2), balik = args.find((a) => !a.startsWith('--') && !a.endsWith('.zip'));
const pouzijArg = args.find((a) => a.startsWith('--pouzij'));
if (!balik || !/^[a-z0-9-]{1,60}$/.test(balik)) { console.log('použití: prevezmi.mjs <balik> [soubor.zip] [--pouzij[=a,b]]'); process.exit(1); }
const BAL = path.join(ROOT, 'predani/chatgpt', balik), OD = path.join(BAL, 'od-chatgpt');
if (!fs.existsSync(path.join(BAL, 'zkouska.mjs'))) { console.log(`chybí balíček ${path.relative(ROOT, BAL)} – nejdřív zabal.mjs`); process.exit(1); }
const stavby = fs.readdirSync(path.join(BAL, 'stavby')).sort();
const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

if (!pouzijArg) {
  let zip = args.find((a) => a.endsWith('.zip'));
  if (!zip) {
    // Stažené soubory, nebo predani/chatgpt (zástupce na Google Disk, 2026-11-20: zip stažený na jiném Macu)
    const kand = [path.join(os.homedir(), 'Downloads'), path.join(ROOT, 'predani/chatgpt')].filter((d) => fs.existsSync(d))
      .flatMap((d) => fs.readdirSync(d).filter((f) => f.startsWith(balik + '-od-chatgpt') && f.endsWith('.zip')).map((f) => path.join(d, f)));
    kand.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
    zip = kand[0];
  }
  if (!zip || !fs.existsSync(zip)) { console.log(`❌ ve Stažených souborech není ${balik}-od-chatgpt*.zip`); process.exit(1); }
  fs.rmSync(OD, { recursive: true, force: true }); fs.mkdirSync(OD, { recursive: true });
  const r = spawnSync('unzip', ['-qo', '-j', zip, '-d', OD]);                        // -j: bez složek
  if (r.status !== 0) { console.log('❌ rozbalení selhalo', String(r.stderr)); process.exit(1); }
  console.log(`📦 ${zip} (${new Date(fs.statSync(zip).mtimeMs).toLocaleString('cs-CZ')}) → ${path.relative(ROOT, OD)}: ${fs.readdirSync(OD).join(', ')}\n`);
  for (const s of stavby) {
    const js = path.join(OD, `${s}.js`);
    if (!fs.existsSync(js)) { console.log(`❌ ${s}: v zipu chybí ${s}.js\n`); continue; }
    if (!fs.existsSync(path.join(OD, `${s}.md`))) console.log(`⚠️ ${s}: v zipu chybí poznámky ${s}.md`);
    fs.copyFileSync(js, path.join(BAL, `${s}.js`));                                  // zkouška chce model vedle _kit.js
    const z = spawnSync(process.execPath, ['zkouska.mjs', s], { cwd: BAL, encoding: 'utf8' });
    console.log(`=== ${s} ===\n${z.stdout}${z.stderr || ''}`);
    // varování ChatGPT, že model stojí na jiné budově (Kino Svět 2026-11-23 takhle prošlo nepovšimnuté): opravit oids dřív než --pouzij
    const pozn = fs.existsSync(path.join(OD, `${s}.md`)) ? fs.readFileSync(path.join(OD, `${s}.md`), 'utf8') : '';
    const par = pozn.split('\n').filter((l) => /PÁROVÁNÍ|párování|chybn[ýéě] |omylem|nesprávn|jiná budova/i.test(l) && !/^\*\*Kontrolní/.test(l));
    for (const l of par) console.log(`🧭 ${s}: ${l.slice(0, 400)}`);
    if (par.length) console.log('');
  }
  // bezpečnostní kontrola kódu (kontrola_kodu.mjs): jen M, K a matematika; ❌ = ten model přečíst celý
  const js = stavby.map((s) => path.join(OD, `${s}.js`)).filter((f) => fs.existsSync(f));
  const kk = spawnSync(process.execPath, [path.join(ROOT, 'nastroje-pavel/chatgpt-modely/kontrola_kodu.mjs'), ...js], { encoding: 'utf8' });
  console.log(`=== bezpečnost kódu ===\n${kk.stdout}`);
  console.log(`Další krok: ${kk.status ? 'přečíst modely s ❌ celé, ' : ''}přečíst modely s varováním zkoušky, pak prevezmi.mjs ${balik} --pouzij`);
  process.exit(0);
}

const vyber = pouzijArg.includes('=') ? pouzijArg.split('=')[1].split(',') : stavby.filter((s) => fs.existsSync(path.join(OD, `${s}.js`)));
const hotove = [];
for (const s of vyber) {
  const js = path.join(OD, `${s}.js`), cil = path.join(ROOT, `pamatky/${s}.js`), pod = path.join(PODKLADY, s);
  if (!fs.existsSync(js)) { console.log(`❌ ${s}: chybí ${path.relative(ROOT, js)}`); continue; }
  fs.mkdirSync(path.join(BAL, 'zalohy'), { recursive: true }); fs.mkdirSync(pod, { recursive: true });
  if (fs.existsSync(cil)) fs.copyFileSync(cil, path.join(BAL, 'zalohy', `${s}.pred-${ts}.js`));
  fs.copyFileSync(js, cil);
  const md = path.join(OD, `${s}.md`);
  if (fs.existsSync(md)) {
    if (fs.existsSync(path.join(pod, 'model.md'))) fs.copyFileSync(path.join(pod, 'model.md'), path.join(BAL, 'zalohy', `${s}.model.pred-${ts}.md`));
    fs.copyFileSync(md, path.join(pod, 'model.md'));
  }
  const n = spawnSync(process.execPath, [path.join(ROOT, 'pamatky/nahled.mjs'), s], { cwd: ROOT, encoding: 'utf8' });
  console.log(`✅ ${s}: převzat → ${n.stdout.trim().split('\n')[0]}`);
  for (const l of n.stdout.split('\n').filter((q) => q.includes('!'))) console.log('   ' + l);
  hotove.push(s);
}
if (hotove.length) {
  const p = spawnSync(process.execPath, [path.join(ROOT, 'pamatky/pred_po.mjs'), ...hotove], { cwd: ROOT, encoding: 'utf8' });
  console.log(p.stdout.trim().split('\n').pop());
  console.log(`Dashboard: http://127.0.0.1:8792 (npm run pamatky). Zálohy: ${path.relative(ROOT, path.join(BAL, 'zalohy'))}`);
}
