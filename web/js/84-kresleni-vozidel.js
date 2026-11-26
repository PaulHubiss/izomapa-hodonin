  // světla vozidel v noci: sesbírat za celý snímek a nakreslit třemi cestami (kužely, přední, zadní) místo stovek fill()
  const LIGHTS_SX = 0.35, NL = { beams: [], head: [], tail: [] };
  function flushLights(night, sx) {
    if (NL.beams.length) {
      const a = Math.min(1, (night - 0.3) / 0.4), q = Math.max(1, sx * 3);
      ctx.globalAlpha = a * 0.35; ctx.fillStyle = '#ffe7a3'; ctx.beginPath();
      for (const b of NL.beams) { b.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); }
      ctx.fill(); ctx.globalAlpha = a;
      ctx.fillStyle = '#fff4c8'; ctx.beginPath(); for (const [x, y] of NL.head) ctx.rect(x - q / 2, y - q / 2, q, q); ctx.fill();
      ctx.fillStyle = '#ff3b2f'; ctx.beginPath(); for (const [x, y] of NL.tail) ctx.rect(x - q / 2, y - q / 2, q, q); ctx.fill();
      ctx.globalAlpha = 1;
    }
    NL.beams.length = NL.head.length = NL.tail.length = 0;
  }
  // je bod světa (x, y, z) z pohledu mapy zakrytý budovou, mostovkou nebo stromem? (stejné tvary jako ořez vozidel v drawBehindTrees)
  function svetloSkryte(x, y, z) {
    const [ix, iy] = toImg(x, y, z);
    for (const q of treeShapes(x, y, z, [ix - 1, iy - 1, ix + 1, iy + 1])) {
      if (q[0] === 2) { if (stromPixel(q, ix, iy)) return true; }
      else if (q[0] === 0) { const [a, b, r] = [q[1], q[2], q[3]]; if (iy >= a[1] && iy <= b[1] && Math.abs(ix - a[0]) <= r * (iy - a[1]) / Math.max(1e-6, b[1] - a[1])) return true; }
      else if (q[0] === 1) { const dx = (ix - q[1][0]) / q[2], dy = (iy - q[1][1]) / q[3]; if (dx * dx + dy * dy <= 1) return true; }
      else if (q[0] === 3) { let c = false; const h = q[1]; for (let i = 0, j = h.length - 1; i < h.length; j = i++) if ((h[i][1] > iy) !== (h[j][1] > iy) && ix < (h[j][0] - h[i][0]) * (iy - h[i][1]) / (h[j][1] - h[i][1]) + h[i][0]) c = !c; if (c) return true; }
    }
    return false;
  }
  function drawVehicle(o, len, wid, col, sx, ox, oy, night, isBus, lights = 3) {   // lights: 1 přední, 2 zadní
    const L = Math.hypot(o.dx, o.dy) || 1, fx_ = o.dx / L * (o.dirSign || 1), fy_ = o.dy / L * (o.dirSign || 1);
    const sxv = -fy_, syv = fx_;
    const lane = o.lane ?? 1.6, cxw = o.x - sxv * lane, cyw = o.y - syv * lane;
    const h0 = o.z ?? gz(cxw, cyw);                                            // výška silnice (na mostovce mostovka), jinak terén
    const base = toImg(cxw, cyw, h0);
    const nd = ndirOf(isBus), k = ((Math.round(Math.atan2(fy_, fx_) / (Math.PI * 2) * nd) % nd) + nd) % nd;
    const spr = vehicleSprite(col, k, isBus, len, wid, state.season === 'winter');
    drawBehindTrees(spr.c, base[0] + spr.x0, base[1] + spr.y0, spr.c.width, spr.c.height, cxw, cyw, h0, sx, ox, oy);
    if (night > 0.3 && !o.noLights && sx >= LIGHTS_SX) {                                    // světla jen při přiblížení; kreslí se najednou (flushLights)
      const P = (s, t, h) => { const p = toImg(cxw + fx_ * s + sxv * t, cyw + fy_ * s + syv * t, h0 + h); return [ox + p[0] * sx, oy + p[1] * sx]; };
      const l = len / 2, w = wid / 2, V = (s, h) => !svetloSkryte(cxw + fx_ * s, cyw + fy_ * s, h0 + h);   // světla za budovou nebo stromem se nekreslí
      const head = (lights & 1) && V(l, 0.7), tail = (lights & 2) && V(-l, 0.7);
      if (head && V(l + 7, 0.3) && V(l + 14, 0.1)) NL.beams.push([P(l, -w, 0.6), P(l + 14, -w - 4, 0.1), P(l + 14, w + 4, 0.1), P(l, w, 0.6)]);
      for (const t of [-w * 0.7, w * 0.7]) { if (head) NL.head.push(P(l, t, 0.7)); if (tail) NL.tail.push(P(-l, t, 0.7)); }
    }
    return true;
  }
  // vánoční strom na náměstí Míru (v zimě, večer svítí)
  const xmas = (() => {
    const c = document.createElement('canvas'); c.width = 30; c.height = 48; const g = c.getContext('2d');
    g.fillStyle = '#4a3020'; g.fillRect(13, 41, 4, 6);
    const lights = [];
    for (let i = 0; i < 6; i++) {
      const top = 6 + i * 6, hw = 4 + i * 2.2;
      for (let y = 0; y < 9; y++) { const w_ = Math.round(hw * (y + 1) / 9); g.fillStyle = y < 2 ? '#2f6a42' : '#1f4f30'; g.fillRect(15 - w_, top + y, w_ * 2, 1); g.fillStyle = '#e8eef5'; if (y === 0) g.fillRect(15 - w_, top, w_ * 2, 1); }
      for (let k = 0; k < 3 + i; k++) lights.push([15 - hw + rnd(i * 10 + k) * hw * 2, top + 4 + rnd(i * 7 + k) * 4]);
    }
    g.fillStyle = '#f6d34a'; g.fillRect(13, 1, 4, 4); g.fillRect(14, 0, 2, 6); g.fillRect(12, 2, 6, 2);
    return { c, lights };
  })();
  const xmasPts = (() => {
    const pts = Array.isArray(OV.xmas?.[0]) ? [...OV.xmas] : OV.xmas ? [OV.xmas] : [];
    const s = {{STROM}};
    if (s && s.length === 2) {
      const x = (s[1] - cam.lon0) * cam.kx, y = (s[0] - cam.lat0) * cam.ky, p = toImg(x, y, gz(x, y));
      if (!pts.some((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) < 5)) pts.push(p);
    }
    return pts;
  })();
  // vánoční stromy (mesto.json "vanocni_strom"): strom samotný je ve vrstvě výzdoby (render.html mode=xmas), tady jen blikající světýlka
  // na jeho patrech. Tvar pater musí odpovídat render.html: patro i má spodek 1,2 + 1,75 i m, výšku 3 m a poloměr 3,7 − 0,56 i m.
  const xmasTrees = ({{XMAS_LL}} || []).map(([lat, lon], n) => {
    const x = (lon - cam.lon0) * cam.kx, y = (lat - cam.lat0) * cam.ky, g = gz(x, y), lights = [];
    for (let i = 0; i < 6; i++) {
      const z0 = 1.2 + i * 1.75, r = 3.7 - i * 0.56;
      for (let k = 0; k < 7 - i; k++) {
        const u = 0.12 + rnd(n * 100 + i * 10 + k) * 0.6, a = (225 + (rnd(n * 100 + i * 10 + k + 5) - 0.5) * 150) * Math.PI / 180;   // přivrácená strana (pohled od JZ)
        lights.push(toImg(x + Math.cos(a) * r * (1 - u), y + Math.sin(a) * r * (1 - u), g + z0 + 3.0 * u));
      }
    }
    return { c: toImg(x, y, g + 7), lights };
  });
  // kluziště (mesto.json "kluziste": [{lat, lon, d: délka m, s: šířka m, a: natočení delší strany ve ° od východu}]): jen v zimě
  const rinks = ({{KLUZISTE}} || []).map((k, i) => {
    const cx = (k.lon - cam.lon0) * cam.kx, cy = (k.lat - cam.lat0) * cam.ky, a = (k.a || 0) * Math.PI / 180, L = k.d || 40, W = k.s || 20;
    const ux = Math.cos(a), uy = Math.sin(a);
    const at = (s, t) => [cx + ux * s - uy * t, cy + uy * s + ux * t];
    const h = Math.max(...[-1, 0, 1].flatMap((i) => [-1, 0, 1].map((j) => gz(...at(i * L / 2, j * W / 2))))) + 0.12;   // vršek ledu jako v render.html
    const sk = Array.from({ length: Math.max(4, Math.round(L * W / 70)) }, (_, j) => ({ r: 0.3 + rnd(i * 50 + j) * 0.65, ph: rnd(i * 50 + j + 7) * 6.283,
      v: (0.18 + rnd(i * 50 + j + 3) * 0.2) * (j % 6 ? 1 : -1), col: SKIC[j % SKIC.length], hat: SKIC[(j * 3 + 1) % SKIC.length] }));
    return { at, ring: [at(-L / 2, -W / 2), at(L / 2, -W / 2), at(L / 2, W / 2), at(-L / 2, W / 2)], h, L, W, sk };
  });
  // vánoční stánky (mesto.json "vanocni_stanky"): stánky jsou ve vrstvě výzdoby (render.html mode=xmas), tady jen noční osvětlení.
  // Rozměry musí odpovídat render.html: stánek w × 2,4 m, okap 2,2 m, pult na straně −t, okénko 0,95–1,95 m.
  const stalls = [];
  // klikací obrysy jarmarku (stánky, strom, pódium): klik otevře kartu místa s "vanoce": true (Pavel 2026-11-25). Budova blíž k pohledu
  // má přednost (hloubka d z overlay.py, menší = blíž), jinak by klik na střechu před stánkem otevřel jarmark.
  const JARMARK = VEREJNA.find((p) => p.vanoce), jarObrysy = [];
  const obalka = (pts) => {                                    // konvexní obálka (monotónní řetěz)
    const s = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]), pul = (q) => { const r = []; for (const p of q) { while (r.length > 1 && (r[r.length - 1][0] - r[r.length - 2][0]) * (p[1] - r[r.length - 2][1]) - (r[r.length - 1][1] - r[r.length - 2][1]) * (p[0] - r[r.length - 2][0]) <= 0) r.pop(); r.push(p); } r.pop(); return r; };
    return [...pul(s), ...pul(s.reverse())];
  };
  const jarObrys = (P, l, w, z0, z1, x, y, g) => { const pts = []; for (const s of [-l, l]) for (const t of [-w, w]) for (const h of [z0, z1]) pts.push(P(s, t, h)); jarObrysy.push({ p: obalka(pts), d: depth(x, y, g) }); };
  // večerní světla se nekreslí přes budovy, které stojí blíž k pohledu (dřív svítila i na jejich střechách): obrysy těchto budov,
  // zapamatované do načtení dalšího čtverce. vyrez(S, fn) nakreslí fn jen mimo ně.
  let jarVerze = 0; onChunk.push(() => { jarVerze++; });
  const pred = (S) => {
    if (S.verze === jarVerze) return S.pred;
    const xs = S.okoli.map((q) => q[0]), ys = S.okoli.map((q) => q[1]), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys), m = new Set();
    for (let i = Math.floor(x0 / CELL); i <= Math.floor(x1 / CELL); i++) for (let j = Math.floor(y0 / CELL); j <= Math.floor(y1 / CELL); j++)
      for (const b of grid.get(i + ',' + j) || []) if (b.d < S.d && b.bb[0] < x1 && b.bb[2] > x0 && b.bb[1] < y1 && b.bb[3] > y0) m.add(b);
    S.verze = jarVerze; return S.pred = [...m].map((b) => b.hull);
  };
  const vyrez = (S, sx, ox, oy, fn) => {
    const H = pred(S);
    if (!H.length) { fn(); return; }
    ctx.save();
    for (const h of H) {
      ctx.beginPath(); ctx.rect(0, 0, ctx.canvas.width, ctx.canvas.height);
      h.forEach(([x, y], i) => (i ? ctx.lineTo(ox + x * sx, oy + y * sx) : ctx.moveTo(ox + x * sx, oy + y * sx))); ctx.closePath(); ctx.clip('evenodd');
    }
    fn(); ctx.restore();
  };
  // Kde je jarmark opravdu vidět (site/jarmark_klik.json z nastroje-pavel/jarmark_klik.py, z neprůhledných pixelů vrstvy výzdoby):
  // tam má přednost před budovou, protože obrysy budov (konvexní obal) přes stánky přesahují (Pavel 2026-11-26, budova brala klik
  // u 46 % viditelné plochy). Bez souboru jako dřív: obrys stánku a budova blíž k pohledu vyhraje.
  let jarKlik = null;
  if (JARMARK) fetch(`jarmark_klik.json${VER ? VER + '&' : '?'}s=${SEST}`, NC).then((r) => (r.ok ? r.json() : null)).then((d) => {
    if (!Array.isArray(d)) return;
    jarKlik = d.map((p) => { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const [x, y] of p.o) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); } return { ...p, bb: [x0, y0, x1, y1] }; });
  }).catch(() => {});
  var jarmarkAt = (ix, iy, b) => {
    if (!JARMARK || !xmasShow() || !shown(JARMARK.k)) return null;
    if (jarKlik) return jarKlik.some((p) => ix >= p.bb[0] && ix <= p.bb[2] && iy >= p.bb[1] && iy <= p.bb[3] && inPoly(ix, iy, p.o) && !p.d.some((h) => inPoly(ix, iy, h))) ? JARMARK : null;
    return jarObrysy.some((o) => inPoly(ix, iy, o.p) && !(b && b.d < o.d)) ? JARMARK : null;
  };
  for (const [lat, lon] of {{XMAS_LL}} || []) {
    const x = (lon - cam.lon0) * cam.kx, y = (lat - cam.lat0) * cam.ky, g = gz(x, y);
    jarObrysy.push({ p: obalka([toImg(x - 3.7, y, g + 1.2), toImg(x + 3.7, y, g + 1.2), toImg(x, y - 3.7, g + 1.2), toImg(x, y + 3.7, g + 1.2), toImg(x, y, g + 14.7)]), d: depth(x, y, g) });
  }
  for (const k of {{STANKY}} || []) {
    const n = k.n || 5, wS = k.w || 3.0, m = k.m ?? 1.2, a = (k.a || 0) * Math.PI / 180, ux = Math.cos(a), uy = Math.sin(a);
    const x0 = (k.lon - cam.lon0) * cam.kx, y0 = (k.lat - cam.lat0) * cam.ky;
    for (let i = 0; i < n; i++) {
      const sc = (i - (n - 1) / 2) * (wS + m), cx = x0 + ux * sc, cy = y0 + uy * sc, g = gz(cx, cy);
      const P = (s, t, h) => toImg(cx + ux * s - uy * t, cy + uy * s + ux * t, g + h), l = wS / 2;
      jarObrys(P, l, 1.3, 0, 3.1, cx, cy, g);
      stalls.push({ c: P(0, 0, 1), d: depth(cx, cy, g), okoli: [P(-l - 2.2, -5.5, 0), P(l + 2.2, -5.5, 0), P(-l, -1.4, 2.2), P(l, -1.4, 2.2)],
        win: [P(-l + 0.25, -1.23, 0.95), P(l - 0.25, -1.23, 0.95), P(l - 0.25, -1.23, 1.95), P(-l + 0.25, -1.23, 1.95)],
        pool: [P(-l - 0.8, -1.3, 0), P(l + 0.8, -1.3, 0), P(l + 2.2, -5.5, 0), P(-l - 2.2, -5.5, 0)],
        bulbs: Array.from({ length: 6 }, (_, j) => P(-l + 0.25 + j * (wS - 0.5) / 5, -1.45, 1.9)) });
    }
  }
  // pódium (assets/vanoce.json "podia"): stavba je ve vrstvě výzdoby, tady jen večerní světla. Rozměry musí odpovídat render.html:
  // deska 1 m nad nejvyšším bodem terénu, rám střechy o 4,2 m výš; žárovky jsou na přivrácených hranách rámu (západ a jih),
  // světla pod střechou při pohledu shora vidět nejsou.
  const podia = ({{PODIA}} || []).map((k) => {
    const a = (k.a || 0) * Math.PI / 180, ux = Math.cos(a), uy = Math.sin(a), l = (k.d || 9) / 2, w = (k.s || 5) / 2;
    const x0 = (k.lon - cam.lon0) * cam.kx, y0 = (k.lat - cam.lat0) * cam.ky, at = (s, t) => [x0 + ux * s - uy * t, y0 + uy * s + ux * t];
    const g = Math.max(...[-1, 0, 1].flatMap((i) => [-1, 0, 1].map((j) => gz(...at(i * l, j * w))))), D = g + 1, E = D + 4.2;
    const P = (s, t, h) => toImg(...at(s, t), h);
    jarObrys((s, t, h) => P(s, t, g + h), l + 0.4, w + 0.4, 0, 6, x0, y0, g);
    return { c: P(0, 0, D), d: depth(x0, y0, g), okoli: [P(-l - 1.5, -w - 6, g), P(l + 1.5, -w - 6, g), P(-l, w, D), P(l, w, D), P(0, 0, E + 1)], deska: [P(-l, -w, D), P(l, -w, D), P(l, w, D), P(-l, w, D)],
      svetla: [...Array.from({ length: 7 }, (_, j) => P(-l + 0.3 + j * (2 * l - 0.6) / 6, w + 0.3, E + 0.15)), ...Array.from({ length: 4 }, (_, j) => P(-l - 0.3, w - 0.6 - j * (2 * w - 1.2) / 3, E + 0.15))] };
  });
  // svíčky na hrobech (overlay/<čtverec>.json "svicky": [x, y obrázku, náhoda]), kreslí se večer
  const svicky = [], SVB = 512, svGrid = new Map();             // mřížka po 512 px obrázku: každý snímek jen buňky ve výřezu
  onChunk.push((k, d) => {
    for (const [x, y, u] of d.svicky || []) {
      const q = [x, y, u, k], key = Math.floor(x / SVB) + ',' + Math.floor(y / SVB);
      svicky.push(q); if (!svGrid.has(key)) svGrid.set(key, []); svGrid.get(key).push(q);
    }
  });
