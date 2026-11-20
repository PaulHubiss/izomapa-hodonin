  // ---------- animovaná vrstva ----------
  const fx = $('fx'), ctx = fx.getContext('2d');
  viewer.canvas.insertBefore(fx, viewer.canvas.lastChild);           // mezi dlaždice a popisky: vozidla nepřekryjí názvy míst
  const rnd = (i) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  const DISTRICTS = (OV.districts || []).slice().sort((p, q) => (q.k === 'obec') - (p.k === 'obec') || q.a - p.a);   // obce před místními částmi
  const DISPLAY_FONT = getComputedStyle(document.documentElement).getPropertyValue('--display').trim() || 'monospace';
  const sid = (str) => { let h = 7; for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0; return Math.abs(h) % 1000003; };
  const occluded = (ix, iy, d) => {
    for (const b of grid.get(Math.floor(ix / CELL) + ',' + Math.floor(iy / CELL)) || [])
      if (shown(b.k) && b.d < d - 3 && ix >= b.bb[0] && ix <= b.bb[2] && iy >= b.bb[1] && iy <= b.bb[3] && inPoly(ix, iy, b.hull)) return true;
    return false;
  };
  // silniční graf
  const roads = [], ends = new Map(), cars = [];
  // vjezd na kruhový objezd: auto dá přednost autům na okruhu (25 m před vjezdem nebo právě v něm)
  function yieldZ(r, y) {
    const e = y[0] < 1 ? r.w[0] : r.w[r.w.length - 1], z = [y[0]];
    z.rb = { k: y[1].toFixed(0) + ',' + y[2].toFixed(0), cx: y[1], cy: y[2], R: y[3], an: Math.atan2(e[1] - y[2], e[0] - y[1]) };
    return z;
  }
  function ringFree(g) {
    for (const c of cars) {
      if (!carActive(c) || roads[c.r].rbk !== g.k) continue;
      const o = along(roads[c.r], c.s), rx = o.x - g.cx, ry = o.y - g.cy, turn = Math.sign((rx * o.dy - ry * o.dx) * c.dir) || 1;   // směr jízdy po okruhu
      let d = ((g.an - Math.atan2(ry, rx)) * turn) % (2 * Math.PI); if (d < 0) d += 2 * Math.PI;
      if (d * g.R < 25 || (2 * Math.PI - d) * g.R < 5) return false;
    }
    return true;
  }
  const blocked = (z) => z.rb ? !ringFree(z.rb) : (z.g || z.xc).closed;    // vjezd na kruhový objezd, zavřený přejezd (skupina z.g) nebo semafor (fáze z.xc)
  // železniční přejezdy (z[0] metry od začátku kusu, z[1..2] svět): zavřeno ~25 s před příjezdem vlaku, dokud neprojede poslední vůz
  // Přejezdy přes sousední koleje (do XG_M od sebe) tvoří jeden přejezd: jedny výstražníky před první a za poslední kolejí,
  // zavřeno, když jede vlak po kterékoli koleji (v OSM je přejezd zvlášť na každé koleji).
  const XC = new Map(), xings = [], XG = [], XG_M = 15;
  function addXing(r, z) {
    const key = Math.round(z[1]) + ',' + Math.round(z[2]);
    if (!XC.has(key)) XC.set(key, { x: z[1], y: z[2], closed: false, on: null });
    z.xc = XC.get(key);
    let g = XG.find((q) => q.pts.some(([x, y]) => Math.hypot(x - z[1], y - z[2]) < XG_M));
    if (!g) XG.push(g = { pts: [], cs: new Set(), closed: false });
    g.pts.push([z[1], z[2]]); g.cs.add(z.xc); z.g = g;
    const lead = xings.find(([r2, z2]) => r2 === r && z2.g === g);       // na jednom kusu silnice jedny výstražníky pro celou skupinu
    if (lead) { lead[1].s0 = Math.min(lead[1].s0, z[0]); lead[1].s1 = Math.max(lead[1].s1, z[0]); }
    else { z.s0 = z.s1 = z[0]; xings.push([r, z]); }
  }
  function xingShapes(c) {                                 // na kterých tratích (tvar, metry od začátku) přejezd leží
    c.on = [];
    MHD.shapes.forEach((sh, i) => {
      let best = 4, bs = 0;
      for (let k = 1; k < sh.w.length; k++) {
        const a = sh.w[k - 1], b = sh.w[k], dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy || 1;
        const t = Math.max(0, Math.min(1, ((c.x - a[0]) * dx + (c.y - a[1]) * dy) / l2)), d = Math.hypot(a[0] + dx * t - c.x, a[1] + dy * t - c.y);
        if (d < best) { best = d; bs = sh.len[k - 1] + (sh.len[k] - sh.len[k - 1]) * t; }
      }
      if (best < 4) c.on.push([i, bs]);
    });
  }
  const trainS = (trip, el) => {                           // metry po trati jako v mhdPos (střed vlaku)
    const q = trip[4]; let i = 2; while (i < q.length - 2 && q[i] < el) i += 2;
    const f = Math.max(0, Math.min(1, (el - q[i - 2]) / ((q[i] - q[i - 2]) || 1)));
    return q[i - 1] + (q[i + 1] - q[i - 1]) * f;
  };
  const busWait = new Map();                               // zpoždění autobusů a tramvají (s) čekajících na přejezdu
  function busDelay(i, trip, el, dt) {                     // před zavřeným přejezdem stát, po otevření zpoždění dohnat (o polovinu rychleji)
    let d = busWait.get(i) || 0, wait = false;
    if (!XC.size && !d) return 0;
    const s = trainS(trip, el - d);
    for (const c of XC.values()) if (c.closed && c.on) for (const [sh, sc] of c.on) if (sh === trip[1] && s > sc - 10 && s < sc - 2) wait = true;
    d = wait ? d + dt : Math.max(0, d - dt * 0.5);
    if (d) busWait.set(i, d); else busWait.delete(i);
    return d;
  }
  function updateXings() {
    if (!XC.size) return;
    const trains = MHD.on ? MHD.act.filter(([i]) => MHD.routes[MHD.trips[i][0]][1] === 2) : [];
    for (const c of XC.values()) {
      if (!trains.length) { c.closed = false; continue; }
      if (!c.on) xingShapes(c);
      c.closed = trains.some(([i, el]) => {
        const trip = MHD.trips[i], T = TRAINS[trainOf(MHD.routes[trip[0]][0])].cars.reduce((a, q) => a + q.len + 0.4, 0);
        return c.on.some(([sh, s]) => sh === trip[1] && trainS(trip, el + 25) + T / 2 > s - 5 && trainS(trip, el) - T / 2 < s + 8);
      });
    }
    for (const g of XG) g.closed = [...g.cs].some((c) => c.closed);
  }
  // semafory (OV.signals z nastroje/semafory.py, [x, y, křižovatka]): každá křižovatka má cyklus SIG_CYC s pro dvě osy
  // (osa 0 = směr nejvyšší třídy silnice, kolmé příjezdy osa 1); samotný přechod má jen osu 0 a zbytek cyklu patří chodcům.
  // Na kusu silnice r.sg: z = [metry od začátku, x, y], z.t směr jízdy ke křižovatce (0 = oba), z.d stop čára tolik m před bodem.
  const SIG_CYC = 64, SIG = new Map(), sigPosts = [];
  const SIG_RANK = { motorway: 7, trunk: 6, primary: 5, secondary: 4, tertiary: 3, unclassified: 2, residential: 1 };
  for (const [x, y, j] of OV.signals || []) {
    if (!SIG.has(j)) SIG.set(j, { pts: [], app: [], off: rnd(j + 900) * SIG_CYC, st: [{ closed: false, c: 'g' }, { closed: true, c: 'r' }] });
    SIG.get(j).pts.push([x, y]);
  }
  for (const J of SIG.values()) { J.cx = J.pts.reduce((a, p) => a + p[0], 0) / J.pts.length; J.cy = J.pts.reduce((a, p) => a + p[1], 0) / J.pts.length; }
  function projS(r, x, y) {                                // nejbližší bod kusu silnice: [vzdálenost, metry od začátku]
    let best = 1e9, bs = 0;
    for (let k = 1; k < r.w.length; k++) {
      const a = r.w[k - 1], b = r.w[k], dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy || 1;
      const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / l2)), d = Math.hypot(a[0] + dx * t - x, a[1] + dy * t - y);
      if (d < best) { best = d; bs = r.len[k - 1] + (r.len[k] - r.len[k - 1]) * t; }
    }
    return [best, bs];
  }
  function addSignals(r) {
    if (!SIG.size || r.c === 'service' || r.c === 'living_street') return;
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const p of r.w) { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); }
    for (const J of SIG.values()) {
      if (J.cx < x0 - 60 || J.cx > x1 + 60 || J.cy < y0 - 60 || J.cy > y1 + 60) continue;
      for (const [px, py] of J.pts) {
        const [d, s] = projS(r, px, py);
        if (d > 8) continue;
        const end = s < 1 ? -1 : s > r.L - 1 ? 1 : 0;        // semafor v uzlu na konci kusu: křižovatka je tam
        if (end && r.L < 20) continue;                      // krátký kus uvnitř křižovatky: tam se nestojí
        let t = end;
        if (!end) { const sc = projS(r, J.cx, J.cy)[1]; t = Math.abs(sc - s) < 3 ? 0 : Math.sign(sc - s); }
        if (r.o) { if (t && t !== r.o) continue; t = r.o; }   // jednosměrka: jen směr, kterým se jezdí
        if ((r.sg || []).some((q) => q.J === J && (q.t === t || !q.t || !t))) continue;   // víc bodů jedné křižovatky na tomtéž kusu
        const o = along(r, Math.max(0.5, Math.min(r.L - 0.5, s)));
        const z = [s, px, py]; Object.assign(z, { t, d: end ? 9 : 3, J, ang: Math.atan2(o.dy, o.dx), rank: SIG_RANK[r.c] || 0 });
        (r.sg = r.sg || []).push(z); J.app.push(z); sigPosts.push([r, z]);
        const ref = J.app.reduce((a, q) => (q.rank > a.rank ? q : a));
        for (const q of J.app) { let da = Math.abs(q.ang - ref.ang) % Math.PI; if (da > Math.PI / 2) da = Math.PI - da; q.xc = J.st[da > Math.PI / 4 ? 1 : 0]; }
      }
    }
  }
  function updateSignals() {                               // fáze podle hodin: všichni návštěvníci vidí stejnou barvu
    const t = Date.now() / 1000;
    for (const J of SIG.values()) {
      const p = (t + J.off) % SIG_CYC;
      J.st[0].c = p < 26 ? 'g' : p < 29 ? 'y' : 'r';
      J.st[1].c = p >= 32 && p < 58 ? 'g' : p >= 58 && p < 61 ? 'y' : 'r';
      for (const q of J.st) q.closed = q.c !== 'g';
    }
  }
  const SIG_LAMP = { r: [0, '#ff3b30', '255,59,48'], y: [1, '#ffc21a', '255,194,26'], g: [2, '#38e06a', '56,224,106'] };
  function drawSigPost(o, z, sx, ox, oy, night) {          // semafor: sloup a hlava se třemi světly, v noci svítící světlo září
    const x = ox + o.ix * sx, y = oy + o.iy * sx, h = 24 * sx, q = Math.max(1.6, 2.4 * sx);
    ctx.fillStyle = '#2a2c30'; ctx.fillRect(x - q * 0.3, y - h, q * 0.6, h);
    const hx = x - q * 0.9, hy = y - h - q * 4.2, [on, col, rgb] = SIG_LAMP[z.xc.c];
    ctx.fillStyle = '#17181b'; ctx.fillRect(hx, hy, q * 1.8, q * 4.4);
    for (let k = 0; k < 3; k++) { ctx.fillStyle = k === on ? col : '#3a3b40'; ctx.fillRect(hx + q * 0.4, hy + q * (0.35 + k * 1.35), q, q); }
    if (night > 0.3) {
      const lx = hx + q * 0.9, ly = hy + q * (0.85 + on * 1.35), g = ctx.createRadialGradient(lx, ly, 0, lx, ly, q * 3.5);
      g.addColorStop(0, `rgba(${rgb},${0.55 * Math.min(1, (night - 0.3) / 0.4)})`); g.addColorStop(1, `rgba(${rgb},0)`);
      ctx.fillStyle = g; ctx.fillRect(lx - q * 3.5, ly - q * 3.5, q * 7, q * 7);
    }
  }
  const ek = (p) => Math.round(p[0]) + ',' + Math.round(p[1]);
  const TRUCKC = ['#c42a20|#ecebe6|box', '#eceeed|#d6a13a|tarp', '#eceeed|#3f5f8a|tarp', '#2f4f86|#e4e4de|box', '#eceeed|#9aa0a7|box'];
  const CARC = ['#ecebe6', '#b3b8bf', '#2a2c31', '#b8291f', '#33529e', '#62666d', '#3d6b4c', '#cdbd99'];
  const VANC = ['#ecebe6', '#ecebe6', '#ecebe6', '#ecebe6', '#b3b8bf', '#2f3f6e', '#c23b2a', '#e8c547'];   // dodávky: hlavně bílé
  const CABC = ['#ecebe6', '#ecebe6', '#c23b2a', '#2f5fa8', '#e3a52b', '#3c6e47', '#1d1f24', '#b3b8bf'];   // kabiny tahačů
  const BOXC = ['#e9e8e2', '#e9e8e2', '#e9e8e2', '#c9ccd0', '#2f4f8a', '#a33a2c', '#4f6b4a', '#d9d2bf'];   // návěsy
  // druhy vozidel: len/wid rozměr v m, code obrázek ve vehicleSprite (3 nákladní auto, 5 dodávka, 7 tahač, 9 popelářské auto, 10 traktor),
  // vmax km/h, gap místo ve frontě před přejezdem (m). Kamion = tahač + návěs (TRAILER m) za ním po silnici.
  const VTYP = {
    car: { len: 4.2, wid: 1.76, code: false, gap: 8 }, van: { len: 5.4, wid: 2.0, code: 5, vmax: 110, gap: 9 },
    truck: { len: 9, wid: 2.45, code: 3, vmax: 80, gap: 13 }, semi: { len: 6.1, wid: 2.5, code: 7, vmax: 80, gap: 25 },
    garbage: { len: 9.2, wid: 2.5, code: 9, vmax: 35, gap: 13 }, tractor: { len: 4.3, wid: 2.3, code: 10, vmax: 30, gap: 8 },
    moto: { len: 2.7, wid: 1.0, code: 11, gap: 6 },              // motorka s jezdcem 1,3× (Pavel 2026-11-17: skutečná velikost zanikla), jen mimo zimu a za sucha
  };
  const MOTOC = ['#c23b2a|#ecebe6', '#1d1f24|#c23b2a', '#2f5fa8|#ecebe6', '#e3a52b|#1d1f24', '#3c6e47|#e8c547', '#b3b8bf|#2f5fa8'];   // nádrž | helma
  const TRAILER = 13.6, TAH = 3.05 - 1.0 + 6.8;                 // střed návěsu za středem tahače (točnice 1 m před zadkem tahače)
  const MINOR = new Set(['residential', 'living_street', 'unclassified', 'tertiary']);   // popeláři a traktory jezdí po vedlejších silnicích
  // silnice čtverce: napojit na graf (konce se potkají i přes šev) a přidat auta
  onChunk.push((k, d) => {
    const i0 = roads.length;
    for (const r of d.roads) {
      const len = [0]; for (let i = 1; i < r.w.length; i++) len.push(len[i - 1] + Math.hypot(r.w[i][0] - r.w[i - 1][0], r.w[i][1] - r.w[i - 1][1]));
      if (len[len.length - 1] > 1) { roads.push({ ...r, k, len, L: len[len.length - 1] }); const rr = roads[roads.length - 1]; for (const z of r.j || []) addXing(rr, z); rr.jy = [...(r.j || []), ...(r.y || []).map((y) => yieldZ(rr, y))]; if (r.rb) rr.rbk = r.rb[0].toFixed(0) + ',' + r.rb[1].toFixed(0); addSignals(rr); }   // i krátké kousky (kruhový objezd u vjezdů), jinak v okruhu zůstanou mezery a auta tam stojí
    }
    for (let i = i0; i < roads.length; i++) { const r = roads[i]; for (const [end, dir] of [[r.w[0], 1], [r.w[r.w.length - 1], -1]]) { const q = ek(end); if (!ends.has(q)) ends.set(q, []); ends.get(q).push([i, dir]); } }
    // konce, které se v datech minou o pár metrů (rozdělená vozovka, mostovka), propojit, ať auto nemusí otáčet ani mizet
    for (let i = i0; i < roads.length; i++) for (const end of [roads[i].w[0], roads[i].w[roads[i].w.length - 1]]) {
      const q = ek(end); if (ends.get(q).length > 1) continue;
      let best = null, bd = 36; const X = Math.round(end[0]), Y = Math.round(end[1]);
      for (let dx = -6; dx <= 6; dx++) for (let dy = -6; dy <= 6; dy++) {
        const d = dx * dx + dy * dy, l2 = (dx || dy) && d < bd && ends.get((X + dx) + ',' + (Y + dy));
        if (l2) { bd = d; best = l2; }
      }
      if (best) { const mine = ends.get(q).slice(); ends.get(q).push(...best.filter((e) => e[0] !== i)); best.push(...mine); }
    }
    const main = []; for (let i = i0; i < roads.length; i++) if (roads[i].c !== 'service') main.push(i);
    // s daty sčítání (r.v = vozidla za 24 h) je na silnici tolik aut, kolik odpovídá intenzitě a délce:
    // ve špičce projede za hodinu asi 10 % denní intenzity, při 45 km/h je to v / 450 aut na kilometr (odhad)
    const weights = main.map((i) => (roads[i].v || 0) * roads[i].L), wsum = weights.reduce((a, b) => a + b, 0);
    const n0 = cars.length, n = wsum ? Math.min(300, Math.round(wsum / 450 / 1000 * CAR_DENS)) : Math.min(110, Math.round(main.length / 6));
    const pickMain = (u) => { if (!wsum) return main[Math.floor(u * main.length)]; let x = u * wsum; for (let k = 0; k < main.length; k++) { x -= weights[k]; if (x <= 0) return main[k]; } return main[main.length - 1]; };
    for (let j = 0; j < n && main.length; j++) {
      const i = n0 + j, r_ = pickMain(rnd(i)), c = { r: r_, dir: roads[r_].o || (rnd(i + 9) > 0.5 ? 1 : -1), s: rnd(i + 3) * roads[r_].L,   // po celé délce, jinak se na dlouhé silnici auta nalepí do hloučku
        f: 0.85 + rnd(i + 5) * 0.25, q: rnd(i + 7), col: CARC[i % CARC.length], truck: rnd(i + 11) * 100 < (roads[r_].t || 0) };
      if (c.truck) c.col = TRUCKC[i % TRUCKC.length];
      const u_ = rnd(i + 13), rc = roads[r_].c;
      c.t = c.truck ? (u_ < 0.55 && !MINOR.has(rc) ? 'semi' : 'truck') : u_ < 0.1 ? 'van' : u_ < 0.11 ? 'garbage' : u_ < 0.116 ? 'tractor' : u_ < 0.216 ? 'moto' : 'car';   // motorek 10 % (Pavel 2026-11-17: 2 ani 6 % nebylo vidět)
      if (c.t === 'van') c.col = VANC[i % VANC.length];
      else if (c.t === 'moto') c.col = MOTOC[i % MOTOC.length];
      else if (c.t === 'semi') { c.col = CABC[i % CABC.length]; c.col2 = BOXC[(i >> 3) % BOXC.length]; }
      else if (c.t === 'garbage') c.col = '#ecebe6|#e8742a';
      else if (c.t === 'tractor') c.col = rnd(i + 17) < 0.7 ? '#3f7a2e' : '#b52a1e';
      c.T = VTYP[c.t]; c.pr = -1;
      if (c.dir < 0) c.s = roads[c.r].L - c.s;
      cars.push(c);
    }
  });
  function along(r, s) {
    const L = r.len; let i = 1; while (i < L.length - 1 && L[i] < s) i++;
    const t = Math.max(0, Math.min(1, (s - L[i - 1]) / ((L[i] - L[i - 1]) || 1)));
    const a = r.w[i - 1], b = r.w[i], pa = r.p[i - 1], pb = r.p[i];
    return { x: a[0] + (b[0] - a[0]) * t, y: a[1] + (b[1] - a[1]) * t, ix: pa[0] + (pb[0] - pa[0]) * t, iy: pa[1] + (pb[1] - pa[1]) * t, d: pa[2] + (pb[2] - pa[2]) * t, dx: b[0] - a[0], dy: b[1] - a[1], z: a.length > 2 ? a[2] + (b[2] - a[2]) * t : undefined };
  }
  function pickExit(all, c) {
    const big = c.truck ? all.filter(([i]) => roads[i].t) : c.t === 'garbage' || c.t === 'tractor' ? all.filter(([i]) => MINOR.has(roads[i].c)) : all, opts = big.length ? big : all;   // nákladní auta drží sčítané silnice, popeláři a traktory vedlejší
    const sum = opts.reduce((a, [i]) => a + (roads[i].v || 0), 0);
    if (!sum) return opts[Math.floor(Math.random() * opts.length)];
    let x = Math.random() * sum;
    for (const o of opts) { x -= roads[o[0]].v || 0; if (x <= 0) return o; }
    return opts[opts.length - 1];
  }
  // podíl aut podle denní doby: odhad tvaru dne, ne měření ze sčítání (špička 7 a 16 h, v noci málo)
  const DAY_SHARE = [.08, .05, .04, .04, .08, .25, .6, 1, .85, .65, .6, .65, .7, .7, .8, .95, 1, .9, .7, .5, .35, .25, .18, .12];
  const trafficShare = () => {
    if (!roads.some((r) => r.v)) return 1;
    if ($('realTime').checked) return DAY_SHARE[+new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Prague', hour: 'numeric', hourCycle: 'h23' }).format(new Date())];
    return 1 - 0.85 * state.night;
  };
  // pevná hustota na silnici (ne strop na celou mapu: ten se dělil podle počtu načtených čtverců a auta chodila ve vlnách);
  // strop aut na celou mapu; rozděluje se rovnoměrně přes c.q, takže platí pro všechny čtverce stejně
  const CAR_DENS = 0.4, SLOW_SHARE = 0.35;   // CAR_DENS: zlomek špičkové hustoty (plná působila jako zácpa); slabší zařízení kreslí jen část aut
  const MAX_CARS = 1000, MAX_CARS_SLOW = 300;
  // Zvolená auta jsou stabilní podle q. Při dosažení stropu vybereme přesný počet,
  // místo náhodného prahu, který může limit překročit.
  function limitCars(all, share, slow) {
    const threshold = share * (slow ? SLOW_SHARE : 1), cap = Math.floor(share * (slow ? MAX_CARS_SLOW : MAX_CARS));
    const eligible = all.filter((c) => c.q <= threshold);
    const allowed = eligible.length > cap ? new Set(eligible.sort((a, b) => a.q - b.q).slice(0, cap)) : null;
    return { threshold, allowed };
  }
  let tShare = 1, tShareT = 0, tShareCount = -1, tShareSlow = null, tAllowed = null;
  const carActive = (c) => c.q <= tShare && (!tAllowed || tAllowed.has(c)) && (c.t !== 'garbage' || state.night < 0.5)   // popeláři jen ve dne
    && (c.t !== 'moto' || (state.season !== 'winter' && state.weather !== 'rain' && state.weather !== 'snow'));       // motorky mimo zimu a za sucha
  // rychlost podle limitu z dat, jinak odhad podle třídy silnice; c.f je povaha řidiče
  const CLASS_KMH = { motorway: 110, trunk: 90, primary: 50, secondary: 50, tertiary: 50, unclassified: 40, residential: 30, living_street: 20 };
  const roadSpeed = (r) => (r.x ? Math.min(r.l || 50, 50) : r.l || CLASS_KMH[r.c] || 40) / 3.6;   // r.x = nájezdová rampa
  const carSpeed = (c, r) => Math.min(c.truck ? Math.min(roadSpeed(r), 22) * 0.85 : roadSpeed(r), (c.T.vmax || 999) / 3.6) * c.f;   // nákladní auta o něco pomaleji, popeláři a traktory pomalu
  function drawXPost(o, z, sx, ox, oy, now, night) {      // výstražník s křížem; v noci světlo září
    const x = ox + o.ix * sx, y = oy + o.iy * sx, h = 30 * sx, q = Math.max(2.5, 3.4 * sx), ph = Math.floor(now / 500) % 2;
    ctx.fillStyle = '#26262a'; ctx.fillRect(x - q * 0.35, y - h - q * 2.6, q * 0.7, h + q * 2.6);
    ctx.strokeStyle = '#d23a2e'; ctx.lineWidth = q * 0.9; ctx.beginPath();
    ctx.moveTo(x - q * 1.8, y - h - q * 3.6); ctx.lineTo(x + q * 1.8, y - h - q * 1.2); ctx.moveTo(x + q * 1.8, y - h - q * 3.6); ctx.lineTo(x - q * 1.8, y - h - q * 1.2); ctx.stroke();
    ctx.strokeStyle = '#f4f4f0'; ctx.lineWidth = q * 0.45; ctx.stroke();
    ctx.fillStyle = '#26262a'; ctx.fillRect(x - q * 2, y - h - q * 0.2, q * 4, q * 1.6);
    const lamp = z.g.closed ? [x + (ph ? 1.05 : -1.05) * q, '#ff4438', '255,68,56'] : Math.floor(now / 900) % 2 ? [x, '#f4f4f0', '244,244,240'] : null;
    if (!lamp) return;
    if (night > 0.3) {
      const g = ctx.createRadialGradient(lamp[0], y - h + q * 0.6, 0, lamp[0], y - h + q * 0.6, q * 3.5);
      g.addColorStop(0, `rgba(${lamp[2]},${0.55 * Math.min(1, (night - 0.3) / 0.4)})`); g.addColorStop(1, `rgba(${lamp[2]},0)`);
      ctx.fillStyle = g; ctx.fillRect(lamp[0] - q * 3.5, y - h + q * 0.6 - q * 3.5, q * 7, q * 7);
    }
    ctx.fillStyle = lamp[1]; ctx.fillRect(lamp[0] - q * 0.6, y - h + q * 0.05, q * 1.2, q * 1.1);
  }
  const curbPt = (o, side, off) => {                       // bod u pravého okraje vozovky pro auta jedoucí po kusu (side 1) nebo proti (-1)
    const L = Math.hypot(o.dx, o.dy) || 1, x = o.x + o.dy / L * side * off, y = o.y - o.dx / L * side * off, h = o.z ?? gz(x, y), [ix, iy] = toImg(x, y, h);
    return { x, y, ix, iy, d: depth(x, y, h) };
  };
  function stepCar(c, dt) {
    if (c.hold) { if (blocked(c.hold)) return; c.hold.q = null; c.hold = null; }
    const r = roads[c.r], next = c.s + carSpeed(c, r) * dt * c.dir;
    for (const zs of [r.jy, r.sg]) if (zs) for (const z of zs) {   // zavřený přejezd, plný kruhový objezd (6 m před) nebo červená/žlutá na semaforu (z.d m před bodem); fronta po c.T.gap m
      if (!blocked(z) || (z.t && z.t !== c.dir)) continue;  // semafor platí jen pro směr ke křižovatce
      const D = z.d ?? 6, qi = c.dir > 0 ? 0 : 1, stop = z[0] - c.dir * (D + ((z.q && z.q[qi]) || 0));   // z.q = délka fronty v m
      if (c.dir * (stop - c.s) >= 0 && c.dir * (next - stop) > 0) { c.s = stop; c.hold = z; (z.q = z.q || [0, 0])[qi] += c.T.gap; return; }
      if (c.dir * (stop - c.s) < 0 && c.dir * (z[0] - c.dir * D - c.s) >= 0) { c.hold = z; (z.q = z.q || [0, 0])[qi] += c.T.gap; return; }   // fronta mezitím narostla za auto: zastavit na místě
    }
    c.s = next;
    if (c.s < 0 || c.s > r.L) {
      const endPt = c.s < 0 ? r.w[0] : r.w[r.w.length - 1];
      c.pr = c.r; c.pdir = c.dir;                           // návěs kamionu ještě chvíli jede po předchozí silnici
      const opts = (ends.get(ek(endPt)) || []).filter(([i, dir]) => i !== c.r && roads[i].c !== 'service' && (!roads[i].o || roads[i].o === dir));
      if (opts.length) { const [i, dir] = pickExit(opts, c); c.r = i; c.dir = dir; c.s = dir > 0 ? 0 : roads[i].L; }
      else if (r.o && (ends.get(ek(endPt)) || []).some(([i]) => i !== c.r && roads[i].c !== 'service')) {   // data mají navazující kus opačně: radši pokračovat než zmizet
        const [i, dir] = pickExit((ends.get(ek(endPt)) || []).filter(([i]) => i !== c.r && roads[i].c !== 'service'), c); c.r = i; c.dir = dir; c.s = dir > 0 ? 0 : roads[i].L;
      }
      else if (r.o) {                  // konec jednosměrky: otočit se nesmí, auto se objeví jinde
        let i = c.r; for (let k = 0; k < 20; k++) { i = Math.floor(Math.random() * roads.length); if (roads[i].c !== 'service') break; }
        c.r = i; c.dir = roads[i].o || 1; c.s = c.dir > 0 ? 0 : roads[i].L; c.pr = -1;
      }
      else { c.dir *= -1; c.s = Math.max(0, Math.min(r.L, c.s)); c.pr = -1; }
    }
  }
  function trailerPos(c) {                                  // návěs kamionu TAH m za tahačem, po předchozí silnici, když tahač právě odbočil
    const r = roads[c.r], done = c.dir > 0 ? c.s : r.L - c.s;
    if (done >= TAH || c.pr < 0) { const o = along(r, Math.max(0, Math.min(r.L, c.s - TAH * c.dir))); o.dirSign = c.dir; o.lane = r.o ? 0 : 1.6; return o; }
    const q = roads[c.pr], rem = Math.min(q.L, TAH - done);
    const o = along(q, c.pdir > 0 ? q.L - rem : rem); o.dirSign = c.pdir; o.lane = q.o ? 0 : 1.6; return o;
  }
  const bus = (() => {
    if (!OV.bus) return null;
    const w = OV.bus.w; if (w.length < 2) return null;
    const len = [0]; for (let i = 1; i < w.length; i++) len.push(len[i - 1] + Math.hypot(w[i][0] - w[i - 1][0], w[i][1] - w[i - 1][1]));
    const r = { w, p: OV.bus.p, len, L: len[len.length - 1] };
    const stopS = OV.bus.stops.map(([sx, sy]) => { let best = 0, bd = 1e18; r.p.forEach((p, i) => { const d = (p[0] - sx) ** 2 + (p[1] - sy) ** 2; if (d < bd) { bd = d; best = i; } }); return len[best]; });
    return { r, s: 0, dir: 1, v: 9, wait: 3, stopS };
  })();
  // tramvaje: linky z overlay.json, na každé několik souprav (dva články), jezdí tam a zpět a stojí v zastávkách
  const trams = (OV.trams || []).flatMap((t) => {
    const w = t.w, len = [0]; for (let i = 1; i < w.length; i++) len.push(len[i - 1] + Math.hypot(w[i][0] - w[i - 1][0], w[i][1] - w[i - 1][1]));
    const r = { w, p: t.p, len, L: len[len.length - 1] };
    const stopS = t.stops.map(([sx, sy]) => { let best = 0, bd = 1e18; r.p.forEach((p, i) => { const d = (p[0] - sx) ** 2 + (p[1] - sy) ** 2; if (d < bd) { bd = d; best = i; } }); return len[best]; });
    return Array.from({ length: t.n }, (_, j) => ({ r, s: r.L * (j + 0.5) / t.n, dir: j % 2 ? -1 : 1, v: 8, wait: 0, stopS }));
  });
  // MHD podle jízdních řádů GTFS (site/mhd.json z mhd.py): poloha každého spoje podle skutečného času
  const MHD = { on: false, act: [], t: -1, drawn: [], follow: null };
  // bez GTFS v mesto.json se mhd.json nevyrábí: nežádat o něj (jinak chyba 404 v konzoli)
  if ({{MHD}}) fetch(`mhd.json${VER ? VER + '&' : '?'}s=${SEST}`, NC).then((r) => r.json()).then((m) => {
    m.shapes = m.shapes.map((w) => { const len = [0]; for (let i = 1; i < w.length; i++) len.push(len[i - 1] + Math.hypot(w[i][0] - w[i - 1][0], w[i][1] - w[i - 1][1])); return { w, len, L: len[len.length - 1] }; });
    m.dur = m.trips.map((t) => t[4][t[4].length - 2]);
    m.maxDur = Math.max(...m.dur);
    m.maxWait = m.trips.reduce((x, t) => Math.max(x, t[7] || 0), 0);   // čekání na konečné před odjezdem (mhd.py)
    Object.assign(MHD, m, { on: true });
    stopsReady();
    liveStart();
    if (VYL.list.length) vylukyRender();                    // výluky přišly dřív než jízdní řád: teď už je známo, které linky jezdí po mapě
  }).catch(() => {});
  // Živé polohy MHD (mesto.json "mhd": {"live": {"url", "format": "kordis"}}): vozidla jedou dál po trasách z jízdního řádu,
  // jen se jejich spoj posune v čase tak, aby stál tam, kde vozidlo podle dispečinku opravdu je. Bez proudu = jízdní řád.
  const LIVE_CFG = {{MHD_LIVE}};
  const LIVE = { on: false, v: new Map(), off: new Map(), cur: new Map(), delay: new Map(), late: 900, ws: null, retry: 5 };
  function liveStart() {
    if (!LIVE_CFG || !LIVE_CFG.url || LIVE.ws) return;
    let ws;
    try { ws = new WebSocket(LIVE_CFG.url); } catch { return; }
    LIVE.ws = ws;
    ws.onopen = () => { LIVE.retry = 5; };
    ws.onmessage = (e) => {
      let m; try { m = JSON.parse(e.data); } catch { return; }
      const a = m.attributes || m; if (a.Lat == null || a.Lng == null || a.IsInactive === 'true') return;   // formát KORDIS
      const x = (a.Lng - cam.lon0) * cam.kx, y = (a.Lat - cam.lat0) * cam.ky;
      if (!cam.grounds.some((q) => Math.abs(x - q.cx) <= cam.half + 600 && Math.abs(y - q.cy) <= cam.half + 600)) return;
      LIVE.v.set(a.ID, { x, y, line: String(a.LineName), delay: (+a.Delay || 0) * 60, t: +a.TimeUpdated || Date.now() });
      LIVE.on = true;
    };
    ws.onclose = () => { LIVE.ws = null; setTimeout(liveStart, LIVE.retry * 1000); LIVE.retry = Math.min(LIVE.retry * 2, 300); };
    ws.onerror = () => { try { ws.close(); } catch { /* zavře se samo */ } };
  }
  function shapeProject(sh, x, y, s0, win) {                 // nejbližší bod trasy k (x, y) v okně s0 ± win metrů: [s, vzdálenost]
    let best = [s0, Infinity];
    for (let k = 1; k < sh.w.length; k++) {
      if (sh.len[k] < s0 - win || sh.len[k - 1] > s0 + win) continue;
      const [ax, ay] = sh.w[k - 1], [bx, by] = sh.w[k], dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1;
      const u = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l2)), d = Math.hypot(ax + dx * u - x, ay + dy * u - y);
      if (d < best[1]) best = [sh.len[k - 1] + (sh.len[k] - sh.len[k - 1]) * u, d];
    }
    return best;
  }
  function elAtS(trip, s) {                                  // čas od výjezdu, kdy je spoj podle jízdního řádu v s metrech trasy
    const q = trip[4];
    for (let i = 2; i < q.length; i += 2) if (q[i + 1] >= s) {
      const ds = q[i + 1] - q[i - 1];
      return ds > 0.5 ? q[i - 2] + (s - q[i - 1]) / ds * (q[i] - q[i - 2]) : q[i];   // stání v zastávce: konec stání
    }
    return q[q.length - 2];
  }
  function liveMatch() {                                     // každou sekundu: živé vozidlo → nejpodobnější jedoucí spoj téže linky
    if (!LIVE.on) return;
    const now = Date.now(), cand = [];
    for (const [id, v] of LIVE.v) {
      if (now - v.t > 180000) { LIVE.v.delete(id); continue; }          // vozidlo se 3 minuty neozvalo
      for (const [i, el, ceka] of MHD.act) {
        const trip = MHD.trips[i]; if (MHD.routes[trip[0]][0] !== v.line || ceka) continue;
        const sh = MHD.shapes[trip[1]], s0 = mhdS(trip, el - v.delay);
        const [s, d] = shapeProject(sh, v.x, v.y, s0, 3000);
        if (d > 150) continue;
        const off = elAtS(trip, s) - el;
        if (Math.abs(off) > 1800 || Math.abs(off + v.delay) > 360) continue;   // posun musí sedět na zpoždění z dispečinku (jinak jiný spoj téže linky)
        cand.push([Math.abs(off + v.delay) / 30 + d / 20, i, id, off, v.delay]);   // podobnost: sedí zpoždění z dispečinku a vzdálenost od trasy
      }
    }
    cand.sort((p, q) => p[0] - q[0]);
    const usedT = new Set(), usedV = new Set(); LIVE.off.clear(); LIVE.delay.clear();
    for (const [, i, id, off, dl] of cand) {
      if (usedT.has(i) || usedV.has(id)) continue;
      usedT.add(i); usedV.add(id); LIVE.off.set(i, off); LIVE.delay.set(i, dl);
      if (!LIVE.cur.has(i)) LIVE.cur.set(i, off);                       // první shoda: rovnou na místo
    }
    for (const i of LIVE.cur.keys()) if (!LIVE.off.has(i)) LIVE.cur.delete(i);
  }
  function liveOff(i, dt) {                                  // plynulé dohánění: posun se mění nejvýš o 0,6 s za sekundu (vůz zpomalí nebo zrychlí)
    if (!LIVE.off.has(i)) return 0;
    const c = LIVE.cur.get(i) ?? 0, t = LIVE.off.get(i), k = Math.max(-0.6 * dt, Math.min(0.6 * dt, t - c));
    LIVE.cur.set(i, c + k); return c + k;
  }
  function mhdS(trip, el) {                                  // metry po trase podle jízdního řádu el sekund po výjezdu
    const q = trip[4]; let i = 2; while (i < q.length - 2 && q[i] < el) i += 2;
    const f = Math.max(0, Math.min(1, (el - q[i - 2]) / ((q[i] - q[i - 2]) || 1)));
    return q[i - 1] + (q[i + 1] - q[i - 1]) * f;
  }
  const pragueNow = () => {                                // datum, den v týdnu (po = 0) a sekundy od půlnoci (čas v Česku)
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Prague', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', weekday: 'short', hour12: false })
      .formatToParts(new Date()).map((q) => [q.type, q.value]));
    return { d: +(p.year + p.month + p.day), wd: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(p.weekday), s: (+p.hour % 24) * 3600 + +p.minute * 60 + +p.second + (Date.now() % 1000) / 1000 };
  };
  const ymd = (d) => +`${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  function mhdServices(d, wd, strict) {                    // služby jízdního řádu platné v daný den
    const on = new Set();
    for (const [id, [days, from, to, add, rem]] of Object.entries(MHD.services)) {
      if (rem.includes(d)) continue;
      if (add.includes(d) || (days[wd] && (!strict || (d >= from && d <= to)))) on.add(id);
    }
    return on;
  }
  function mhdActive() {                                   // jedoucí spoje (dnešní i ty, co vyjely včera před půlnocí)
    const n = pragueNow(), y = new Date(); y.setDate(y.getDate() - 1);
    let today = mhdServices(n.d, n.wd, true);
    if (!MHD.trips.some((t) => today.has(t[2]))) today = mhdServices(n.d, n.wd, false);   // prošlý jízdní řád: aspoň podle dne v týdnu
    const yest = mhdServices(ymd(y), (n.wd + 6) % 7, false), out = [];
    for (const [svc, t] of [[today, n.s], [yest, n.s + 86400]]) {
      const T = MHD.trips; let lo = 0, hi = T.length;
      const late = LIVE.on ? LIVE.late : 0;                   // se živými polohami i spoje, které podle jízdního řádu už dojely (zpoždění)
      while (lo < hi) { const m = (lo + hi) >> 1; if (T[m][3] < t - MHD.maxDur - late) lo = m + 1; else hi = m; }
      for (let i = lo; i < T.length && T[i][3] <= t + (MHD.maxWait || 0); i++) {
        if (!svc.has(T[i][2])) continue;
        const el = t - T[i][3];
        if (el <= MHD.dur[i] + late && el >= -(T[i][7] || 0)) out.push(el >= 0 ? [i, el] : [i, 0, -el]);   // [i, s od odjezdu, s do odjezdu když stojí na konečné]
      }
    }
    const fronta = {};                                     // víc vozů na téže konečné: kdo odjíždí později, stojí za ním (a[3] = pořadí)
    for (const a of out.filter((q) => q[2]).sort((p, q) => p[2] - q[2])) {
      const t = MHD.trips[a[0]], k = `${MHD.routes[t[0]][1]}_${t[6][0]}`;
      a[3] = fronta[k] = (fronta[k] ?? -1) + 1;
    }
    return out;
  }
  function mhdFollow(i) {                                  // kliknutí na vozidlo: pohled jede za ním, lišta ukazuje linku, cíl a další zastávku
    MHD.follow = i; $('follow').hidden = false; mhdFollowText(); closeCard();
  }
  function mhdFollowText() {
    const i = MHD.follow, a = MHD.act.find((q) => q[0] === i);
    if (!a) { $('followTxt').textContent = 'Spoj dojel do cílové zastávky.'; MHD.follow = null; setTimeout(() => { if (MHD.follow === null) $('follow').hidden = true; }, 4000); return; }
    const t = MHD.trips[i], [line, typ] = MHD.routes[t[0]], z = t[6]; let next = '';
    const el = a[1] + (LIVE.cur.get(i) || 0);
    for (let k = 0; k < z.length; k += 2) if (z[k + 1] >= el) { next = MHD.names[z[k]]; break; }
    const b = document.createElement('b'); b.textContent = `${typ === 0 ? 'Tramvaj' : typ === 2 ? 'Vlak' : 'Autobus'} ${line}`;
    const odj = a[2] ? ` · stojí na konečné, odjezd za ${Math.max(1, Math.round(a[2] / 60))} min` : next ? ` · další zastávka ${next}` : '';
    const dl = LIVE.delay.get(i), min = dl != null ? Math.round(dl / 60) : null;
    const zp = min == null ? (LIVE.on ? ' · podle jízdního řádu' : '') : min >= 1 ? ` · zpoždění ${min} min (živě)` : min <= -1 ? ` · napřed ${-min} min (živě)` : ' · včas (živě)';
    const vs = vylukyLinek(new Set([linka(line)]));          // výluka sledované linky
    $('followTxt').replaceChildren(b, ` → ${MHD.names[t[5]]}`, odj, zp, ...(vs.length ? [' · ', odkaz(vs[0].url, '⚠️ výluka')] : []));
  }
  $('followStop').addEventListener('click', () => { MHD.follow = null; if (typeof PLANES !== 'undefined') PLANES.follow = null; $('follow').hidden = true; });
  viewer.addHandler('canvas-drag', () => {
    if (MHD.follow !== null) { MHD.follow = null; $('follow').hidden = true; }
    if (typeof PLANES !== 'undefined' && PLANES.follow !== null) { PLANES.follow = null; $('follow').hidden = true; }
  });
  function odstavPos(trip, ceka, poradi) {                 // tramvaj na konečné, kde kolej za zastávkou slepě končí: z nástupiště dozadu na konec koleje, před odjezdem zpátky
    const pole = MHD.odstav && MHD.odstav[trip[1]];
    if (!pole) return null;
    const od = pole[(poradi || 0) % pole.length];
    if (!od.len) { od.len = [0]; for (let i = 1; i < od.length; i++) od.len.push(od.len[i - 1] + Math.hypot(od[i][0] - od[i - 1][0], od[i][1] - od[i - 1][1])); od.L = od.len[od.len.length - 1]; }
    const f = Math.min(1, Math.min((trip[7] || 0) - ceka, ceka) / 30), s = Math.max(0, od.L * f - 8 - ((poradi || 0) >= pole.length ? 34 : 0));
    const bod = (s_) => { let k = 1; while (k < od.len.length - 1 && od.len[k] < s_) k++; const a = od[k - 1], b = od[k], u = Math.max(0, Math.min(1, (s_ - od.len[k - 1]) / ((od.len[k] - od.len[k - 1]) || 1))); return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u]; };
    const [x, y] = bod(s), [x2, y2] = bod(Math.min(od.L, s + 6)), h = gz(x, y), [ix, iy] = toImg(x, y, h);   // směr z delšího úseku, koleje jsou po krátkých kouscích
    return { x, y, z: h, ix, iy, dx: x2 - x, dy: y2 - y, dirSign: 1 };
  }
  // zastávky (mhd.json "stops": [jméno, x, y, druh]): kliknutí ukáže nejbližší odjezdy podle jízdního řádu, hledání je najde
  function stopsReady() {
    if (!MHD.stops) return;
    MHD.stopPts = MHD.stops.map(([n, x, y, kd]) => { const [ix, iy] = toImg(x, y, gz(x, y)); return { n, x, y, kd, ix, iy }; });
    const seen = new Set();
    for (const s of MHD.stopPts) {
      if (seen.has(s.n)) continue; seen.add(s.n);
      const nm = MHD.names[s.n];
      index.push({ label: nm, kind: 'zastávka', k: `c${Math.round(s.x / (2 * cam.half))}_${Math.round(s.y / (2 * cam.half))}`, n: norm(nm), go: () => { goTo(s.ix, s.iy, 2); showStop(s); } });
    }
  }
  function stopDepartures(nid) {                             // [s do odjezdu, spoj] na hodinu dopředu (bez cílové zastávky spoje), i noční spoje po půlnoci
    const p = pragueNow(), y = new Date(); y.setDate(y.getDate() - 1);
    const zit = new Date(); zit.setDate(zit.getDate() + 1);
    let today = mhdServices(p.d, p.wd, true);
    if (!MHD.trips.some((t) => today.has(t[2]))) today = mhdServices(p.d, p.wd, false);
    const yest = mhdServices(ymd(y), (p.wd + 6) % 7, false), tom = mhdServices(ymd(zit), (p.wd + 1) % 7, false), out = [];
    for (const [svc, base] of [[today, 0], [yest, -86400], [tom, 86400]]) for (const t of MHD.trips) {
      if (!svc.has(t[2]) || MHD.routes[t[0]][1] === 2) continue;
      const z = t[6];
      for (let k = 0; k < z.length - 2; k += 2) if (z[k] === nid) { const dt = base + t[3] + z[k + 1] - p.s; if (dt >= -20 && dt <= 3600) out.push([dt, t]); }
    }
    return out.sort((a, b) => a[0] - b[0]);
  }
  function showStop(s) {
    const hm = (dt) => { const p = pragueNow(), v = Math.round((p.s + dt) / 60) % 1440; return `${Math.floor(v / 60)}:${String(v % 60).padStart(2, '0')}`; };
    const za = (dt) => (dt < 60 ? 'teď' : `za ${Math.round(dt / 60)} min`);
    const groups = new Map();
    for (const [dt, t] of stopDepartures(s.n)) {
      const [line, typ] = MHD.routes[t[0]], key = `${typ === 0 ? 'Tramvaj' : 'Autobus'} ${line} → ${MHD.names[t[5]]}`;
      if (!groups.has(key)) groups.set(key, []);
      if (groups.get(key).length < 3) groups.get(key).push(dt);
    }
    const odj = [...groups.entries()].sort((a, b) => a[1][0] - b[1][0]).slice(0, 10);
    showCard({ title: `Zastávka ${MHD.names[s.n]}`, text: odj.length ? 'Odjezdy podle jízdního řádu, bez zpoždění.' : 'V příští hodině odtud podle jízdního řádu nic nejede.',
      rows: [], lon: s.x / cam.kx + cam.lon0, lat: s.y / cam.ky + cam.lat0 });
    // odjezdy jako seznam (Pavel 2026-11-16: ve dvou sloupcích dt/dd se dlouhý směr a časy lámaly do úzkých pruhů):
    // štítek linky · směr (pod ním další odjezdy) · vpravo čas a „za N min“
    const dl = $('cardDl'), mk = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
    dl.classList.add('odjezdy'); dl.hidden = !odj.length;   // showCard prázdnou tabulku schová (karty po oddílech, 2026-11-20)
    for (const [key, v] of odj) {
      const [druh, line] = key.split(' '), smer = key.slice(key.indexOf('→') + 2);
      const radek = mk('div', 'odj'), dt = mk('dt'), dd = mk('dd');
      const lin = mk('span', 'linka' + (druh === 'Tramvaj' ? ' tram' : ''), line); lin.title = `${druh} ${line}`; lin.setAttribute('aria-label', `${druh} ${line}, směr`);
      dt.append(lin, mk('span', 'smer', smer));
      if (v.length > 1) dt.append(mk('small', 'dalsi', 'další ' + v.slice(1).map(hm).join(', ')));
      dd.append(mk('b', null, hm(v[0])), mk('small', null, za(v[0])));
      radek.append(dt, dd); dl.append(radek);
    }
    if (VYL.rel.length) {                                   // výluky všech linek, které tu podle jízdního řádu staví (i mimo nejbližší hodinu)
      const linky = new Set();
      for (const t of MHD.trips) { const z = t[6]; for (let k = 0; k < z.length; k += 2) if (z[k] === s.n) { linky.add(linka(MHD.routes[t[0]][0])); break; } }
      vylukaVKarte(linky);
    }
  }
  const stopAt = (ix, iy) => {                              // zastávka pod kliknutím (do ~20 px na obrazovce, nejméně 6 m)
    if (!MHD.stopPts) return null;
    const scr = viewer.viewport.getContainerSize().x / (viewer.viewport.getBounds(true).width * W);
    if (scr < 0.12) return null;
    const r = Math.max(20 / scr, 30); let best = null, bd = r;
    for (const s of MHD.stopPts) { const d = Math.hypot(s.ix - ix, s.iy - iy); if (d < bd) { bd = d; best = s; } }
    return best;
  };
  function mhdPos(trip, el, T = 0, off = 0) {                              // kde na trase je spoj el sekund po výjezdu
    const q = trip[4]; let i = 2; while (i < q.length - 2 && q[i] < el) i += 2;
    const f = Math.max(0, Math.min(1, (el - q[i - 2]) / ((q[i] - q[i - 2]) || 1)));
    const sh = MHD.shapes[trip[1]], L = sh.len, s0 = Math.min(sh.L, q[i - 1] + (q[i + 1] - q[i - 1]) * f), s = Math.max(0, Math.min(sh.L, Math.max(T / 2, Math.min(sh.L - T / 2, s0)) + off));   // T: délka vlaku, off: článek od středu
    const at = (s) => {
      let k = 1; while (k < L.length - 1 && L[k] < s) k++;
      const a = sh.w[k - 1], b = sh.w[k], u = Math.max(0, Math.min(1, (s - L[k - 1]) / ((L[k] - L[k - 1]) || 1)));
      return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];
    };
    // směr z bodů 4 m před a za vozidlem: trasy z GTFS mívají u zastávek krátké zalomené úseky, podle kterých by se vůz stočil napříč
    const [x, y] = at(s), p0 = at(Math.max(0, s - 4)), p1 = at(Math.min(sh.L, s + 4)), dx = p1[0] - p0[0], dy = p1[1] - p0[1];
    const h = deckZ(x, y, dx, dy) ?? gz(x, y), [ix, iy] = toImg(x, y, h);
    return { x, y, z: h, ix, iy, dx, dy, dirSign: 1 };   // z: autobus, tramvaj a vlak na mostě ve výšce mostovky
  }
  function stepShuttle(b, dt, stopWait, endWait) {
    if (b.wait > 0) { b.wait -= dt; return; }
    const prev = b.s; b.s += b.v * dt * b.dir;
    for (const s of b.stopS) if ((prev - s) * (b.s - s) <= 0 && Math.abs(prev - s) > 0.01) { b.s = s; b.wait = stopWait; }
    if (b.s >= b.r.L || b.s <= 0) { b.dir *= -1; b.s = Math.max(0, Math.min(b.r.L, b.s)); b.wait = endWait; }
  }
  // lyžaři: v zimě sjíždějí sjezdovky (data shora dolů) obloučky, dole se objeví znovu nahoře
  const skiers = [], SKIC = ['#d8352a', '#2f6fd1', '#f2c230', '#2aa36b', '#e0629a', '#f07a24', '#1d1f24', '#7b4fc9'];
  onChunk.push((k, d) => {
    for (const pl of d.pistes || []) {
      const len = [0]; for (let i = 1; i < pl.length; i++) len.push(len[i - 1] + Math.hypot(pl[i][0] - pl[i - 1][0], pl[i][1] - pl[i - 1][1]));
      const r = { w: pl, len, L: len[len.length - 1], k };
      if (r.L < 40) continue;
      const n = Math.max(1, Math.round(r.L / 80));
      for (let j = 0; j < n; j++) {
        const i = skiers.length + 1;
        skiers.push({ r, s: r.L * j / n + rnd(i) * 30, v: 5 + rnd(i + 1) * 5, amp: 3 + rnd(i + 2) * 9, wl: 22 + rnd(i + 3) * 30, ph: rnd(i + 4) * 6.3,
                      col: SKIC[i % SKIC.length], hat: SKIC[(i * 3 + 1) % SKIC.length] });
      }
    }
  });
  // ---------- lidé v ulicích (F13, Pavel 2026-11-16): chodci po chodnících a pěších cestách (site/chodci.json z nastroje-pavel/chodci.py) ----------
  // Každá cesta má svůj počet lidí podle váhy (centrum, pěší zóna, u podniků víc): nejvýš 1 člověk na CH_ROZESTUP m váhy 1.
  // Poloha se počítá z času (tam a zpět po cestě, občas postojí), nic se neukládá → počítají se jen cesty v okně
  // (mřížka po 150 m), ve městě jsou tisíce lidí a při posunu mapy nikdo „nevyskočí“. Kolik jich je venku, řídí
  // denní doba (ve skutečném čase podle hodin), počasí a roční období: každý má pořadí 0–1 a jde ven, je-li pod aktivitou.
  // Kreslí se jako lyžaři: pixelová postava, schová se za domy a stromy u cest. Přepínač „Lidé“.
  const CHODCI = { cesty: [], mriz: new Map(), ok: false, stat: {}, verze: 0 };   // verze: roste s každým načteným čtvercem (nové stromy a domy pro ořez)
  onChunk.push(() => { CHODCI.verze++; });   // stat: kolik postav poslední snímek zkoušel, schoval celé za dům a nakreslil (stromy a rohy domů vyřízne drawBehindTrees)
  // Pavel 2026-11-17: lidí méně (rozestup 40 → 80 m, strop 250 → 150 postav na snímek), cyklistů víc (260 → 90 m)
  // cyklisté: na zkoušku 8 bylo „moc“, 30 a 60 pořád hodně (Pavel 2026-11-17: „ještě výrazně uber“), teď 200
  const CH_ROZESTUP = 80, KO_ROZESTUP = 200, CH_BUNKA = 150, CH_NAKRESLIT = SLOW ? 90 : 150;   // strop postav na snímek (~12 µs každá)
  fetch(`chodci.json${VER ? VER + '&' : '?'}s=${SEST}`, NC).then((r) => (r.ok ? r.json() : null)).then((d) => {
    if (!d || !d.cesty || !d.cesty.length) return;
    let id = 0;
    // cyklisté (Pavel 2026-11-17, d.kola z chodci.py): stejné cesty a mřížka, jen řidčeji, rychleji (4–6,5 m/s), bez stání
    // kola: [váha, body, směr] – směr 1 = po směru čáry (pravý kraj ulice), -1 = proti (levý kraj), 0 = cyklostezka oběma směry
    for (const [v, flat, kolo, smerCesty] of [...d.cesty, ...(d.kola || []).map((q) => [q[0], q[1], true, q[2] || 0])]) {
      const w = []; for (let i = 0; i < flat.length; i += 2) w.push([flat[i], flat[i + 1]]);
      const len = [0]; for (let i = 1; i < w.length; i++) len.push(len[i - 1] + Math.hypot(w[i][0] - w[i - 1][0], w[i][1] - w[i - 1][1]));
      const L = len[len.length - 1], ci = CHODCI.cesty.length, n = v * L / (kolo ? KO_ROZESTUP : CH_ROZESTUP);
      const lide = [];
      for (let k = 0; k < Math.floor(n) + (rnd(ci * 13 + 1) < n % 1 ? 1 : 0); k++, id++) {
        const r = id * 7 + 11, T = kolo ? 1e9 : 40 + rnd(r) * 50;   // T: cyklus chůze; posledních 3–9 s cyklu postojí (výloha, známý)
        lide.push({ r, s0: rnd(r + 1) * 2 * L, v: kolo ? 4 + rnd(r + 2) * 2.5 : 1.05 + rnd(r + 2) * 0.55, T, stani: kolo ? 0 : 3 + rnd(r + 3) * 6, poradi: rnd(r + 4), seg: 1,
          smer: kolo ? (smerCesty || (rnd(r + 6) < 0.5 ? 1 : -1)) : 0 });
      }
      const c = { w, len, L, lide, kolo: !!kolo };
      CHODCI.cesty.push(c);
      const xs = w.map((p) => p[0]), ys = w.map((p) => p[1]);
      for (let gx = Math.floor(Math.min(...xs) / CH_BUNKA); gx <= Math.floor(Math.max(...xs) / CH_BUNKA); gx++)
        for (let gy = Math.floor(Math.min(...ys) / CH_BUNKA); gy <= Math.floor(Math.max(...ys) / CH_BUNKA); gy++) {
          const k = gx + ',' + gy; if (!CHODCI.mriz.has(k)) CHODCI.mriz.set(k, []); CHODCI.mriz.get(k).push(c);
        }
    }
    CHODCI.lidi = id;
    // zvířata v zoo (Pavel 2026-11-17, d.zoo z chodci.py): [druh, počet, procházka výběhem]; jako chodci, jen pomalu
    // a většinu času stojí (pasou se, odpočívají), každé zvíře má své tempo
    for (const [druh, pocet, flat] of d.zoo || []) {
      if (!ZV[druh]) continue;
      const w = []; for (let i = 0; i < flat.length; i += 2) w.push([flat[i], flat[i + 1]]);
      const len = [0]; for (let i = 1; i < w.length; i++) len.push(len[i - 1] + Math.hypot(w[i][0] - w[i - 1][0], w[i][1] - w[i - 1][1]));
      const L = len[len.length - 1], lide = [];
      for (let k = 0; k < pocet; k++, id++) {
        const r = id * 7 + 11, T = 40 + rnd(r) * 60;
        lide.push({ r, s0: rnd(r + 1) * 2 * L, v: ZV[druh].v * (0.7 + rnd(r + 2) * 0.6), T, stani: T * (0.45 + rnd(r + 3) * 0.3), poradi: rnd(r + 4), seg: 1 });
      }
      const c = { w, len, L, lide, zvire: druh };
      CHODCI.cesty.push(c);
      const xs = w.map((p) => p[0]), ys = w.map((p) => p[1]);
      for (let gx = Math.floor(Math.min(...xs) / CH_BUNKA); gx <= Math.floor(Math.max(...xs) / CH_BUNKA); gx++)
        for (let gy = Math.floor(Math.min(...ys) / CH_BUNKA); gy <= Math.floor(Math.max(...ys) / CH_BUNKA); gy++) {
          const k = gx + ',' + gy; if (!CHODCI.mriz.has(k)) CHODCI.mriz.set(k, []); CHODCI.mriz.get(k).push(c);
        }
    }
    // loďky (d.lode z chodci.py): {b: trasa, t: druhy lodí, o: stopa vpravo od osy v m}; řeka od přístavu proti
    // proudu a slepá ramena. Každá loďka jezdí po trase tam a zpět a u obou konců postojí (rybář skoro pořád stojí).
    CHODCI.lode = (d.lode || []).map(({ b: flat, t: typy, o }, ti) => {
      const w = []; for (let i = 0; i < flat.length; i += 2) w.push([flat[i], flat[i + 1]]);
      const len = [0]; for (let i = 1; i < w.length; i++) len.push(len[i - 1] + Math.hypot(w[i][0] - w[i - 1][0], w[i][1] - w[i - 1][1]));
      return { w, len, L: len[len.length - 1], o, lodky: typy.filter((n) => LODE_TYPY[n]).map((n, k) => {
        const typ = LODE_TYPY[n], r = ti * 37 + k * 5;
        return { typ, k, v: typ.v * (0.85 + rnd(r) * 0.3), pz: typ.pz[0] + rnd(r + 1) * (typ.pz[1] - typ.pz[0]), faze: rnd(r + 2), seg: 1, poradi: rnd(r + 3) };
      }) };
    });
    CHODCI.ok = true;
  }).catch(() => {});
  function chodciAktivita() {                               // 0–1: jaký podíl lidí je venku
    let a;
    if ($('realTime') && $('realTime').checked) {
      const h = pragueNow().s / 3600;
      const P = [[0, 0.04], [5, 0.04], [6.5, 0.45], [8, 0.8], [11, 0.7], [12.5, 0.9], [15, 1], [18, 0.85], [20, 0.45], [22, 0.12], [24, 0.04]];
      let k = 1; while (k < P.length - 1 && P[k][0] < h) k++;
      const [h0, a0] = P[k - 1], [h1, a1] = P[k]; a = a0 + (a1 - a0) * Math.max(0, Math.min(1, (h - h0) / ((h1 - h0) || 1)));
    } else a = state.night < 0.25 ? 1 : state.night < 0.7 ? 0.55 : 0.07;
    if (state.weather === 'rain') a *= 0.45; else if (state.weather === 'snow') a *= 0.6;
    if (state.season === 'winter') a *= 0.8; else if (state.season === 'summer') a *= 1.1;
    return Math.min(1, a);
  }
  function kolaAktivita() {                                  // cyklisté: naši lidé venku × autorův vliv období a počasí (Pavel 2026-11-18)
    const f = (BIKE_SEASON[state.season] ?? 0.5) * (state.weather === 'rain' ? 0.3 : state.weather === 'snow' ? 0.15 : 1);
    return Math.min(1, chodciAktivita() * f);
  }
  // cesty, které zasahují do okna: rohy výřezu přepočtené na svět (s rezervou), mřížka po 150 m
  function chodciVOkne() {
    const b = viewer.viewport.getBounds(true), rohy = [[b.x, b.y], [b.x + b.width, b.y], [b.x, b.y + b.height], [b.x + b.width, b.y + b.height]].map(([x, y]) => imgToWorld(x * W, y * W));
    const xs = rohy.map((p) => p[0]), ys = rohy.map((p) => p[1]), out = new Set();
    for (let gx = Math.floor((Math.min(...xs) - 60) / CH_BUNKA); gx <= Math.floor((Math.max(...xs) + 60) / CH_BUNKA); gx++)
      for (let gy = Math.floor((Math.min(...ys) - 60) / CH_BUNKA); gy <= Math.floor((Math.max(...ys) + 60) / CH_BUNKA); gy++)
        for (const c of CHODCI.mriz.get(gx + ',' + gy) || []) out.add(c);
    return out;
  }
  // kde je člověk v čase t: chůze tam a zpět po cestě (s0 = posun v cyklu 2L), na konci každého cyklu T postojí
  function chodecPoloha(c, q, t) {
    const cyklus = Math.floor(t / q.T), vCyklu = t - cyklus * q.T, chuze = q.T - q.stani;
    const jde = Math.min(vCyklu, chuze), stoji = vCyklu > chuze;
    const u = (q.s0 + q.v * (cyklus * chuze + jde)) % (2 * c.L);
    return { s: u < c.L ? u : 2 * c.L - u, stoji, zpet: u >= c.L };
  }
  // Kresba lidí AUTOROVÝMI postavami (75-chodci.js: outfitOf, personSprite, bikeSprite, drawDogAt) ve skutečné velikosti:
  // oblečení podle ročního období, deštníky, dvojice, děti, psi, cyklisté z boku i zepředu (Pavel 2026-11-18 po sloučení:
  // „líbí se mi víc autorovi lidi“). Kde, kolik a kdy zůstává naše: cesty z chodci.py, hustota a strop, aktivita podle času,
  // počasí a období, ubývání při oddálení, poloha z času. Autorův vlastní pohyb lidí (PEOPLE) zůstává v kódu vypnutý
  // (skrytý přepínač l-people), ať další sloučení s autorem nemá konflikty.
  const lideHpx = () => Math.abs(toImg(0, 0, 1)[1] - toImg(0, 0, 0)[1]);   // px obrázku na 1 m výšky
  const lideU = (sx) => lideHpx() * 0.1 * sx;                                // bod postavy (10 cm) na obrazovce; kreslí se od 0,3 px (jako u autora)
  // svět [x, y, dx, dy] na cestě c ve vzdálenosti s, posunutý o bok m kolmo (lidé nejdou husím pochodem po ose cesty)
  function lideBod(c, q, s, bok) {
    const L = c.len; let i = q.seg;
    while (i > 1 && L[i - 1] > s) i--; while (i < L.length - 1 && L[i] < s) i++; q.seg = i;
    const a = c.w[i - 1], b = c.w[i], dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy) || 1;
    const u0 = Math.max(0, Math.min(1, (s - L[i - 1]) / ((L[i] - L[i - 1]) || 1)));
    return [a[0] + dx * u0 + dy / d * bok, a[1] + dy * u0 - dx / d * bok, dx / d, dy / d];
  }
  // schovaný za domem nebo stromem: nohy nebo hlava za domem, střed postavy pod korunou stromu (stejné pravidlo jako autor)
  function lideSchovan(x, y, h, ip, hpx) {
    const dp = depth(x, y, h);
    if (occluded(ip[0], ip[1], dp) || occluded(ip[0], ip[1] - hpx * 1.2, dp)) return true;
    for (const q of treeShapes(x, y, h, [ip[0] - 1, ip[1] - 9, ip[0] + 1, ip[1]]))
      if (q[0] === 1 ? ((ip[0] - q[1][0]) / q[2]) ** 2 + ((ip[1] - 4 - q[1][1]) / q[3]) ** 2 < 1 : ip[1] - 4 > q[1][1] && ip[1] - 4 < q[2][1] && Math.abs(ip[0] - q[1][0]) < q[3] * (ip[1] - 4 - q[1][1]) / (q[2][1] - q[1][1])) return true;
    return false;
  }
  const LIDE_PES = ['#7a5532', '#e8e0d0', '#2b2b30', '#b08a4e', '#d9bf7a'];
  function drawChodec(c, q, s, stoji, zpet, sx, ox, oy, night, vis) {
    const [x, y, fx0, fy0] = lideBod(c, q, s, (rnd(q.r + 8) - 0.5) * 1.4), sm = zpet ? -1 : 1, fx = fx0 * sm, fy = fy0 * sm;
    const h = gz(x, y), ip = toImg(x, y, h);
    if (!vis(ip[0], ip[1], 30)) return;
    CHODCI.stat.zkouseno++;
    const hpx = lideHpx(), u = hpx * 0.1 * sx;
    if (lideSchovan(x, y, h, ip, hpx)) { CHODCI.stat.dum++; return; }
    CHODCI.stat.kresleno++;
    const s1 = toImg(x + fx * 0.05, y + fy * 0.05, h), back = s1[1] - ip[1] < 0, mir = s1[0] - ip[0] < 0;
    const fr = stoji ? 0 : Math.floor(s * 7.5) % 4, nb = Math.min(4, Math.round(night * 5)), rain = state.weather === 'rain';
    const oi = Math.floor(rnd(q.r + 14) * 160), pair = rnd(q.r + 11) < 0.13, kid = rnd(q.r + 12) < 0.1;
    const dog = rnd(q.r + 13) < 0.06 ? LIDE_PES[q.r % 5] : null;
    const nx = -fy, ny = fx;                                   // kolmo ke směru chůze
    const near = (off, fwd) => { const x_ = x + nx * off + fx * fwd, y_ = y + ny * off + fy * fwd, h_ = gz(x_, y_); return [x_, y_, h_, toImg(x_, y_, h_)]; };
    const all = [['m', [x, y, h, ip], oi]];
    if (pair) all.push(['a', near(0.65, 0.1), (oi + 53) % 160]);
    if (kid) all.push(['k', near(-0.6, -0.2), oi]);
    all.sort((a, b) => a[1][3][1] - b[1][3][1]);
    for (const [t, P, o_i] of all) {
      if (t !== 'm' && lideSchovan(P[0], P[1], P[2], P[3], hpx)) continue;
      const dite = t === 'k', o = outfitOf(state.season, o_i, dite), X = ox + P[3][0] * sx, Y = oy + P[3][1] * sx;
      ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.fillRect(X - 2.5 * u, Y - 0.6 * u, 5 * u, Math.max(1, u));
      ctx.drawImage(personSprite(o, state.season + (dite ? 'k' : '') + o_i, back, mir, fr, nb, rain && o.umb), X - (PCX + 1.5) * u, Y - (PBASE + 2) * u, (PGW + 2) * u, (PGH + 2) * u);
    }
    if (dog) { const P = near(-0.9, 0.9); if (!lideSchovan(P[0], P[1], P[2], P[3], hpx)) drawDogAt(ox + P[3][0] * sx, oy + P[3][1] * sx, u, mir, fr, dog); }
  }
  function drawCyklista(c, q, s, zpet, sx, ox, oy, night, vis) {
    const [x, y, fx0, fy0] = lideBod(c, q, s, 0), sm = zpet ? -1 : 1, fx = fx0 * sm, fy = fy0 * sm;
    const h = gz(x, y), ip = toImg(x, y, h);
    if (!vis(ip[0], ip[1], 30)) return;
    CHODCI.stat.zkouseno++;
    const hpx = lideHpx(), u = hpx * 0.1 * sx;
    if (lideSchovan(x, y, h, ip, hpx)) { CHODCI.stat.dum++; return; }
    CHODCI.stat.kresleno++; CHODCI.stat.kola = (CHODCI.stat.kola || 0) + 1;
    const s1 = toImg(x + fx * 0.05, y + fy * 0.05, h), sdx = s1[0] - ip[0], sdy = s1[1] - ip[1];
    const view = Math.abs(sdx) > Math.abs(sdy) * 0.5 ? 's' : sdy < 0 ? 'b' : 'f';   // z boku, nebo zezadu / zepředu
    const oi = Math.floor(rnd(q.r + 14) * 160), o = outfitOf(state.season, oi, false);
    const bike = q.kolo || (q.kolo = { col: BIKE_COL[Math.floor(rnd(q.r + 15) * BIKE_COL.length)], helm: rnd(q.r + 16) < 0.55 ? P_ACC[Math.floor(rnd(q.r + 17) * P_ACC.length)] : null });
    const X = ox + ip[0] * sx, Y = oy + ip[1] * sx, w = view === 's' ? 7 : 2, nb = Math.min(4, Math.round(night * 5));
    ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.fillRect(X - w * u, Y - 0.6 * u, 2 * w * u, Math.max(1, u));
    ctx.drawImage(bikeSprite(o, state.season + oi, bike, view, sdx < 0, Math.floor(s) % 4, nb), X - (BCX + 1) * u, Y - (BBASE + 2) * u, (BGW + 2) * u, (BGH + 2) * u);
  }
  // ---------- zvířata v zoo (Pavel 2026-11-17): pixelové postavy ve stejném měřítku jako chodci (bod ≈ 0,31 m, 1,6×) ----------
  // t: tělo zprava doleva po řádcích (hlava vpravo, zvíře jde doprava; doleva se zrcadlí), písmena = barvy z p.
  // n: [výška nohou v bodech, sloupec zadních, sloupec předních, barva]; při chůzi se nohy střídají (k sobě / od sebe).
  // v: rychlost chůze m/s; teplo: v zimě jsou uvnitř (v mapě nejsou). Velikost zvětšuje ZV_ZVETS (srovnání zoo_velikost.mjs).
  const ZV = {
    zebra: { v: 0.5, p: { w: '#f2f1ec', k: '#24252a' }, n: [2, 2, 6, 'w'],
      t: ['........kw', '.......wkw', 'kwkwkwkwk.', 'wkwkwkwk..', '.kwkwkwk..'] },
    lev: { v: 0.45, p: { a: '#c99a4e', m: '#7a4a22', c: '#e2c48f' }, n: [2, 1, 5, 'a'],
      t: ['......mm.', 'a.....maa', '.aaaaamm.', '.cccccc..'] },
    tygr: { v: 0.5, p: { a: '#e07b28', k: '#2a1d14', c: '#f3e6d0' }, n: [2, 1, 5, 'a'],
      t: ['......aa.', 'akakakaac', '.akakaaa.', '.cccccc..'] },
    jaguar: { v: 0.5, p: { a: '#d9a441', k: '#3a2a18' }, n: [1, 1, 4, 'a'], teplo: true,
      t: ['.....aa', 'akakaak', '.akaka.'] },
    antilopa: { v: 0.4, p: { a: '#6b5a48', w: '#efe9dc', h: '#d8c9a0' }, n: [3, 1, 5, 'a'],
      t: ['......h.', '......aa', 'aaawawa.', '.aaaaa..'] },
    adax: { v: 0.4, p: { a: '#ece6d8', k: '#8a7b66', h: '#b9ab88' }, n: [3, 1, 5, 'a'],
      t: ['......hh', '......ka', 'aaaaaaa.', '.aaaaa..'] },
    oryx: { v: 0.4, p: { a: '#e7dcc4', k: '#2c2620', h: '#3a332b' }, n: [3, 1, 5, 'a'],
      t: ['.....h..', '......h.', '......ka', 'aakkkaa.', '.aaaaa..'] },
    velbloud: { v: 0.4, p: { a: '#b98d55', c: '#a37a46' }, n: [4, 1, 5, 'c'],
      t: ['..a.a...aa', '.aaaaa..a.', 'aaaaaaaa..', '.aaaaaa...'] },
    lama: { v: 0.45, p: { a: '#ddc7a4', k: '#5a4a3a' }, n: [3, 1, 4, 'a'],
      t: ['....ak', '....a.', '....a.', 'aaaaa.', '.aaaa.'] },
    osel: { v: 0.4, p: { a: '#8c8780', c: '#e2ddd6', k: '#3a3633' }, n: [2, 1, 5, 'a'],
      t: ['.....kk.', '.....aac', 'aaaaaaa.', '.acccc..'] },
    koza: { v: 0.4, p: { a: '#8a6a4a', w: '#ece4d6', h: '#4a3d30' }, n: [1, 1, 3, 'a'],
      t: ['...h.', '...aa', 'aawa.'] },
    ovce: { v: 0.35, p: { w: '#ecebe5', k: '#2a2a2a' }, n: [1, 1, 3, 'k'],
      t: ['...kk', 'wwwwk', 'wwww.'] },
    prase: { v: 0.35, p: { a: '#4a3a32', c: '#6b564b' }, n: [1, 1, 4, 'a'],
      t: ['aaaa..', 'aaaaac'] },
    klokan: { v: 0.6, p: { a: '#a87a55', c: '#d8b48e' }, n: [1, 2, 3, 'a'], teplo: true,
      t: ['...a.', '...aa', '..aa.', '.aac.', 'aaac.'] },
    mara: { v: 0.5, p: { a: '#8f7a62', c: '#d9cbb4' }, n: [2, 1, 3, 'a'], teplo: true,
      t: ['...a.', 'aaaaa', '.ccc.'] },
    surikata: { v: 0.3, p: { a: '#c9a77c', k: '#3a2c20' }, n: [1, 0, 1, 'a'], teplo: true,
      t: ['.k', 'aa', 'aa', 'aa'] },
    pes: { v: 0.6, p: { a: '#c4602a', k: '#2a1d18' }, n: [3, 1, 4, 'k'],
      t: ['.....ak', 'akkkaaa', '.aaaa..'] },
    jerab: { v: 0.3, p: { a: '#9aa0a6', k: '#2a2a2a', r: '#c0392b' }, n: [3, 1, 1, 'k'],
      t: ['..r.', '..ka', '..a.', '.aa.', 'aaa.', '.aa.'] },
    nandu: { v: 0.45, p: { a: '#8c847a', k: '#4a443e' }, n: [3, 2, 2, 'a'],
      t: ['...aa', '...a.', '...a.', 'aaaa.', 'kaaa.', '.aa..'] },
    plamenak: { v: 0.25, p: { p: '#f08aa0', k: '#222222' }, n: [4, 1, 1, 'p'], teplo: true,
      t: ['.pk', '.p.', 'p..', 'pp.', 'ppp'] },
    veverka: { v: 0.6, p: { a: '#b5532a' }, n: [1, 1, 2, 'a'],
      t: ['a.a', 'aaa'] },
  };
  let ZV_ZVETS = 1.6;                                      // jako chodci; zvětšení mění výšku bodu (srovnání nastroje-pavel/zoo_velikost.mjs)
  const zvC = document.createElement('canvas');
  function zooAktivita(druh) {                              // 0–1: jaký podíl zvířat druhu je venku
    if (state.season === 'winter' && ZV[druh].teplo) return 0;   // teplomilná zvířata jsou v zimě v pavilonu
    let a;
    if ($('realTime') && $('realTime').checked) {
      const h = pragueNow().s / 3600;
      a = h >= 8.5 && h < 18.5 ? 1 : h >= 7 && h < 20 ? 0.6 : 0.25;      // v noci jen některá (ostatní ve stájích)
    } else a = state.night < 0.25 ? 1 : state.night < 0.7 ? 0.6 : 0.25;
    if (state.weather === 'rain') a *= 0.6;
    if (state.season === 'winter') a *= 0.7;
    return a;
  }
  function drawZvire(c, q, s, stoji, zpet, sx, ox, oy, night, vis) {
    const Z = ZV[c.zvire], L = c.len; let i = q.seg;
    while (i > 1 && L[i - 1] > s) i--; while (i < L.length - 1 && L[i] < s) i++; q.seg = i;
    const a = c.w[i - 1], b = c.w[i], u0 = Math.max(0, Math.min(1, (s - L[i - 1]) / ((L[i] - L[i - 1]) || 1)));
    const x = a[0] + (b[0] - a[0]) * u0, y = a[1] + (b[1] - a[1]) * u0, h = gz(x, y), p = toImg(x, y, h);
    if (!vis(p[0], p[1], 30)) return;
    CHODCI.stat.zkouseno++;
    if (occluded(p[0], p[1], depth(x, y, h))) { CHODCI.stat.dum++; return; }
    CHODCI.stat.kresleno++; CHODCI.stat.zvirata = (CHODCI.stat.zvirata || 0) + 1;
    if (!stoji) { const pb = toImg(b[0], b[1], h), pa = toImg(a[0], a[1], h); q.vlevo = ((pb[0] - pa[0]) < 0) !== zpet; }
    const top = toImg(x, y, h + 1.75 * ZV_ZVETS), u = Math.max(1, Math.round((p[1] - top[1]) * sx / 9));
    const [nh, nb, nf, nc] = Z.n, W = Math.max(...Z.t.map((r) => r.length)), H = Z.t.length + nh;
    const cw = W * u, chh = H * u;
    if (zvC.width !== cw || zvC.height !== chh) { zvC.width = cw; zvC.height = chh; }
    const g = zvC.getContext('2d'); g.clearRect(0, 0, cw, chh);
    const tma = night > 0.5 ? 0.55 : night > 0.25 ? 0.8 : 1;
    const barva = (hex) => tma === 1 ? hex : `rgb(${rgbOf(hex).map((v) => Math.round(v * tma)).join(',')})`;
    const B = (cx, cy, col) => { g.fillStyle = barva(Z.p[col]); g.fillRect((q.vlevo ? W - 1 - cx : cx) * u, cy * u, u, u); };
    Z.t.forEach((r, ry) => { for (let rx = 0; rx < r.length; rx++) if (r[rx] !== '.') B(rx, ry, r[rx]); });
    const krok = stoji ? 0 : Math.floor(s / 0.5) % 2;                  // nohy se střídají každého půl metru
    const nohy = krok ? [nb - 1, nb + 1, nf - 1, nf + 1] : [nb, nf];
    for (const nx of new Set(nohy)) if (nx >= 0 && nx < W) for (let k = 0; k < nh; k++) B(nx, Z.t.length + k, nc);
    const ix = p[0] - W / 2 * u / sx, iy = p[1] - H * u / sx, iw = cw / sx, ih = chh / sx;
    const klic = `${Math.round(x)},${Math.round(y)},${CHODCI.verze},${state.season},${u},${Math.round(sx * 20)}`;
    if (q.tvKlic !== klic) { q.tvKlic = klic; q.tv = treeShapes(x, y, h, [ix - 1, iy - 1, ix + iw + 1, iy + ih + 1]); }
    drawBehindTrees(zvC, ix, iy, iw, ih, x, y, h, sx, ox, oy, q.tv);
  }
  // ---------- loďky na řece (Pavel 2026-11-17): od přístavu proti proudu a zpět, duben–říjen přes den ----------
  // Trup se kreslí natočený podle směru plavby (body promítnuté jako auta): spodek tmavší, paluba o kus výš, kajuta;
  // za jedoucí lodí brázda. Rozměry ve skutečnosti (d × s m), zvětšené jako chodci (LOD_ZVETS).
  // pz: jak dlouho stojí u konce trasy (od–do s); osoba: kdo sedí v lodi bez kajuty (vodák, veslař, stojící rybář)
  const LODE_TYPY = {
    clun: { d: 6, s: 2.2, v: 3.2, pz: [60, 180], trup: '#f4f4f0', bok: '#c0392b', kab: '#2f5fa8' },      // výletní motorový člun
    pujcovna: { d: 4.5, s: 1.7, v: 2.6, pz: [60, 180], trup: '#e8c547', bok: '#8a6d1a', kab: '#f4f4f0' },  // malý člun z půjčovny
    kanoe: { d: 4.8, s: 0.9, v: 1.6, pz: [40, 120], trup: '#2f7d4f', bok: '#1d4a30', osoba: 'sedi', bunda: '#d8352a' },
    pramice: { d: 3.6, s: 1.4, v: 1.0, pz: [60, 200], trup: '#9a6a3e', bok: '#5a3a20', osoba: 'sedi', bunda: '#2f6fd1', vesla: true },
    rybar: { d: 3.6, s: 1.4, v: 0.5, pz: [500, 1100], trup: '#4f6b3a', bok: '#2f4024', osoba: 'stoji', bunda: '#5b6b45', prut: true },
  };
  let LOD_ZVETS = 1.6;
  const lodC = document.createElement('canvas');
  function lodeAktivita() {                                  // 0–1: kolik loděk je na vodě
    if (state.season === 'winter' || state.weather === 'snow') return 0;
    let a;
    if ($('realTime') && $('realTime').checked) {
      const m = new Date().getMonth(), h = pragueNow().s / 3600;
      if (m < 3 || m > 9) return 0;                          // plavební sezóna duben–říjen
      a = h >= 9 && h < 19 ? 1 : h >= 8 && h < 20.5 ? 0.5 : 0;
    } else a = state.night < 0.25 ? 1 : state.night < 0.5 ? 0.4 : 0;
    if (state.weather === 'rain') a *= 0.34;
    return a;
  }
  // kde je loďka v čase t: u přístavu pz s, pak plavba L/v, u horního konce pz s, zpět
  function lodPoloha(c, q, t) {
    const jizda = c.L / q.v, P = 2 * (q.pz + jizda), tau = (t + q.faze * P) % P;
    if (tau < q.pz) return { s: 0, stoji: true, smer: 1 };
    if (tau < q.pz + jizda) return { s: (tau - q.pz) * q.v, stoji: false, smer: 1 };
    if (tau < 2 * q.pz + jizda) return { s: c.L, stoji: true, smer: -1 };
    return { s: c.L - (tau - 2 * q.pz - jizda) * q.v, stoji: false, smer: -1 };
  }
  function drawLod(c, q, t, sx, ox, oy, night, vis) {
    const { s, stoji, smer } = lodPoloha(c, q, t), L = c.len; let i = q.seg;
    while (i > 1 && L[i - 1] > s) i--; while (i < L.length - 1 && L[i] < s) i++; q.seg = i;
    const a = c.w[i - 1], b = c.w[i], u0 = Math.max(0, Math.min(1, (s - L[i - 1]) / ((L[i] - L[i - 1]) || 1)));
    const dl = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, fx = (b[0] - a[0]) / dl * smer, fy = (b[1] - a[1]) / dl * smer;
    const rx = fy, ry = -fx, bok = c.o + (c.o >= 5 ? q.k * 3 : 0);       // vpravo ve směru plavby; na řece každá ve své stopě
    const x = a[0] + (b[0] - a[0]) * u0 + rx * bok, y = a[1] + (b[1] - a[1]) * u0 + ry * bok, h = gz(x, y), p = toImg(x, y, h);
    if (!vis(p[0], p[1], 60)) return;
    const T = q.typ, K = LOD_ZVETS;
    const P = (al, la, z) => toImg(x + (fx * al + rx * la) * K, y + (fy * al + ry * la) * K, h + z * K);
    const d2 = T.d / 2, s2 = T.s / 2;
    const obrys = (z, k = 1) => [[-d2, -s2 * k], [d2 / 2, -s2 * k], [d2, 0], [d2 / 2, s2 * k], [-d2, s2 * k]].map(([al, la]) => P(al * k, la, z));
    if (!stoji && q.v > 1.2) {                                            // brázda: úzké V za zádí, ke konci slábne (pramice a rybář jedou moc pomalu)
      ctx.lineWidth = Math.max(1, sx * 1.2);
      for (const [od, po, al] of [[0, 5, 0.55], [5, 11, 0.28]]) {
        ctx.strokeStyle = `rgba(255,255,255,${al})`; ctx.beginPath();
        for (const st of [-1, 1]) {
          const z0 = P(-d2 - od, st * (s2 * 0.8 + od * 0.18), 0), z1 = P(-d2 - po, st * (s2 * 0.8 + po * 0.18), 0);
          ctx.moveTo(ox + z0[0] * sx, oy + z0[1] * sx); ctx.lineTo(ox + z1[0] * sx, oy + z1[1] * sx);
        }
        ctx.stroke();
      }
    }
    const dily = [[obrys(0), T.bok], [obrys(0.45), T.trup]];
    const cary = [];                                                      // tenké čáry: vesla, prut
    if (T.osoba) {                                                        // člověk nad středem: sedí (trup do 1,1 m), nebo stojí (1,7 m)
      const vys = T.osoba === 'stoji' ? 1.5 : 1.1, al0 = T.vesla ? -0.3 : 0;
      dily.push([[P(al0 - 0.25, -0.2, 0.45), P(al0 + 0.25, -0.2, 0.45), P(al0 + 0.25, 0.2, vys), P(al0 - 0.25, 0.2, vys)], T.bunda],
                [[P(al0 - 0.15, -0.12, vys), P(al0 + 0.15, -0.12, vys), P(al0 + 0.15, 0.12, vys + 0.3), P(al0 - 0.15, 0.12, vys + 0.3)], '#e4b48d']);
      if (T.vesla) {                                                      // vesla do stran, při plavbě se kývají
        const kmit = stoji ? 0 : Math.sin(t * 3.2 + q.k) * 0.5;
        for (const st of [-1, 1]) cary.push([P(al0, st * 0.6, 0.7), P(al0 + kmit, st * 1.6, 0.4)], [P(al0 + kmit, st * 1.6, 0.4), P(al0 + kmit - 0.1, st * 2.1, 0.05)]);
      }
      if (T.prut) cary.push([P(al0 + 0.1, 0.2, vys), P(al0 + 1.2, 1.4, vys + 1.6)], [P(al0 + 1.2, 1.4, vys + 1.6), P(al0 + 1.6, 1.9, 0)]);   // prut a vlasec
    } else {                                                              // kajuta s předním sklem
      const kab = (z) => [[-d2 * 0.4, -s2 * 0.55], [d2 * 0.15, -s2 * 0.55], [d2 * 0.15, s2 * 0.55], [-d2 * 0.4, s2 * 0.55]].map(([al, la]) => P(al, la, z));
      dily.push([kab(0.45), T.kab], [kab(1.25), T.kab], [[P(d2 * 0.15, -s2 * 0.55, 0.6), P(d2 * 0.15, s2 * 0.55, 0.6), P(d2 * 0.15, s2 * 0.55, 1.25), P(d2 * 0.15, -s2 * 0.55, 1.25)], '#9fc3e0']);
    }
    const vse = [...dily.flatMap(([pts]) => pts), ...cary.flat()], ix = Math.min(...vse.map((v) => v[0])) - 1, iy = Math.min(...vse.map((v) => v[1])) - 1;
    const iw = Math.max(...vse.map((v) => v[0])) + 1 - ix, ih = Math.max(...vse.map((v) => v[1])) + 1 - iy;
    const cw = Math.max(1, Math.round(iw * sx)), chh = Math.max(1, Math.round(ih * sx));
    if (lodC.width !== cw || lodC.height !== chh) { lodC.width = cw; lodC.height = chh; }
    const g = lodC.getContext('2d'); g.clearRect(0, 0, cw, chh);
    const tma = night > 0.5 ? 0.55 : night > 0.25 ? 0.8 : 1;
    const barva = (hex) => tma === 1 ? hex : `rgb(${rgbOf(hex).map((v) => Math.round(v * tma)).join(',')})`;
    for (const [pts, col] of dily) {
      g.fillStyle = barva(col); g.beginPath();
      pts.forEach(([px, py], k) => (k ? g.lineTo : g.moveTo).call(g, (px - ix) * sx, (py - iy) * sx));
      g.closePath(); g.fill();
    }
    if (cary.length) {                                                    // vesla a prut: tmavé dřevo, vlasec světlejší
      g.lineWidth = Math.max(1, sx * 0.25);
      cary.forEach(([a1, b1], k) => {
        g.strokeStyle = barva(T.prut && k === 1 ? '#d9d4c7' : '#4a3424'); g.beginPath();
        g.moveTo((a1[0] - ix) * sx, (a1[1] - iy) * sx); g.lineTo((b1[0] - ix) * sx, (b1[1] - iy) * sx); g.stroke();
      });
    }
    if (night > 0.3) { const sv = P(d2 * 0.8, 0, 0.9); g.fillStyle = '#fff6d0'; g.fillRect((sv[0] - ix) * sx - 1, (sv[1] - iy) * sx - 1, 2, 2); }
    drawBehindTrees(lodC, ix, iy, iw, ih, x, y, h, sx, ox, oy);
  }
  // ---------- výjezdy hasičů (mesto.json "hasici", functions/api/hasici.js) za posledních N dní, jen v sekci Dnes ----------
  // bez prostředníka (jiný hosting než Cloudflare) se po první neúspěšné odpovědi přestane ptát, stejně jako letadla
  const HZ = { list: [], ok: false, stop: false, zdroj: 'https://udalosti.firebrno.cz/' };
  const HZ_IKONY = {                                        // Lucide (ISC): flame, car-front, droplet, wrench, life-buoy, siren; ikonky v sekci Dnes
    3100: '<path d="M12 3q1 4 4 6.5t3 5.5a1 1 0 0 1-14 0 5 5 0 0 1 1-3 1 1 0 0 0 5 0c0-2-1.5-3-1.5-5q0-2 2.5-4"/>',
    3200: '<path d="m21 8-2 2-1.5-3.7A2 2 0 0 0 15.646 5H8.4a2 2 0 0 0-1.903 1.257L5 10 3 8"/><path d="M7 14h.01"/><path d="M17 14h.01"/><rect width="18" height="8" x="3" y="10" rx="2"/><path d="M5 18v2"/><path d="M19 18v2"/>',
    3400: '<path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/>',
    3500: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.106-3.105c.32-.322.863-.22.983.218a6 6 0 0 1-8.259 7.057l-7.91 7.91a1 1 0 0 1-2.999-3l7.91-7.91a6 6 0 0 1 7.057-8.259c.438.12.54.662.219.984z"/>',
    3550: '<circle cx="12" cy="12" r="10"/><path d="m4.93 4.93 4.24 4.24"/><path d="m14.83 9.17 4.24-4.24"/><path d="m14.83 14.83 4.24 4.24"/><path d="m9.17 14.83-4.24 4.24"/><circle cx="12" cy="12" r="4"/>',
    x: '<path d="M7 18v-6a5 5 0 1 1 10 0v6"/><path d="M5 21a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-1a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2z"/><path d="M21 12h1"/><path d="M18.5 4.5 18 5"/><path d="M2 12h1"/><path d="M12 2v1"/><path d="m4.929 4.929.707.707"/><path d="M12 12v6"/>',
  };
  const hzSvg = (typ) => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
    + (HZ_IKONY[typ] || HZ_IKONY.x).replace(/\/>/g, ' vector-effect="non-scaling-stroke"/>') + '</svg>';
  const kdy = (iso) => {                                    // „dnes 19:17“, „včera 6:39“, „pá 13. 11. 9:47“
    const d = new Date(iso), den = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
    const r = Math.round((den(new Date()) - den(d)) / 86400e3), hm = `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
    return r === 0 ? `dnes ${hm}` : r === 1 ? `včera ${hm}` : `${DNY[d.getDay()]} ${d.getDate()}. ${d.getMonth() + 1}. ${hm}`;
  };
  const geoImg = (lat, lon) => { const x = (lon - cam.lon0) * cam.kx, y = (lat - cam.lat0) * cam.ky; return [x, y, ...toImg(x, y, gz(x, y))]; };
  async function hasiciNacti() {
    if (!HASICI_CFG || HZ.stop || document.hidden) return;
    // jen přímo z prohlížeče (HZS dovoluje CORS). Záloha přes náš server (functions/api/hasici.js) vypuštěna 2026-11-19:
    // z Cloudflaru se k HZS nedostane, po 19 s vracela 502 a chybu v konzoli (napady/PAGESPEED-2026-11-19.md, bod 1)
    const primo = async () => {
      const m = await import(`./hasici_data.js?s=${SEST}`);
      const r = await fetch(m.dotaz(HASICI_CFG.kraj, HASICI_CFG.okres, HASICI_CFG.dni || 7), { signal: AbortSignal.timeout(10000) });
      return r.ok ? { udalosti: m.preved(await r.json()), zdroj: m.ZDROJ } : null;
    };
    const d = await primo().catch(() => null);
    if (!d || !Array.isArray(d.udalosti)) { if (!HZ.ok) HZ.stop = true; return; }
    HZ.ok = true; if (d.zdroj) HZ.zdroj = d.zdroj;
    // jen ve vykreslených čtvercích mapy (stejně jako letadla). Ikonky v mapě a vrstva zrušené (Pavel 2026-11-18),
    // výjezdy ukazuje jen sekce Dnes (klik otevře kartu na místě zásahu)
    HZ.list = d.udalosti.map((u) => ({ u, p: geoImg(u.lat, u.lon) }))
      .filter(({ p }) => cam.grounds.some((q) => Math.abs(p[0] - q.cx) <= cam.half && Math.abs(p[1] - q.cy) <= cam.half))
      .sort((a, b) => (a.u.probiha - b.u.probiha) || new Date(a.u.cas) - new Date(b.u.cas)).map(({ u }) => u);
    dnesRender();
  }
  function showHasici(u) {
    state.sel = null;
    showCard({ title: u.typ, text: u.popis, lat: u.lat, lon: u.lon, kind: 4,
      rows: [['Ohlášeno', kdy(u.cas)], ['Stav', u.probiha ? 'probíhá zásah' : 'ukončeno'], ['Místo', [u.ulice, u.obec].filter(Boolean).join(', ')]],
      extra: [[HZ.zdroj, 'Přehled událostí HZS JMK']] });
  }
  function hasiciStart() { if (!HASICI_CFG) return; hasiciNacti(); setInterval(hasiciNacti, 60e3); }

  // ---------- výluky (mesto.json "vyluky", functions/api/vyluky.js): seznam v panelu, lišta nahoře, upozornění v kartě ----------
  // týká se mapy, když jde o linku, která po mapě jezdí (náhradní „xS91“ = S91), nebo název zmiňuje město
  const VYL = { list: [], rel: [], stop: false };
  const linka = (s) => String(s).trim().replace(/^x/i, '').toUpperCase();
  const vylDen = (iso) => { const d = new Date(iso); return `${d.getDate()}. ${d.getMonth() + 1}.`; };
  const vylKdy = (v) => (v.probiha ? (v.do ? `teď, do ${vylDen(v.do)}` : 'teď') : `od ${vylDen(v.od)}${v.do ? ` do ${vylDen(v.do)}` : ''}`);
  const vylLinky = (l) => (l.length ? `${l.length > 1 ? 'linky' : 'linka'} ${l.join(', ')}` : '');
  const odkaz = (href, text) => { const a = document.createElement('a'); a.href = href; a.target = '_blank'; a.rel = 'noopener'; a.textContent = text; return a; };
  async function vylukyNacti() {
    if (!VYLUKY_CFG || VYL.stop) return;
    const d = await fetch(`api/vyluky?oblast=${encodeURIComponent(VYLUKY_CFG.oblast)}`).then((r) => (r.ok ? r.json() : null)).catch(() => null);
    if (!d || !Array.isArray(d.vyluky)) { if (!VYL.list.length) VYL.stop = true; return; }
    VYL.list = d.vyluky; vylukyRender();
  }
  function vylukyRender() {
    const naMape = new Set((MHD.routes || []).map((r) => linka(r[0])));
    VYL.rel = VYL.list.map((v) => ({ ...v, naMape: [...new Set(v.linky.filter((l) => naMape.has(linka(l))).map(linka))] }))
      .filter((v) => v.naMape.length || (VYLUKY_CFG.mesto && v.nazev.includes(VYLUKY_CFG.mesto)));
    vylBoxRender();
    dnesRender();                                           // probíhající a zítřejší výluky jsou v přehledu Dnes („Ve městě“)
  }
  // výluka, kterou ukazuje seznam „Ve městě“ v sekci Dnes: probíhá, nebo začne dnes či zítra
  function vylVDnes(v) { const d0 = new Date(); d0.setHours(0, 0, 0, 0); return v.probiha || new Date(v.od).getTime() < d0.getTime() + 2 * 86400e3; }
  // blok pod přehledem Dnes: jen výluky, které v něm ještě nejsou (Pavel 2026-11-18: „zbytečně duplikujeme výluky“);
  // bez přehledu Dnes (mesto.json bez "dnes") všechny. Volá ho i dnesRender, ať se po půlnoci přesunou.
  function vylBoxRender() {
    const vs = DNES_CFG ? VYL.rel.filter((v) => !vylVDnes(v)) : VYL.rel;
    $('vylukyBox').hidden = !vs.length; $('vylukyN').textContent = vs.length ? `(${vs.length})` : '';
    $('vylukyNadpis').textContent = DNES_CFG ? 'Chystané výluky' : 'Výluky';
    $('vyluky').replaceChildren(...vs.map((v) => {
      const li = document.createElement('li'), k = document.createElement('span'); k.className = 'kdy';
      k.textContent = [vylKdy(v), vylLinky(v.naMape)].filter(Boolean).join(' · ');
      li.append(odkaz(v.url, v.nazev), k); return li;
    }));
  }
  const vylukyLinek = (linky) => VYL.rel.filter((v) => v.naMape.some((l) => linky.has(l)));
  function vylukaVKarte(linky) {                            // karta zastávky: výluky linek, které tu staví
    const vs = vylukyLinek(linky); if (!vs.length) return;
    $('cardVyl').replaceChildren(...vs.map((v) => {
      const p = document.createElement('div'); p.append(`⚠️ ${vylLinky(v.naMape.filter((l) => linky.has(l)))}: `, odkaz(v.url, v.nazev), ` (${vylKdy(v)})`); return p;
    }));
    $('cardVyl').hidden = false;
  }
  if (VYLUKY_CFG) { vylukyNacti(); setInterval(vylukyNacti, 600e3); }

  // ---------- Dnes v <městě> (mesto.json "dnes": {"nadpis": "Dnes v Hodoníně"}): co se dnes a zítra děje ----------
  // skládá se z toho, co mapa už má: počasí (Open-Meteo), zásahy hasičů v mapě, výluky, program míst (mista.json "program");
  // seznam v panelu a lišta nahoře, kde se zprávy střídají po 6 s; klik najede na místo a otevře kartu. Lištu jde skrýt do zítřka.
  const DNES_CFG = {{DNES}};
  const D_IKONY = {                                         // Lucide (ISC): cloud-sun, triangle-alert, drama
    pocasi: '<path d="M12 2v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="M20 12h2"/><path d="m19.07 4.93-1.41 1.41"/><path d="M15.947 12.65a4 4 0 0 0-5.925-4.128"/><path d="M13 22H7a5 5 0 1 1 4.9-6H13a3 3 0 0 1 0 6Z"/>',
    vyluka: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
    program: '<path d="M10 11h.01"/><path d="M14 6h.01"/><path d="M18 6h.01"/><path d="M6.5 13.1h.01"/><path d="M22 5c0 9-4 12-6 12s-6-3-6-12c0-2 2-3 6-3s6 1 6 3"/><path d="M17.4 9.9c-.8.8-2 .8-2.8 0"/><path d="M10.1 7.1C9 7.2 7.7 7.7 6 8.6c-3.5 2-4.7 3.9-3.7 5.6 4.5 7.8 9.5 8.4 11.2 7.4.9-.5 1.9-2.1 1.9-4.7"/><path d="M9.1 16.5c.3-1.1 1.4-1.7 2.4-1.4"/>',
  };
  const dSvg = (k) => (D_IKONY[k] ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
    + D_IKONY[k].replace(/\/>/g, ' vector-effect="non-scaling-stroke"/>') + '</svg>' : hzSvg(k));
  const DNES = { pocasi: null, program: [], polozky: [] };
  // počasí slovy podle kódu WMO (Open-Meteo)
  const WMO = (c) => (c === 0 ? 'jasno' : c === 1 ? 'skoro jasno' : c === 2 ? 'polojasno' : c === 3 ? 'zataženo' : c <= 48 ? 'mlha' : c <= 57 ? 'mrholení'
    : c <= 67 ? 'déšť' : c <= 77 ? 'sněžení' : c <= 82 ? 'přeháňky' : c <= 86 ? 'sněhové přeháňky' : 'bouřka');
  const stupne = (v) => String(Math.round(v)).replace('-', '−');
  // počasí v sekci Dnes (Pavel 2026-11-16: „větší, s ikonkami a předpovědí“): teď velkým písmem, pak 5 sloupců po 2 hodinách
  // a 5 sloupců na další dny (Pavel 2026-11-20: 5 místo 6) (stejná mřížka, sloupce pod sebou). Ikonky Lucide (ISC), barva podle druhu počasí.
  const PC_IK = {
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>',
    moon: '<path d="M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401"/>',
    'cloud-sun': '<path d="M12 2v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="M20 12h2"/><path d="m19.07 4.93-1.41 1.41"/><path d="M15.947 12.65a4 4 0 0 0-5.925-4.128"/><path d="M13 22H7a5 5 0 1 1 4.9-6H13a3 3 0 0 1 0 6Z"/>',
    'cloud-moon': '<path d="M13 16a3 3 0 0 1 0 6H7a5 5 0 1 1 4.9-6z"/><path d="M18.376 14.512a6 6 0 0 0 3.461-4.127c.148-.625-.659-.97-1.248-.714a4 4 0 0 1-5.259-5.26c.255-.589-.09-1.395-.716-1.248a6 6 0 0 0-4.594 5.36"/>',
    cloud: '<path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/>',
    'cloud-fog': '<path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"/><path d="M16 17H7"/><path d="M17 21H9"/>',
    'cloud-drizzle': '<path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"/><path d="M8 19v1"/><path d="M8 14v1"/><path d="M16 19v1"/><path d="M16 14v1"/><path d="M12 21v1"/><path d="M12 16v1"/>',
    'cloud-rain': '<path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"/><path d="M16 14v6"/><path d="M8 14v6"/><path d="M12 16v6"/>',
    'cloud-snow': '<path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"/><path d="M8 15h.01"/><path d="M8 19h.01"/><path d="M12 17h.01"/><path d="M12 21h.01"/><path d="M16 15h.01"/><path d="M16 19h.01"/>',
    'cloud-lightning': '<path d="M6 16.326A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 .5 8.973"/><path d="m13 12-3 5h4l-3 5"/>',
  };
  const pcIk = (c, den = true) => (c === 0 ? (den ? 'sun' : 'moon') : c <= 2 ? (den ? 'cloud-sun' : 'cloud-moon') : c === 3 ? 'cloud' : c <= 48 ? 'cloud-fog'
    : c <= 57 ? 'cloud-drizzle' : c <= 67 || (c >= 80 && c <= 82) ? 'cloud-rain' : c <= 86 ? 'cloud-snow' : 'cloud-lightning');
  const pcSvg = (c, den) => { const k = pcIk(c, den); return `<span class="pc-ik pc-${k}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">`
    + PC_IK[k].replace(/\/>/g, ' vector-effect="non-scaling-stroke"/>') + '</svg></span>'; };
  const DNY_KR = ['Ne', 'Po', 'Út', 'St', 'Čt', 'Pá', 'So'];
  async function dnesPocasi() {
    const d = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${OV.cam.lat0}&longitude=${OV.cam.lon0}`
      + '&current=temperature_2m,apparent_temperature,weather_code,is_day,wind_speed_10m'
      + '&hourly=temperature_2m,weather_code,precipitation_probability,is_day'
      + '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=Europe%2FPrague&forecast_days=7')
      .then((r) => (r.ok ? r.json() : null)).catch(() => null);
    if (!d || !d.current || !d.daily || !d.hourly) return;
    DNES.pocasi = d;
    dnesRender();
  }
  function pocasiRender() {
    const box = $('dnesPocasi'), d = DNES.pocasi;
    box.hidden = !d; if (!d) return;
    const c = d.current, dy = d.daily, h = d.hourly;
    const sr = dy.precipitation_probability_max[0];
    // hodiny: od příští celé hodiny po 2 h (časy z Open-Meteo jsou místní, bez zóny)
    const ted = new Date(), od = h.time.findIndex((t) => new Date(t) > ted);
    const hod = od < 0 ? [] : [0, 2, 4, 6, 8].map((i) => od + i).filter((i) => i < h.time.length);   // 5 bloků (Pavel 2026-11-20)
    const srazky = (p) => (p >= 30 ? `${p}&nbsp;%` : '');
    const maSr = hod.some((i) => h.precipitation_probability[i] >= 30), maSrD = dy.time.slice(1, 6).some((_, j) => dy.precipitation_probability_max[j + 1] >= 30);
    const bunka = (popis, ik, t1, t2, s, sMa) => `<li><span class="pc-kdy">${popis}</span>${ik}<b>${t1}</b>${t2 != null ? `<span class="pc-min">${t2}</span>` : ''}${sMa ? `<span class="pc-sr">${s || '&nbsp;'}</span>` : ''}</li>`;
    box.innerHTML = `<div class="pc-ted">${pcSvg(c.weather_code, !!c.is_day)}
        <div class="pc-hlavni"><span class="pc-teplota">${stupne(c.temperature_2m)}&nbsp;°C</span><span class="pc-slovy">${WMO(c.weather_code)}</span></div></div>
      <p class="pc-detail"><span>pocitově ${stupne(c.apparent_temperature)}&nbsp;°C</span><span>vítr ${Math.round(c.wind_speed_10m)}&nbsp;km/h</span>
        <span>dnes ${stupne(dy.temperature_2m_min[0])} až ${stupne(dy.temperature_2m_max[0])}&nbsp;°C</span>${sr >= 30 ? `<span class="pc-sr">srážky ${sr}&nbsp;%</span>` : ''}</p>
      <p class="label pc-nadpis">Během dne</p>
      <ol class="pc-rada">${hod.map((i) => bunka(`${new Date(h.time[i]).getHours()}:00`, pcSvg(h.weather_code[i], !!h.is_day[i]), `${stupne(h.temperature_2m[i])}°`, null, srazky(h.precipitation_probability[i]), maSr)).join('')}</ol>
      <p class="label pc-nadpis">Další dny</p>
      <ol class="pc-rada">${dy.time.slice(1, 6).map((t, j) => { const i = j + 1, den = new Date(t);
        return bunka(j === 0 ? 'Zítra' : DNY_KR[den.getDay()], pcSvg(dy.weather_code[i], true), `${stupne(dy.temperature_2m_max[i])}°`, `${stupne(dy.temperature_2m_min[i])}°`, srazky(dy.precipitation_probability_max[i]), maSrD); }).join('')}</ol>`;
  }
  async function dnesProgram() {
    const out = [], souhrn = [];
    for (const p of OV.places.filter((q) => q.program)) { const d = await programAkce(p.program); if (d) for (const a of d.akce) out.push({ ...a, misto: p }); }
    // veřejná místa s programem (Kino Svět, Pavel 2026-11-20): denně několik představení, proto jedna souhrnná položka
    for (const v of VEREJNA.filter((q) => q.program)) { const d = await programAkce(v.program); if (d) souhrn.push({ misto: v, akce: d.akce }); }
    DNES.program = out; DNES.souhrn = souhrn; dnesRender();
  }
  const filmu = (n) => `${n} ${n === 1 ? 'film' : n < 5 ? 'filmy' : 'filmů'}`;
  const hodiny = (t) => { const d = new Date(t); return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`; };
  function dnesPolozky() {
    const d0 = new Date(); d0.setHours(0, 0, 0, 0);
    const zitra = d0.getTime() + 86400e3, pozitri = zitra + 86400e3, out = [];
    for (const u of HZ.list) {
      const t = new Date(u.cas).getTime();
      if (u.probiha || t >= d0.getTime()) out.push({ ik: u.typId, zive: u.probiha, text: `${u.typ}${u.ulice ? `, ${u.ulice}` : ''}`, cas: u.probiha ? 'probíhá' : kdy(u.cas), poradi: u.probiha ? 1 : 3, t: -t,
        akce: () => { const p = geoImg(u.lat, u.lon); goTo(p[2], p[3], 1.4); showHasici(u); } });
    }
    for (const v of VYL.rel) if (vylVDnes(v)) out.push({ ik: 'vyluka', text: v.nazev, cas: vylKdy(v), poradi: v.probiha ? 2 : 5, t: new Date(v.od).getTime(),
      akce: () => window.open(v.url, '_blank', 'noopener') });
    for (const a of DNES.program) if (a.t0 < pozitri && (a.t0 >= Date.now() - 3 * 3600e3)) out.push({ ik: 'program', text: a.nazev, misto: a.misto.name, poradi: 4, t: a.t0,
      cas: `${a.t0 < zitra ? 'dnes' : 'zítra'} ${hodiny(a.t0)}`, akce: () => { goTo(a.misto.xy[0], a.misto.xy[1], 1.4); placeCard(a.misto); } });
    for (const { misto: v, akce } of DNES.souhrn || []) {      // „4 filmy dnes · Kino Svět · od 16:50“; když dnes už nic, zítřek
      const ted = Date.now(), dnes = akce.filter((a) => a.t0 >= ted - 15 * 60e3 && a.t0 < zitra), zit = akce.filter((a) => a.t0 >= zitra && a.t0 < pozitri);
      const [kdy, ak] = dnes.length ? ['dnes', dnes] : ['zítra', zit];
      if (!ak.length) continue;
      out.push({ ik: 'program', text: `${filmu(ak.length)} ${kdy}`, misto: v.nazev, poradi: 4, t: ak[0].t0, cas: `od ${hodiny(ak[0].t0)}`,
        akce: () => { const p = geoImg(v.lat, v.lon); goTo(p[2], p[3], 1.4); showVerejne(v); } });
    }
    return out.sort((a, b) => a.poradi - b.poradi || a.t - b.t);
  }
  const dnesDen = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
  function dnesRender() {
    if (!DNES_CFG) return;
    if (VYL.rel.length) vylBoxRender();
    const pol = DNES.polozky = dnesPolozky();
    $('dnesBox').hidden = !pol.length && !DNES.pocasi;
    pocasiRender();                                         // „během dne“ se posouvá s časem (dnesRender běží každou minutu)
    $('dnes').hidden = !pol.length; $('dnesUdalosti').hidden = !pol.length || !DNES.pocasi;
    $('dnes').replaceChildren(...pol.map((x) => {
      const li = document.createElement('li'), b = document.createElement('button'); b.type = 'button';
      const ic = document.createElement('span'); ic.className = 'dnes-ico' + (x.zive ? ' zive' : '') + (x.ik === 'vyluka' ? ' vyluka' : ''); ic.innerHTML = dSvg(x.ik);
      if (x.ik === 'program' && KAT.kultura) { ic.classList.add('kat'); ic.style.setProperty('--kat', KAT.kultura.barva); }
      const tx = document.createElement('span'); tx.textContent = x.text;
      if (x.misto) { const m = document.createElement('span'); m.className = 'misto'; m.textContent = x.misto; tx.append(m); }
      const tm = document.createElement('time'); tm.textContent = x.cas || '';
      b.append(ic, tx, tm);
      if (x.akce) b.addEventListener('click', x.akce); else b.disabled = true;
      li.append(b); return li;
    }));
  }
  if (DNES_CFG) {
    $('dnesNadpis').textContent = DNES_CFG.nadpis || 'Dnes';
    dnesPocasi(); setInterval(dnesPocasi, 30 * 60e3);
    dnesProgram(); setInterval(dnesProgram, 3600e3);
    setInterval(dnesRender, 60e3);                          // „dnes 19:00“ → „probíhá“, půlnoc
  }

  if (location.hostname === 'localhost') window.__izo = { ULICE, W, HZ, VYL, showHasici, vylukyRender, showStop, trams, skiers, MHD, LIVE, showBuilding, showPamatka, PAMATKY, placeCard, PLACES: OV.places, showPodnik, PODNIKY, VEREJNA, showVerejne, budovaMista, verOteviraci, ohParse, ohTed, townRect, viewer, CHODCI, chodciAktivita, mhdActive, mhdPos, cars, roads, along: (r, s) => along(r, s), XC, busWait, ringFree: (g) => ringFree(g), get planes() { return PLANES; }, pribehu: OV.places.length, sestaveni: SEST,
    // video (nastroje-pavel/video.mjs): bod obrazu ze zeměpisných souřadnic, roční období, počasí, stav
    w2img: (x, y) => toImg(x, y, gz(x, y)), set zvZvets(v) { ZV_ZVETS = v; }, set lodZvets(v) { LOD_ZVETS = v; },
    omezeniZbyva: () => { const vp = viewer.viewport, b = vp.getBounds(true), c = vp.getCenter(true), q = clampCenter(c); return Math.hypot(q.x - c.x, q.y - c.y) * vp.getContainerSize().x / b.width; },
    ll2img: (lat, lon) => { const x = (lon - cam.lon0) * cam.kx, y = (lat - cam.lat0) * cam.ky; return toImg(x, y, gz(x, y)); }, W, setSeason, setWeather, state };       // ladění v lokálním náhledu
  function drawSkier(q, sx, ox, oy) {
    const L = q.r.len; let i = 1; while (i < L.length - 1 && L[i] < q.s) i++;
    const a = q.r.w[i - 1], b = q.r.w[i], t = Math.max(0, Math.min(1, (q.s - L[i - 1]) / ((L[i] - L[i - 1]) || 1)));
    const dx = b[0] - a[0], dy = b[1] - a[1], dl = Math.hypot(dx, dy) || 1, ph = q.s / q.wl * Math.PI * 2 + q.ph, off = Math.sin(ph) * q.amp;
    const x = a[0] + dx * t - dy / dl * off, y = a[1] + dy * t + dx / dl * off, h = gz(x, y);
    const p = toImg(x, y, h);
    if (occluded(p[0], p[1], depth(x, y, h))) return;
    for (const q of treeShapes(x, y, h, [p[0] - 1, p[1] - 9, p[0] + 1, p[1]]))
      if (q[0] === 1 ? ((p[0] - q[1][0]) / q[2]) ** 2 + ((p[1] - 4 - q[1][1]) / q[3]) ** 2 < 1 : p[1] - 4 > q[1][1] && p[1] - 4 < q[2][1] && Math.abs(p[0] - q[1][0]) < q[3] * (p[1] - 4 - q[1][1]) / (q[2][1] - q[1][1])) return;
    const top = toImg(x, y, h + 1.8), u = Math.max(1, Math.round((p[1] - top[1]) * sx / 8));
    const X = Math.round(ox + p[0] * sx), Y = Math.round(oy + p[1] * sx), lean = Math.cos(ph) > 0 ? 1 : -1;
    const R = (cx, cy, w, hh, c) => { ctx.fillStyle = c; ctx.fillRect(X + cx * u, Y - cy * u, w * u, hh * u); };
    R(-3, 1, 6, 1, '#2a2c31');                         // lyže
    R(-1, 3, 2, 2, '#2a2c31');                         // nohy
    R(-1 + (lean > 0 ? 0 : -1), 6, 3, 3, q.col);       // bunda, předklon do oblouku
    R(lean > 0 ? 0 : -1, 7, 2, 1, '#e8c6a4');          // obličej
    R(lean > 0 ? 0 : -1, 8, 2, 1, q.hat);              // čepice
    R(lean > 0 ? 2 : -3, 4, 1, 3, '#9aa0a8');          // hůlka
  }
