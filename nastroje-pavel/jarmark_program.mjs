// Co prostředník vytáhne ze stránky jarmarku: node nastroje-pavel/jarmark_program.mjs <stažená stránka.html>
// Bez argumentu stránku načte přes onRequest z functions/api/program.js (stejná hlavička jako na ostrém webu).
import fs from 'fs';
import { parseJarmark, ZDROJE, UA } from '../functions/api/program.js';
const z = ZDROJE.jarmark;
const html = process.argv[2] ? fs.readFileSync(process.argv[2], 'utf8') : await (await fetch(z.url, { headers: { 'user-agent': UA } })).text();
const akce = parseJarmark(html, z.zaklad);
for (const a of akce) console.log(a.od.replace('T', ' '), a.nazev);
console.log(`${akce.length} akcí, dní ${new Set(akce.map((a) => a.od.slice(0, 10))).size}`);
// kontrola úplnosti: kolik řádků „HH:MM …“ je v textu stránky a kolik z nich převod nemá
const vynechane = (html.match(/\d{1,2}:\d{2}\s+Setkání účastníků na pěší zóně/g) || []).length;   // Pavel 2026-11-25
const radku = (html.match(/<p[^>]*>(?:<[^>]+>)*\s*\d{1,2}:\d{2}\s/g) || []).length - vynechane;
console.log(radku === akce.length ? `✅ všech ${radku} řádků s časem` : `❌ řádků s časem ${radku}, akcí ${akce.length}`);
