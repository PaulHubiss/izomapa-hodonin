// Doplněk „Santa se soby“ (Pavel 2026-11-20): v zimní mapě
// přeletí Santa na saních se třemi soby (vpředu Rudolf se svítícím nosem) přes právě zobrazený výřez mapy, po pauze znovu.
// Za saněmi třpytivá stopa, na zemi stín (jako u letadel), občas pustí dárek, který dopadne do komína (komíny z overlay_hook.py).
// Kliknutí na saně zapne sledování kamerou (lišta nahoře, × nebo tažení mapy ho vypne), při sledování Santa létá dál a zatáčí.
// Kresba: pixel art z obdélníčků, jeden bod = 0,3 m (o něco větší než skutečnost, jako chodci), celé násobky pixelu = ostré.
(() => {
  const ID = 'santa';
  const Izomapa = window.Izomapa;
  if (!Izomapa) return;

  // ---------- kresba: saně + 3 sobi, pohled z boku, směr doprava; 2 fáze cvalu ----------
  const BOD = 0.3;                                   // m na bod kresby
  const SW = 59, SH = 18;                            // rozměr kresby v bodech
  const C = { R: '#c8202a', r: '#8e1218', G: '#e8b030', g: '#a87818', W: '#f6f4ee', w: '#cfd3da', F: '#f0c39a', K: '#1c1a1e',
    B: '#7a4a26', b: '#55321a', D: '#8a5a32', d: '#5e3a1e', L: '#c99a68', A: '#4a2e18', N: '#ff2a2a', n: '#2a1a12' };
  const NOS = [57, 5];                               // Rudolfův nos v bodech kresby (pro záři)
  const ZAD = [0, 11];                               // záď saní (odtud třpytivá stopa)

  function kresba(faze) {
    const c = document.createElement('canvas'); c.width = SW; c.height = SH;
    const g = c.getContext('2d');
    const p = (x, y, w, h, k) => { g.fillStyle = C[k]; g.fillRect(x, y, w, h); };
    // pytel s dárky
    p(1, 4, 5, 6, 'B'); p(2, 3, 3, 1, 'B'); p(2, 4, 3, 1, 'b'); p(1, 9, 5, 1, 'b'); p(3, 2, 1, 1, 'G');
    // Santa: čepice, obličej, vousy, kabát, paže k otěžím
    p(8, 0, 1, 1, 'W'); p(8, 1, 3, 1, 'R'); p(9, 2, 3, 1, 'R'); p(8, 3, 5, 1, 'W');
    p(9, 4, 3, 1, 'F'); p(11, 4, 1, 1, 'K');
    p(8, 5, 5, 2, 'W'); p(9, 7, 3, 1, 'W'); p(10, 5, 2, 1, 'F');
    p(7, 6, 1, 4, 'R'); p(8, 7, 1, 3, 'R'); p(12, 7, 1, 3, 'R'); p(9, 8, 3, 2, 'R'); p(10, 8, 1, 2, 'W');
    p(13, 7, 2, 1, 'R'); p(15, 7, 1, 1, 'K');
    // saně: korba, zvednutá příď, zlatá lišta, stín
    p(0, 9, 16, 5, 'R'); p(0, 6, 2, 4, 'R'); p(14, 5, 3, 5, 'R'); p(15, 4, 2, 1, 'R');
    p(1, 10, 14, 1, 'G'); p(14, 4, 1, 1, 'G'); p(17, 4, 1, 2, 'G'); p(0, 13, 16, 1, 'r'); p(0, 9, 1, 4, 'r');
    // ližiny
    p(3, 14, 1, 2, 'g'); p(11, 14, 1, 2, 'g'); p(0, 16, 18, 1, 'G'); p(18, 15, 1, 1, 'G'); p(19, 14, 1, 1, 'G');
    // otěže od Santy k sobům (zlatá čára)
    for (let x = 16; x < 50; x++) p(x, 7 + Math.round((x - 16) * 0.02), 1, 1, 'g');
    // sobi
    const sob = (ox, f, rudolf) => {
      p(ox + 1, 7, 8, 4, 'D'); p(ox + 2, 10, 6, 1, 'L'); p(ox, 7, 1, 1, 'W');        // tělo, světlé bříško, ocásek
      p(ox + 6, 7, 1, 4, 'G');                                                         // postroj
      p(ox + 8, 5, 2, 3, 'D'); p(ox + 9, 4, 3, 2, 'D'); p(ox + 12, 5, 1, 1, 'D');      // krk, hlava, čenich
      p(ox + 12, 5, 1, 1, rudolf ? 'N' : 'n'); p(ox + 10, 4, 1, 1, 'K');                // nos, oko
      p(ox + 9, 2, 1, 2, 'A'); p(ox + 8, 1, 1, 1, 'A'); p(ox + 10, 1, 1, 1, 'A'); p(ox + 11, 2, 1, 1, 'A');   // parohy
      p(ox + 1, 8, 1, 2, 'd');                                                         // stín na zadku
      if (f) { p(ox + 8, 11, 1, 2, 'd'); p(ox + 9, 13, 1, 1, 'd'); p(ox + 1, 11, 1, 2, 'd'); p(ox, 13, 1, 1, 'd'); }   // natažené nohy
      else { p(ox + 7, 11, 1, 2, 'd'); p(ox + 7, 13, 1, 1, 'd'); p(ox + 2, 11, 1, 2, 'd'); p(ox + 3, 13, 1, 1, 'd'); } // pokrčené
    };
    sob(21, faze, false); sob(33, 1 - faze, false); sob(45, faze, true);
    return c;
  }
  const zrcadlo = (c) => { const m = document.createElement('canvas'); m.width = c.width; m.height = c.height; const g = m.getContext('2d'); g.translate(c.width, 0); g.scale(-1, 1); g.drawImage(c, 0, 0); return m; };
  const silueta = (c) => { const m = document.createElement('canvas'); m.width = c.width; m.height = c.height; const g = m.getContext('2d'); g.drawImage(c, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = '#0e1622'; g.fillRect(0, 0, m.width, m.height); return m; };
  const SPR = [0, 1].map((f) => { const c = kresba(f); return { p: c, l: zrcadlo(c), sp: silueta(c), sl: silueta(zrcadlo(c)) }; });

  // dárek: 4 × 4 body, červený s zlatou stuhou (jeden ze tří barevných)
  const DAR = ['#d8352a', '#2f6fd1', '#2aa36b'];

  Izomapa.registerPlugin(ID, {
    onInit(api) {
      const D = api.getPluginData(ID) || {};
      const CFG = api.getPluginConfig(ID) || {};
      const PAUZA = (CFG.pauza_s ?? 25) * 1000, V = CFG.rychlost ?? 42, VYS = CFG.vyska ?? 110;
      const KOMIN = D.komin || [];
      const toImg = api.toImg, gz = api.gz;
      const aktivni = (view) => view.season === 'winter';      // zima je zima (Pavel 2026-11-21); přepínač výzdoby zrušen 2026-11-25

      let S = null, dalsi = performance.now() + 4000, sleduj = false, posl = null, skok = 0;
      const stopa = [], darky = [], jiskry = [];
      const rnd = Math.random;

      // směr ve světě, který jde na obrazovce zhruba vodorovně (saně z boku vypadají dobře jen tak)
      const naObrazovce = (h) => { const a = toImg(0, 0, 0), b = toImg(Math.cos(h), Math.sin(h), 0); return [b[0] - a[0], b[1] - a[1]]; };
      const vodorovne = (h) => { const [dx, dy] = naObrazovce(h); return Math.abs(dy) < Math.abs(dx) * 0.42; };
      // pref = směr, kam se má saním chtít (zpátky k centru); z vodorovných směrů vybere ten nejbližší, s trochou náhody
      function novySmer(pref) {
        let best = 0, bs = -9;
        for (let i = 0; i < 60; i++) {
          const h = rnd() * Math.PI * 2; if (!vodorovne(h)) continue;
          const s = pref === undefined ? rnd() : Math.cos(h - pref) + rnd() * 0.4;
          if (s > bs) { bs = s; best = h; }
        }
        return best;
      }
      // Santa se drží ve městě (Pavel 2026-11-20: „zbytečně jezdí na hranici mapy“): střed mapy = těžiště zástavby
      const R = CFG.polomer ?? 1500;                 // m od středu mapy, kam ještě smí
      const kCentru = (x, y) => Math.atan2(-y, -x);

      function start(view) {
        // přes střed právě zobrazeného výřezu, začátek za jeho okrajem
        // bod na zemi, nad kterým se saně ve výšce letu promítnou do středu obrazovky (výška posouvá obraz nahoru)
        const v = api.getView();
        let [cx, cy] = api.imgToWorld(v.x, v.y);
        for (let i = 0; i < 3; i++) {
          const [ix, iy] = toImg(cx, cy, gz(cx, cy) + VYS), [wx, wy] = api.imgToWorld(v.x - (ix - v.x), v.y - (iy - v.y));
          const [bx, by] = api.imgToWorld(v.x, v.y); cx += wx - bx; cy += wy - by;
        }
        const r = Math.hypot(cx, cy); if (r > R * 0.8) { cx *= R * 0.8 / r; cy *= R * 0.8 / r; }   // výřez za městem: přelet na kraji města
        const sirka = view.cw / view.sx * 0.2;                                   // šířka výřezu v m (bod obrazu = 0,2 m)
        const h = novySmer(), L = Math.min(R, Math.max(900, sirka * 0.75 + 250));   // při oddálení ne až k okraji mapy
        const ofs = (rnd() - 0.5) * sirka * 0.3;                                 // trochu mimo střed
        S = { x: cx - Math.cos(h) * L - Math.sin(h) * ofs, y: cy - Math.sin(h) * L + Math.cos(h) * ofs, h, cil: h, ujeto: 0, delka: 2 * L,
          faze: 0, tf: 0, dar: performance.now() + 3000 + rnd() * 3000, byl: false };
        if (skok) { S.x += Math.cos(h) * skok; S.y += Math.sin(h) * skok; S.ujeto = skok; skok = 0; }
      }
      function konec() { S = null; dalsi = performance.now() + PAUZA * (0.6 + rnd() * 0.8); if (sleduj) stopSledovani(); }

      // ---------- sledování (stejná lišta jako u letadel a MHD) ----------
      const fol = document.getElementById('follow'), folTxt = document.getElementById('followTxt');
      const TXT = '🎅 Santa Claus';
      function zapniSledovani() {
        sleduj = true;
        const b = document.createElement('b'); b.textContent = TXT;
        folTxt.replaceChildren(b, ' · rozváží dárky, saně táhne Rudolf se svítícím nosem');
        fol.hidden = false;
        document.getElementById('cardClose')?.click();
      }
      function stopSledovani() { sleduj = false; if (folTxt.textContent.startsWith(TXT)) fol.hidden = true; }
      document.getElementById('followStop')?.addEventListener('click', () => { sleduj = false; });
      let tah = null;                                                            // tažení mapy sledování vypne (jako u letadel)
      const osd = document.getElementById('osd');
      osd?.addEventListener('pointerdown', (e) => { tah = [e.clientX, e.clientY]; });
      osd?.addEventListener('pointermove', (e) => { if (tah && sleduj && e.buttons && Math.hypot(e.clientX - tah[0], e.clientY - tah[1]) > 6) stopSledovani(); });
      osd?.addEventListener('pointerup', () => { tah = null; });
      // saně jedou po obrazovce i 90 px/s: klik platí i tam, kde byly v posledních 0,6 s (než člověk klepne, popojedou)
      const hist = [];
      api.onMapClick((evt) => {
        const now = performance.now(), m = 12;
        const zasah = hist.some(([t, [x0, y0, x1, y1]]) => now - t < 600 && evt.screenX > x0 - m && evt.screenX < x1 + m && evt.screenY > y0 - m && evt.screenY < y1 + m);
        if (!zasah) return false;
        if (sleduj) stopSledovani(); else zapniSledovani();
        return true;
      }, { priority: 5 });

      api.onFrame((ctx, view) => {
        const now = view.now, dt = view.dt;
        if (!aktivni(view)) { if (S) { S = null; if (sleduj) stopSledovani(); } posl = null; stopa.length = darky.length = jiskry.length = 0; return; }
        if (sleduj && (fol.hidden || !folTxt.textContent.startsWith(TXT))) sleduj = false;   // sledování převzalo MHD nebo letadlo
        if (!S && now > dalsi) start(view);
        const sx = view.sx, ox = view.ox, oy = view.oy, noc = view.night;
        const P = (ix, iy) => [ox + ix * sx, oy + iy * sx];
        posl = null;

        if (S) {
          // pohyb: rovně, při sledování po přeletu výřezu plynule zatočí na nový vodorovný směr a letí dál
          if (sleduj && (S.ujeto > S.delka * 0.8 || (Math.hypot(S.x, S.y) > R && Math.cos(S.cil - kCentru(S.x, S.y)) < 0.3))) {
            S.cil = novySmer(kCentru(S.x, S.y)); S.ujeto = S.delka * 0.3;          // zatáčí zpátky do města
          }
          let dh = S.cil - S.h; dh = Math.atan2(Math.sin(dh), Math.cos(dh));
          S.h += Math.sign(dh) * Math.min(Math.abs(dh), 0.35 * dt);
          S.x += Math.cos(S.h) * V * dt; S.y += Math.sin(S.h) * V * dt; S.ujeto += V * dt;
          S.tf += dt; if (S.tf > 0.16) { S.tf = 0; S.faze = 1 - S.faze; }
          const z0 = gz(S.x, S.y), vH = VYS + Math.sin(now / 900) * 3;
          const [ix, iy] = toImg(S.x, S.y, z0 + vH);
          const [X, Y] = P(ix, iy);
          const doleva = naObrazovce(S.h)[0] < 0;
          const k = Math.max(1, Math.round(BOD / 0.2 * sx));                    // celé násobky pixelu
          const w = SW * k, h = SH * k, x0 = Math.round(X - w / 2), y0 = Math.round(Y - h / 2);
          const naObr = X > -w && X < view.cw + w && Y > -h && Y < view.ch + h;
          if (naObr) S.byl = true;
          if (!sleduj && S.ujeto > S.delka) { konec(); return; }
          // na začátku a konci přeletu se saně plynule objeví a rozplynou (při oddálení nekončí uprostřed mapy skokem)
          const fade = sleduj ? 1 : Math.max(0, Math.min(1, S.ujeto / (S.delka * 0.12), (S.delka - S.ujeto) / (S.delka * 0.12)));

          // stín na zemi (slunce od jihovýchodu jako u letadel), noc slabší
          const shX = S.x - 0.45 * vH, shY = S.y + 0.35 * vH, [six, siy] = toImg(shX, shY, gz(shX, shY)), [SX, SY] = P(six, siy);
          ctx.globalAlpha = (noc > 0.5 ? 0.06 : 0.16) * fade;
          ctx.drawImage(SPR[S.faze][doleva ? 'sl' : 'sp'], Math.round(SX - w / 2), Math.round(SY - h / 4), w, Math.max(1, Math.round(h / 2)));
          ctx.globalAlpha = 1;

          // třpytivá stopa ze zádě saní (obrazové souřadnice, pomalu klesá)
          const zx = doleva ? SW - 1 - ZAD[0] : ZAD[0];
          const zIx = ix + ((zx - SW / 2) * BOD / 0.2), zIy = iy + ((ZAD[1] - SH / 2) * BOD / 0.2);
          if (naObr && fade > 0.5 && (!stopa.length || now - stopa[stopa.length - 1].t > 35)) {
            for (let i = 0; i < 2; i++) stopa.push({ x: zIx + (rnd() - 0.5) * 6, y: zIy + (rnd() - 0.5) * 6, t: now, ph: rnd() * 6 });
          }

          // dárek do komína: komín 25–120 m před saněmi (po zemi), jen když je Santa vidět
          if (naObr && fade > 0.9 && KOMIN.length && now > S.dar) {
            S.dar = now + 5000 + rnd() * 5000;
            const [gx, gy] = toImg(S.x, S.y, z0), [vx, vy] = naObrazovce(S.h), vl = Math.hypot(vx, vy);
            const ciX = gx + vx / vl * 260, ciY = gy + vy / vl * 260;
            let best = null, bd = 400 * 400;
            for (const c of KOMIN) { const d = (c[0] - ciX) ** 2 + (c[1] - ciY) ** 2; if (d < bd) { bd = d; best = c; } }
            if (best) darky.push({ x0: ix, y0: iy + 4, x1: best[0], y1: best[1], t0: now, dur: 1700, col: DAR[Math.floor(rnd() * DAR.length)] });
          }

          // saně
          ctx.imageSmoothingEnabled = false;
          ctx.globalAlpha = fade;
          ctx.drawImage(SPR[S.faze][doleva ? 'l' : 'p'], x0, y0, w, h);
          posl = [x0, y0, x0 + w, y0 + h];
          hist.push([performance.now(), posl]); while (hist.length && performance.now() - hist[0][0] > 600) hist.shift();
          // Rudolfův nos: v noci záře, ve dne jen pomrkává jasněji
          const nx = x0 + (doleva ? SW - 1 - NOS[0] : NOS[0]) * k, ny = y0 + NOS[1] * k;
          const pulz = 0.55 + 0.45 * Math.sin(now / 180);
          if (noc > 0.25) {
            ctx.fillStyle = `rgba(255,60,50,${(0.18 + 0.2 * pulz) * Math.min(1, noc * 1.5)})`;
            ctx.fillRect(nx - 3 * k, ny - 3 * k, 7 * k, 7 * k);
            ctx.fillStyle = `rgba(255,90,80,${0.35 * pulz})`; ctx.fillRect(nx - k, ny - k, 3 * k, 3 * k);
          }
          ctx.fillStyle = pulz > 0.7 ? '#ff6a5a' : '#ff2a2a'; ctx.fillRect(nx, ny, k, k);
          ctx.globalAlpha = 1;
          // štítek při sledování
          if (sleduj) {
            ctx.font = '700 12px "Source Sans 3", system-ui, sans-serif';
            const tw = Math.ceil(ctx.measureText(TXT).width) + 12, ty = y0 - 14;
            ctx.fillStyle = 'rgba(22, 25, 31, 0.88)'; ctx.fillRect(X - tw / 2, ty - 9, tw, 20);
            ctx.strokeStyle = '#f2c66d'; ctx.lineWidth = 1.5; ctx.strokeRect(X - tw / 2, ty - 9, tw, 20);
            ctx.fillStyle = '#f2c66d'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(TXT, X, ty + 1);
            ctx.textAlign = 'start'; ctx.textBaseline = 'alphabetic';
            api.panTo(ix, iy, undefined, false);
          }
        }

        // stopa: zlaté a bílé jiskřičky, mizí za 1,4 s, v noci jasnější
        const q = Math.max(1, Math.round(BOD / 0.2 * sx));
        while (stopa.length && now - stopa[0].t > 1400) stopa.shift();
        for (const s of stopa) {
          const age = (now - s.t) / 1400, tw = Math.sin(now / 70 + s.ph * 10) > 0;
          s.y += dt * 6;
          const [X, Y] = P(s.x, s.y);
          ctx.globalAlpha = (1 - age) * (noc > 0.4 ? 1 : 0.8);
          ctx.fillStyle = tw ? '#fff6c8' : '#f2c230';
          ctx.fillRect(Math.round(X), Math.round(Y), q, q);
        }
        ctx.globalAlpha = 1;

        // padající dárky: vodorovně rovnoměrně, svisle se zrychlením (gravitace), na komíně zlatý záblesk
        for (let i = darky.length - 1; i >= 0; i--) {
          const d = darky[i], u = (now - d.t0) / d.dur;
          if (u >= 1) { for (let j = 0; j < 10; j++) jiskry.push({ x: d.x1, y: d.y1, vx: (rnd() - 0.5) * 30, vy: -rnd() * 30, t: now }); darky.splice(i, 1); continue; }
          const ix = d.x0 + (d.x1 - d.x0) * u, iy = d.y0 + (d.y1 - d.y0) * u * u;
          const [X, Y] = P(ix, iy), s = q;
          ctx.fillStyle = d.col; ctx.fillRect(Math.round(X - 2 * s), Math.round(Y - 2 * s), 4 * s, 4 * s);
          ctx.fillStyle = '#f2c230'; ctx.fillRect(Math.round(X - 2 * s), Math.round(Y), 4 * s, s); ctx.fillRect(Math.round(X), Math.round(Y - 2 * s), s, 4 * s);
          ctx.fillRect(Math.round(X - s), Math.round(Y - 3 * s), s, s); ctx.fillRect(Math.round(X + s), Math.round(Y - 3 * s), s, s);   // mašle
        }
        for (let i = jiskry.length - 1; i >= 0; i--) {
          const j = jiskry[i], age = (now - j.t) / 600;
          if (age >= 1) { jiskry.splice(i, 1); continue; }
          j.x += j.vx * dt; j.y += j.vy * dt; j.vy += 60 * dt;
          const [X, Y] = P(j.x, j.y);
          ctx.globalAlpha = 1 - age; ctx.fillStyle = age < 0.5 ? '#fff6c8' : '#f2c230';
          ctx.fillRect(Math.round(X), Math.round(Y), q, q);
        }
        ctx.globalAlpha = 1;
      }, { layer: 'sky', priority: 1 });

      // pro zkoušky a ruční ladění (jen na localhostu): okamžitý přelet
      // pust(m): přelet hned, saně rovnou m metrů od začátku dráhy (zkouška nečeká, až doletí do výřezu); dar(): dárek hned
      if (location.hostname === 'localhost') window.__santa = {
        pust: (m = 0) => { dalsi = 0; S = null; skok = m; }, dar: () => { if (S) S.dar = 0; },
        stav: () => ({ let: !!S, sleduj, darku: darky.length, kominu: KOMIN.length, posl, r: S ? Math.round(Math.hypot(S.x, S.y)) : null }),
      };
    },
  });
})();
