// Plynulost zoomu kolečkem myši u okraje mapy (Pavel 2026-11-17: „při přibližování/oddalování kolečkem mapa občas divně
// poposkočí, hlavně když se zobrazí tmavé rohy“): node nastroje-pavel/test_zoom.mjs [--vypis]
// Kolečko po zubech (deltaY 100, vlastní animace OpenSeadragonu, zub každých 150 ms) s kurzorem na místě; v prohlížeči se
// KAŽDÝ SNÍMEK zapíše poloha bodu mapy, který byl na začátku pod kurzorem. Plynulý pohyb mění rychlost postupně,
// skok = náhlá změna rychlosti mezi dvěma snímky (trhnutí). Měří se oddálení z přiblížení u okraje zástavby a zpět.
import { chromium } from './prohlizec.mjs';   // engine podle PROHLIZEC (chromium, webkit, firefox)
const b = await chromium.launch();
let ok = 0, spatne = 0;
const over = (co, v, info) => { v ? ok++ : spatne++; console.log(v ? '✅' : '❌', co, info === undefined ? '' : `· ${JSON.stringify(info)}`); };
const p = await (await b.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
const MISTA = [[48.8700, 17.1000], [48.8420, 17.1480], [48.8760, 17.1250], [48.8560, 17.1225]];   // okraje zástavby a střed
const vysledky = [];
for (const [lat, lon] of MISTA) {
  // ?m=… : jiná adresa = nová stránka (změna jen za # by stránku nenačetla znovu a záznamy by se sčítaly)
  await p.goto(`http://localhost:8000/?m=${lat},${lon}#leto@${lat},${lon},0.4`, { waitUntil: 'load' }); await p.waitForTimeout(4000);
  const mx = 900, my = 300;
  await p.mouse.move(mx, my);
  await p.evaluate(([mx, my]) => {
    const v = window.__izo.viewer.viewport, ref = v.pointFromPixel(new OpenSeadragon.Point(mx, my), true);
    window.__stopa = []; window.__nahrava = true;
    // zapisuje se v update-viewport = těsně před vykreslením snímku (vlastní requestAnimationFrame nebyl sladěný
    // s kreslením OpenSeadragonu a dělal falešné páry „skok a zpět“)
    // posun v každém snímku: kam se dostal bod mapy, který byl v minulém snímku pod kurzorem (bez omezení zůstane pod
    // kurzorem → 0; omezení u okraje ho posune). Skok = náhlá změna tohoto posunu.
    let pred = ref;
    window.__izo.viewer.addHandler('update-viewport', () => { if (!window.__nahrava) return; const q = v.pixelFromPoint(pred, true), pod = document.querySelector('#podlozka');
      window.__stopa.push([q.x - mx, q.y - my, v.getZoom(true), !!pod && pod.style.display !== 'none']); pred = v.pointFromPixel(new OpenSeadragon.Point(mx, my), true); });
  }, [mx, my]);
  for (let k = 0; k < 18; k++) { await p.mouse.wheel(0, 100); await p.waitForTimeout(150); }   // oddálit
  await p.waitForTimeout(800);
  for (let k = 0; k < 18; k++) { await p.mouse.wheel(0, -100); await p.waitForTimeout(150); }  // přiblížit zpět
  await p.waitForTimeout(800);
  const s = await p.evaluate(() => { window.__nahrava = false; return window.__stopa; });
  let max = 0, kde = null, rohy = 0;
  for (let i = 2; i < s.length; i++) {
    const j = Math.hypot(s[i][0] - s[i - 1][0], s[i][1] - s[i - 1][1]);   // změna posunu od omezení mezi snímky
    if (j > max) { max = j; kde = { snimek: i, zoom: +s[i][2].toFixed(3), rohy: s[i][3] }; }
    if (process.argv.includes('--vypis') && j > 15) console.log(`  ${lat},${lon} snímek ${i}: zoom ${s[i][2].toFixed(3)}, trhnutí ${Math.round(j)} px, rohy ${s[i][3] ? 'ano' : 'ne'}, body ${[s[i - 2], s[i - 1], s[i]].map((q) => `${Math.round(q[0])},${Math.round(q[1])}`).join(' → ')}`);
    if (s[i][3] !== s[i - 1][3]) rohy++;
  }
  vysledky.push({ misto: [lat, lon], snimku: s.length, nejvetsiTrhnutiPx: Math.round(max), kde, prechoduRohu: rohy });
}
console.log(JSON.stringify(vysledky));
over('zoom kolečkem bez trhnutí (rychlost bodu pod kurzorem se mezi snímky změní nejvýš o 60 px)', vysledky.every((v) => v.nejvetsiTrhnutiPx <= 60), vysledky);
console.log(`\n${ok} v pořádku, ${spatne} špatně`);
await b.close();
process.exit(spatne ? 1 : 0);
