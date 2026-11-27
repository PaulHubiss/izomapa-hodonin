// Zkouška výchozího pohledu a vrstev při oddálení: node nastroje-pavel/test_start.mjs
// 1) Po načtení (bez polohy v odkazu) mapa vyplní celé okno: na snímku mapy bez ovládacích panelů nesmí být pixely
//    barvy pozadí. Zkouší se několik tvarů okna (desktop, široké, mobil na výšku, tablet na výšku).
// 2) Tlačítko „domů“ vrátí stejný výřez.
// 3) Po oddálení jsou popisky a ikonky vrstev vidět jako tečky (ne schované) a u přepínačů vrstev je počet položek.
import { chromium, pripraveno } from './prohlizec.mjs';   // engine podle PROHLIZEC (chromium, webkit, firefox)
const URL0 = 'http://localhost:8000/#leto';
const OKNA = [[1200, 800], [1920, 1080], [390, 844], [820, 1180]];
const b = await chromium.launch();
let ok = 0, spatne = 0;
const vysledek = (co, dobre, info = '') => { dobre ? ok++ : spatne++; console.log(dobre ? '✅' : '❌', co, info); };

// podíl pixelů barvy pozadí na snímku jen mapy (ovládání skryté)
const prazdne = async (p) => {
  await p.addStyleTag({ content: 'body > *:not(#map) { visibility: hidden !important; } #fx { visibility: hidden !important; }' });
  await p.waitForTimeout(800);
  const buf = await p.screenshot();
  if (process.env.SNIMKY) { const v = p.viewportSize(); (await import('node:fs')).writeFileSync(`${process.env.SNIMKY}/start-${v.width}x${v.height}.png`, buf); }
  const png = buf.toString('base64');
  return p.evaluate(async (data) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + data; await img.decode();
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    const x = c.getContext('2d'); x.drawImage(img, 0, 0);
    const bg = getComputedStyle(document.body).backgroundColor.match(/\d+/g).map(Number);
    const d = x.getImageData(0, 0, c.width, c.height).data;
    // počítá se jen souvislá plocha pozadí, která začíná v rohu okna (prázdný roh kosočtverce roh okna vždy obsahuje);
    // tmavé pixely mapy u okraje (stín, les) ne
    const W = c.width, H = c.height, je = (px, py) => { const i = (py * W + px) * 4; return Math.abs(d[i] - bg[0]) <= 3 && Math.abs(d[i + 1] - bg[1]) <= 3 && Math.abs(d[i + 2] - bg[2]) <= 3; };
    const vidim = new Uint8Array(W * H), fronta = [];
    const pridej = (px, py) => { const k = py * W + px; if (!vidim[k] && je(px, py)) { vidim[k] = 1; fronta.push(k); } };
    pridej(0, 0); pridej(W - 1, 0); pridej(0, H - 1); pridej(W - 1, H - 1);
    while (fronta.length) { const k = fronta.pop(), px = k % W, py = (k - px) / W;
      if (px > 0) pridej(px - 1, py); if (px < W - 1) pridej(px + 1, py); if (py > 0) pridej(px, py - 1); if (py < H - 1) pridej(px, py + 1); }
    let n = 0, rohy = new Set();
    for (let k = 0; k < W * H; k++) if (vidim[k]) { n++; const px = k % W, py = (k - px) / W; rohy.add((py < H / 2 ? 'horní ' : 'dolní ') + (px < W / 2 ? 'levý' : 'pravý')); }
    return [n / (W * H), [...rohy].join(', ')];
  }, png);
};

