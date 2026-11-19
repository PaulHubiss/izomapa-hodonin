// Naběhne Firefox pro zkoušky? node nastroje-pavel/zkus_firefox.mjs   (běžící náhled na :8000)
// Zkoušky jedou v BĚŽNÉM Firefoxu z /Applications přes playwright-core ze Společných nástrojů (kanál moz-firefox),
// viz prohlizec.mjs. Na novém Macu: brew install --cask firefox, pak JEDNOU open -a Firefox a zavřít (jinak si nezaloží
// profil a Playwright hlásí „Could not find profile folder“ – zjištěno na M2 2026-11-17). Upravené buildy Firefoxu
// z Playwrightu (142, 159) na macOS 27 nenaběhnou vůbec.
import os from 'node:os';
const { firefox } = await import(`${os.homedir()}/Claude/Spolecne-nastroje/node_modules/playwright-core/index.mjs`);
try {
  const b = await firefox.launch({ channel: 'moz-firefox' });
  const p = await b.newPage();
  await p.goto('http://localhost:8000/?ff', { waitUntil: 'load' });
  console.log('✅ Firefox naběhl:', await p.title(), '· verze', b.version());
  await b.close();
} catch (e) {
  console.log('❌ Firefox nenaběhl:', (String(e.message).match(/\[err\][^\n]*/g) || [String(e.message).slice(0, 300)]).slice(0, 4).join(' | '));
  console.log('   Je nainstalovaný (brew install --cask firefox) a jednou spuštěný normálně (open -a Firefox)?');
  process.exit(1);
}