for (const [w, h] of OKNA) {
  const ctx = await b.newContext({ viewport: { width: w, height: h } });
  const p = await ctx.newPage(); const chyby = []; p.on('pageerror', (e) => chyby.push(e.message));
  await p.goto(URL0, { waitUntil: 'load' }); await pripraveno(p);
  const [podil, kde] = await prazdne(p);
  vysledek(`start ${w}×${h} vyplní okno`, podil === 0, `(prázdné u okraje ${(podil * 100).toFixed(3)} %${kde ? ': ' + kde : ''})`);
  if (chyby.length) vysledek(`chyby stránky ${w}×${h}`, false, chyby.join(' | '));
  // na doraz oddáleno (diorama): celé město v okně na každém tvaru okna
  await p.mouse.move(w / 2, h / 2);
  for (let i = 0; i < 15; i++) { await p.mouse.wheel(0, 400); await p.waitForTimeout(100); }
  await p.waitForTimeout(1500);
  const cele = await p.evaluate(() => { const { townRect, viewer } = window.__izo, T = townRect(), b = viewer.viewport.getBounds(true), e = 1e-4;
    return b.x <= T.x + e && b.y <= T.y + e && b.x + b.width >= T.x + T.width - e && b.y + b.height >= T.y + T.height - e; });
  vysledek(`oddáleno ${w}×${h}: celé město v okně`, cele);
  if (process.env.SNIMKY) (await import('node:fs')).writeFileSync(`${process.env.SNIMKY}/diorama-${w}x${h}.png`, await p.screenshot());
  await ctx.close();
}

// domů + oddálení + počty
{
  const ctx = await b.newContext({ viewport: { width: 1200, height: 800 } });
  const p = await ctx.newPage(); const chyby = []; p.on('pageerror', (e) => chyby.push(e.message));
  await p.goto(URL0, { waitUntil: 'load' }); await pripraveno(p);
  // výřez přímo z mapy (střed a šířka v souřadnicích obrazu), ne z adresy: WebKit po startu bez pohybu adresu
  // s polohou nezapíše (zapisuje se až po skončení animace), 2026-11-17
  const vyrez = () => p.evaluate(() => { const v = window.__izo.viewer.viewport, c = v.getCenter(true); return [c.x, c.y, v.getBounds(true).width]; });
  const hash0 = await vyrez();
  // oddálit kolečkem na doraz
  await p.mouse.move(600, 400);
  for (let i = 0; i < 15; i++) { await p.mouse.wheel(0, 400); await p.waitForTimeout(120); }
  await p.waitForTimeout(1500);
  const far = await p.evaluate(() => {
    const vis = (sel) => [...document.querySelectorAll(sel)].filter((e) => getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().width > 0);
    const pin = vis('.pin.kat-pribehy'), pam = vis('.pin.kat-pamatky');
    const r = pin[0] && pin[0].getBoundingClientRect();
    return { far: document.querySelector('#map').classList.contains('far'), pin: pin.length, pam: pam.length, rozmer: r ? [Math.round(r.width), Math.round(r.height)] : null,
      n: ['n-pribehy', 'n-pamatky'].map((id) => document.getElementById(id).textContent) };
  });
  vysledek('oddálená mapa má třídu far', far.far);
  vysledek('popisky při oddálení jako tečky', far.pin > 0 && far.rozmer && far.rozmer[0] <= 14, JSON.stringify({ pin: far.pin, rozmer: far.rozmer }));
  vysledek('památky při oddálení jako tečky', far.pam > 0, `(${far.pam})`);
  vysledek('počty u vrstev', /^ \(\d+\)$/.test(far.n[0]) && /^ \(\d+\)$/.test(far.n[1]), JSON.stringify(far.n));
  await p.click('#home'); await p.waitForTimeout(2000);
  const hash1 = await vyrez();
  // stejný výřez do ~0,5 % šířky: výchozí pohled má kvůli terénu nepatrnou vůli a po oddálení za něj (diorama) se mapa
  // vrací z jiné strany (2026-11-16 o 7 m vedle = 0,25 % šířky výřezu, okem nepoznatelné)
  const [a0, b0, k0] = hash0, [a1, b1, k1] = hash1, tol = k0 * 0.005;
  vysledek('domů = výchozí výřez', Math.abs(a0 - a1) < tol && Math.abs(b0 - b1) < tol && Math.abs(k0 - k1) < tol, `${hash0.map((v) => v.toFixed(4))} → ${hash1.map((v) => v.toFixed(4))}`);

  // Diorama (Pavel 2026-11-16): na doraz oddálená mapa ukáže celé město (obrys zástavby, mesto.json rozsah_mesta),
  // kolem kosočtverce je pak pozadí. Od 2026-11-17 volná mapa: oddálit jde na celou mapu, střed smí kamkoli na ni.
  // Tažení začíná i končí uvnitř okna (puštění myši mimo okno nechá mapu „drženou“ a další kroky by nic neudělaly).
  // tažení nesmí začít na panelu vlevo ani na popisku místa (tlačítka – mapou nehnou, a to je správně) → schovat je
  await p.addStyleTag({ content: 'body > *:not(#map) { visibility: hidden !important; } .pin, .pin * { pointer-events: none !important; }' });
  const tahni = async (x0, y0, x1, y1) => { await p.mouse.move(x0, y0); await p.mouse.down(); for (let k = 1; k <= 12; k++) await p.mouse.move(x0 + (x1 - x0) * k / 12, y0 + (y1 - y0) * k / 12); await p.mouse.up(); await p.waitForTimeout(1200); };
  const SMERY = [[[150, 400, 1050, 400], 'k západu'], [[1050, 400, 150, 400], 'k východu'], [[600, 100, 600, 700], 'k severu'], [[600, 700, 600, 100], 'k jihu'], [[150, 100, 1050, 700], 'k severozápadu'], [[1050, 700, 150, 100], 'k jihovýchodu']];
  const mesto = () => p.evaluate(() => {   // je obdélník kolem města celý v okně? a střed pohledu nad městem?
    const { townRect, viewer } = window.__izo, T = townRect(), b = viewer.viewport.getBounds(true), c = viewer.viewport.getCenter(true), e = 1e-4;
    return { cele: b.x <= T.x + e && b.y <= T.y + e && b.x + b.width >= T.x + T.width - e && b.y + b.height >= T.y + T.height - e,
      nad: c.x >= T.x - e && c.x <= T.x + T.width + e && c.y >= T.y - e && c.y <= T.y + T.height + e };
  });
  await p.mouse.move(600, 400);                            // „domů“ už není nejmenší přiblížení: znovu oddálit na doraz
  for (let i = 0; i < 15; i++) { await p.mouse.wheel(0, 400); await p.waitForTimeout(120); }
  await p.waitForTimeout(1500);
  vysledek('oddáleno na doraz: celé město v okně', (await mesto()).cele);
  // Volná mapa (Pavel 2026-11-17): střed smí kamkoli na mapu, ne jen nad město → hlídá se, že zůstal na mapě
  const naMape = async () => (await p.evaluate(() => window.__izo.omezeniZbyva())) < 1;
  for (const [t, kam] of SMERY) { await tahni(...t); vysledek(`oddáleno, odtaženo ${kam}: střed zůstal na mapě`, await naMape()); }
  // přiblíženo: k okraji se dá dojet (omezení není přísnější, než je nutné), a prázdné místo se stejně neukáže
  // (z výchozího pohledu, ať je přiblížení pokaždé stejné a tažení nezačne na popisku místa)
  await p.evaluate(() => document.getElementById('home').click()); await p.waitForTimeout(2000);   // tlačítko je teď schované
  await p.mouse.move(600, 400);
  for (let i = 0; i < 6; i++) { await p.mouse.wheel(0, -400); await p.waitForTimeout(150); }
  await p.waitForTimeout(1200);
  const km = +(await p.evaluate(() => __izo.pohled())).split(',')[2];
  vysledek('kolečkem se přiblíží', km < 1.5, `(${km} km)`);
  for (const [t, kam] of SMERY) {
    const pred = await p.evaluate(() => __izo.pohled());
    for (let i = 0; i < 4; i++) await tahni(...t);
    // volná mapa: u okraje smí být vidět pozadí; hlídá se, že se mapa posunula a střed zůstal na mapě
    const po = await p.evaluate(() => __izo.pohled()), [pk] = await prazdne(p);
    vysledek(`přiblíženo, odtaženo ${kam}: posunulo se a střed zůstal na mapě`, pred !== po && await naMape(), `(prázdné ${(pk * 100).toFixed(1)} %) ${po}`);
  }
  if (chyby.length) vysledek('chyby stránky', false, chyby.join(' | '));
  await ctx.close();
}
await b.close();
console.log(`\n${ok} v pořádku, ${spatne} špatně`);
process.exit(spatne ? 1 : 0);
