// Doplněk „Skrytá překvapení“ (Pavel 2026-11-26, napady/ZABAVA.md bod 6): nikde nepopsané, ať si to lidé řeknou mezi sebou.
//  · kostel sv. Vavřince: klik na budovu → z věže vyletí noty a holubi
//  · výběh lvů v zoo: klik → bublina „RRRAAAU!“ a zvířata v okolí nadskočí (window.IZO_LEK čte drawZvire v 70-animace.js)
//  · voda (Morava, rybníky): klik → občas vykoukne vodník (podíl z overlay_hook.py, po třech marných klicích určitě)
//  · komín elektrárny: klik na komín → kouřové srdce nebo prstenec, unáší ho vítr
// Zvuky (syntetické, Web Audio): zvon u kostela, řev lva, šplouchnutí vodníka; komín tichý.
// Normální kliknutí běží dál (karta budovy, místa), překvapení se jen přidá. Další překvapení časem přibudou (Pavel 2026-11-26). Kresba z obdélníčků jako Santa a chodci:
// bod kresby = BOD m, celé násobky pixelu = ostré.
(() => {
  const ID = 'prekvapeni';
  const Izomapa = window.Izomapa;
  if (!Izomapa) return;
  const BOD = 0.25;                                              // m na bod kresby (o něco větší než skutečnost, jako chodci)
  const inPoly = (x, y, P) => { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [xi, yi] = P[i], [xj, yj] = P[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; };
  const vUsecce = (px, py, [ax, ay], [bx, by]) => { const dx = bx - ax, dy = by - ay, t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1))); return Math.hypot(px - ax - t * dx, py - ay - t * dy); };
  const lehce = (t) => t * t * (3 - 2 * t);

  // sprity z řetězců (tečka = průhledné); barvy podle písmen
  const sprite = (radky, barvy) => { const c = document.createElement('canvas'); c.width = Math.max(...radky.map((r) => r.length)); c.height = radky.length;
    const g = c.getContext('2d'); radky.forEach((r, y) => [...r].forEach((k, x) => { if (k !== '.') { g.fillStyle = barvy[k]; g.fillRect(x, y, 1, 1); } })); return c; };
  // bílý obrys kolem spritu (noty a holubi jinak na pestré mapě zanikají)
  const obrys = (c, barva = '#fffdf6') => { const m = document.createElement('canvas'); m.width = c.width + 2; m.height = c.height + 2; const g = m.getContext('2d');
    const s = document.createElement('canvas'); s.width = c.width; s.height = c.height; const gs = s.getContext('2d'); gs.drawImage(c, 0, 0); gs.globalCompositeOperation = 'source-in'; gs.fillStyle = barva; gs.fillRect(0, 0, c.width, c.height);
    for (const [dx, dy] of [[0, 1], [2, 1], [1, 0], [1, 2], [0, 0], [2, 0], [0, 2], [2, 2]]) g.drawImage(s, dx, dy);
    g.drawImage(c, 1, 1); return m; };
  const NOTA = obrys(sprite(['..KK', '..KK', '..K.', '..K.', 'KKK.', 'KKK.', '.K..'], { K: '#22252e' }));
  const NOTA2 = obrys(sprite(['.KKKK', '.K..K', '.K..K', '.K..K', 'KK.KK', 'KK.KK'], { K: '#22252e' }));
  const HOLUB = [obrys(sprite(['K.....K', '.G...G.', '..GGG..', '...G...'], { K: '#5d6470', G: '#8c94a1' })),
    obrys(sprite(['.......', 'KGGGGGK', '..GGG..', '...G...'], { K: '#5d6470', G: '#8c94a1' }))];
  const VODNIK = sprite([
    '...HHHHH...', '..HHHHHHH..', '.hhhhhhhhh.', '...FFFFF...', '...FKFKF...', '...FFFFF...', '....FMF....',
    '..GGGGGGG..', '.GGGgGgGGG.', 'FGGGGGGGGGF', '.GGGGGGGGG.', '..GGGGGGG..', '..BBBBBBB..'],
  { H: '#2f7a3a', h: '#1f5528', F: '#9fd08a', K: '#14202a', M: '#c0392b', G: '#3d8f4a', g: '#e2c25a', B: '#2b5a8a' });

  // ---------- zvuky (Pavel 2026-11-26: „syntetický zvon“, lev a vodník taky): Web Audio, bez souborů a licencí ----------
  // AudioContext vznikne až při kliknutí (prohlížeče zvuk bez gesta uživatele nepustí). Hlasitost umírněná (HLAS).
  const HLAS = 0.32;
  let AC = null, VYSTUP = null;
  const audio = () => {
    if (!AC) { const A = window.AudioContext || window.webkitAudioContext; if (!A) return null; AC = new A(); VYSTUP = AC.createGain(); VYSTUP.gain.value = HLAS; VYSTUP.connect(AC.destination); }
    if (AC.state === 'suspended') AC.resume();
    return AC;
  };
  const sum = (a, delka) => { const b = a.createBuffer(1, Math.ceil(a.sampleRate * delka), a.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return b; };
  // zvon: nesouzvučné částkové tóny jako u skutečného zvonu (hum, prima, malá tercie, kvinta, nominál…), každý doznívá jinak
  function zvon(a, t, f, sila = 1) {
    for (const [k, g, dz] of [[0.5, 0.35, 3.2], [1, 0.5, 2.4], [1.19, 0.32, 2.0], [1.5, 0.2, 1.6], [2, 0.42, 1.4], [2.51, 0.16, 1.0], [2.99, 0.12, 0.8], [4.17, 0.08, 0.5]]) {
      const o = a.createOscillator(), e = a.createGain(); o.type = 'sine'; o.frequency.value = f * k;
      e.gain.setValueAtTime(0.0001, t); e.gain.exponentialRampToValueAtTime(g * sila, t + 0.006); e.gain.exponentialRampToValueAtTime(0.0001, t + dz);
      o.connect(e).connect(VYSTUP); o.start(t); o.stop(t + dz + 0.05);
    }
  }
  function zvuk(typ) {
    const a = audio(); if (!a) return;
    const t = a.currentTime + 0.02;
    if (window.__test) (window.__test.zvuky ||= []).push(typ);
    if (typ === 'kostel') { zvon(a, t, 262); zvon(a, t + 1.05, 220, 0.9); zvon(a, t + 2.1, 262, 0.8); zvon(a, t + 3.15, 220, 0.7); }   // bim–bam
    else if (typ === 'zoo') {                                    // řev: drsný nízký tón (pila přes zkreslení) s vibratem + šum hrdla
      const o = a.createOscillator(), ws = a.createWaveShaper(), lp = a.createBiquadFilter(), e = a.createGain(), lfo = a.createOscillator(), lg = a.createGain();
      o.type = 'sawtooth'; o.frequency.setValueAtTime(115, t); o.frequency.linearRampToValueAtTime(150, t + 0.35); o.frequency.exponentialRampToValueAtTime(70, t + 1.6);
      lfo.frequency.value = 23; lg.gain.value = 9; lfo.connect(lg).connect(o.frequency);
      const c = new Float32Array(256); for (let i = 0; i < 256; i++) { const x = i / 128 - 1; c[i] = Math.tanh(x * 4); } ws.curve = c;
      lp.type = 'lowpass'; lp.frequency.setValueAtTime(1400, t); lp.frequency.exponentialRampToValueAtTime(500, t + 1.6); lp.Q.value = 3;
      e.gain.setValueAtTime(0.0001, t); e.gain.exponentialRampToValueAtTime(0.9, t + 0.18); e.gain.setValueAtTime(0.9, t + 0.7); e.gain.exponentialRampToValueAtTime(0.0001, t + 1.7);
      o.connect(ws).connect(lp).connect(e).connect(VYSTUP); o.start(t); lfo.start(t); o.stop(t + 1.75); lfo.stop(t + 1.75);
      const n = a.createBufferSource(), bp = a.createBiquadFilter(), ne = a.createGain(); n.buffer = sum(a, 1.7);
      bp.type = 'bandpass'; bp.frequency.value = 520; bp.Q.value = 1.2; ne.gain.setValueAtTime(0.0001, t); ne.gain.exponentialRampToValueAtTime(0.5, t + 0.2); ne.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
      n.connect(bp).connect(ne).connect(VYSTUP); n.start(t);
    } else if (typ === 'vodnik' || typ === 'vodnik-pryc') {     // šplouchnutí: šum přes klesající pásmovou propust + krátké „blop“
      const n = a.createBufferSource(), bp = a.createBiquadFilter(), e = a.createGain(); n.buffer = sum(a, 0.6);
      bp.type = 'bandpass'; bp.Q.value = 0.9; bp.frequency.setValueAtTime(2600, t); bp.frequency.exponentialRampToValueAtTime(500, t + 0.45);
      e.gain.setValueAtTime(0.0001, t); e.gain.exponentialRampToValueAtTime(0.8, t + 0.015); e.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
      n.connect(bp).connect(e).connect(VYSTUP); n.start(t);
      const o = a.createOscillator(), oe = a.createGain(); o.frequency.setValueAtTime(typ === 'vodnik' ? 380 : 700, t + 0.03); o.frequency.exponentialRampToValueAtTime(typ === 'vodnik' ? 900 : 180, t + 0.18);
      oe.gain.setValueAtTime(0.0001, t + 0.03); oe.gain.exponentialRampToValueAtTime(0.35, t + 0.05); oe.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
      o.connect(oe).connect(VYSTUP); o.start(t + 0.03); o.stop(t + 0.25);
    }
  }

  Izomapa.registerPlugin(ID, {
    onInit(api) {
      const D = api.getPluginData(ID) || {};
      const E = [];                                              // běžící překvapení
      let marne = 0, posledni = {}, posledniSx = 1;              // měřítko z posledního snímku (getView ho nenese)
      const smi = (k, ms) => { const t = performance.now(); if (t - (posledni[k] || 0) < ms) return false; posledni[k] = t; return true; };
      if (window.__test) window.__test.prekvapeniPripraveno = true;   // zkouška čeká, než se doplněk načte (až po mapě)
      const pridej = (e) => {
        E.push({ ...e, t0: performance.now() }); if (window.__test) (window.__test.prekvapeni ||= []).push(e.typ);
        if (e.typ !== 'komin') zvuk(e.typ);                      // komín je tichý (Pavel 2026-11-26 vybral zvon, lva a vodníka)
        if (e.typ === 'vodnik') setTimeout(() => zvuk('vodnik-pryc'), 2650);   // zase se ponoří
      };

      api.onMapClick((evt) => {
        const { x, y } = evt, tol = 14 / posledniSx;              // 14 px obrazovky
        if (D.kostel) {
          const v = D.kostel.vez, s = v ? api.latLonToImg(v[0], v[1], v[2]) : D.kostel.spicka;   // špička věže
          // jen klik na věž (Pavel 2026-11-27: ne na celý kostel): pás kolem osy věže od hřebene lodi po špičku
          const naVez = v ? vUsecce(x, y, api.latLonToImg(v[0], v[1], D.kostel.vez_od), s) < (D.kostel.vez_sirka || 4) / 0.2 : inPoly(x, y, D.kostel.hull);
          if (naVez && smi('kostel', 4000)) pridej({ typ: 'kostel', x: s[0], y: s[1] });
        }
        if (D.zoo) {
          const c = api.latLonToImg(D.zoo.lat, D.zoo.lon, 0), r = (D.zoo.r + 4) / 0.2;
          if (Math.hypot(x - c[0], y - c[1]) < r && smi('zoo', 3000)) {
            pridej({ typ: 'zoo', x: c[0], y: c[1] - r * 0.6 });
            window.IZO_LEK = { x: c[0], y: c[1], r: r + 60 / 0.2, t: performance.now() };   // zvířata do 60 m za výběhem nadskočí
          }
        }
        for (const k of D.kominy || []) {
          const a = api.latLonToImg(k.lat, k.lon, 0), b = api.latLonToImg(k.lat, k.lon, k.h);
          if (vUsecce(x, y, a, b) < Math.max(tol, 3 / 0.2) && smi('komin' + k.lat, 2500)) { pridej({ typ: 'komin', x: b[0], y: b[1], srdce: (posledni.n = (posledni.n || 0) + 1) % 2 === 1 }); break; }
        }
        if (D.voda && D.voda.some((P) => inPoly(x, y, P[0]) && !P.slice(1).some((h) => inPoly(x, y, h))) && smi('voda', 1500)) {
          if (Math.random() < (D.vodnik ?? 0.35) || marne >= 3) { marne = 0; pridej({ typ: 'vodnik', x, y }); } else marne++;
        }
        return false;                                            // karta a ostatní kliknutí běží dál
      }, { priority: 1 });

      api.onFrame((ctx, view) => {
        posledniSx = view.sx;
        if (!E.length) return;
        const now = view.now, { sx, ox, oy } = view, px = Math.max(1, Math.round(BOD / 0.2 * sx));   // pixelů na bod kresby
        const S = (ix, iy) => [Math.round(ox + ix * sx), Math.round(oy + iy * sx)];
        const tma = view.night > 0.5 ? 0.6 : 1;
        for (let i = E.length - 1; i >= 0; i--) {
          const e = E[i], t = (now - e.t0) / 1000;
          if (e.typ === 'kostel') {
            if (t > 4.5) { E.splice(i, 1); continue; }
            const [X, Y] = S(e.x, e.y), q = Math.max(2, px);    // noty a holubi aspoň 2 px na bod, ať jsou vidět i z dálky
            ctx.globalAlpha = tma * Math.min(1, (4.5 - t) / 1.2);
            for (let n = 0; n < 6; n++) {                        // noty stoupají a kolébají se
              const tn = t - n * 0.35; if (tn < 0) continue;
              const N = n % 3 ? NOTA : NOTA2, nx = X + Math.sin(tn * 2.4 + n) * 5 * q + (n % 2 ? 1 : -1) * tn * 6 * q, ny = Y - tn * 14 * q;
              ctx.drawImage(N, Math.round(nx - N.width * q / 2), Math.round(ny - N.height * q), N.width * q, N.height * q);
            }
            for (let n = 0; n < 5; n++) {                        // holubi vylétnou do stran
              const sm = (n / 4 - 0.5) * 2, tn = Math.max(0, t - 0.2), Hb = HOLUB[Math.floor(now / 110 + n) % 2];
              const hx = X + sm * tn * 28 * q + Math.sin(n * 7) * 6 * q, hy = Y + 4 * q - tn * 9 * q - Math.sin(tn * 1.3) * 10 * q;
              ctx.drawImage(Hb, Math.round(hx - Hb.width * q / 2), Math.round(hy), Hb.width * q, Hb.height * q);
            }
            ctx.globalAlpha = 1;
          } else if (e.typ === 'zoo') {
            if (t > 2.4) { E.splice(i, 1); continue; }
            const [X, Y] = S(e.x, e.y), tres = t < 1.2 ? Math.round(Math.sin(t * 60) * px) : 0;
            const f = Math.max(11, Math.round(5 * px + 6)), txt = 'RRRAAAU!';
            ctx.font = `900 ${f}px "Source Sans 3", system-ui, sans-serif`; const w = ctx.measureText(txt).width + f, h = f * 1.6;
            ctx.globalAlpha = Math.min(1, t * 6, (2.4 - t) * 3);
            ctx.fillStyle = '#fffdf6'; ctx.strokeStyle = '#22252e'; ctx.lineWidth = Math.max(1.5, px / 2);
            const bx = X - w / 2 + tres, by = Y - h - 6 * px;
            ctx.beginPath(); ctx.roundRect(bx, by, w, h, h / 2.4); ctx.moveTo(X - 4 * px, by + h); ctx.lineTo(X, by + h + 5 * px); ctx.lineTo(X + 2 * px, by + h);
            ctx.fill(); ctx.stroke(); ctx.fillStyle = '#c0392b'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(txt, X + tres, by + h / 2 + 1);
            ctx.globalAlpha = 1; ctx.textAlign = 'start'; ctx.textBaseline = 'alphabetic';
          } else if (e.typ === 'vodnik') {
            if (t > 3.2) { E.splice(i, 1); continue; }
            const [X, Y] = S(e.x, e.y), vys = (t < 0.6 ? lehce(t / 0.6) : t > 2.6 ? lehce((3.2 - t) / 0.6) : 1) * 10;   // v bodech nad hladinou
            for (let k = 0; k < 3; k++) {                        // kruhy na vodě (izometricky zploštělé)
              const tk = (t + k * 0.5) % 1.5, rr = (3 + tk * 9) * px; ctx.strokeStyle = `rgba(235,248,255,${(0.7 * (1 - tk / 1.5)).toFixed(2)})`; ctx.lineWidth = Math.max(1, px / 2);
              ctx.beginPath(); ctx.ellipse(X, Y, rr, rr / 2, 0, 0, Math.PI * 2); ctx.stroke();
            }
            const h = Math.round(vys), mava = t > 1 && t < 2.4 && Math.floor(now / 250) % 2;
            if (h > 0) {                                         // horní část postavy nad hladinou
              const cut = VODNIK.height - Math.min(VODNIK.height, h + 3);
              ctx.globalAlpha = tma;
              ctx.drawImage(VODNIK, 0, 0, VODNIK.width, VODNIK.height - cut, Math.round(X - VODNIK.width * px / 2), Math.round(Y - h * px), VODNIK.width * px, (VODNIK.height - cut) * px);
              if (mava) { ctx.fillStyle = '#9fd08a'; ctx.fillRect(Math.round(X + VODNIK.width * px / 2), Math.round(Y - h * px + 4 * px), px, 3 * px); }
              ctx.globalAlpha = 1;
            }
          } else if (e.typ === 'komin') {
            if (t > 7) { E.splice(i, 1); continue; }
            const w = view.wind || { dx: 0.5, dy: -0.25, strength: 0.6 }, k = 1 + t * 0.9;
            const [X0, Y0] = S(e.x, e.y), X = X0 + w.dx * w.strength * t * 9 * px, Y = Y0 - t * 11 * px + w.dy * w.strength * t * 4 * px;
            const a = Math.max(0, Math.min(1, t * 2, (7 - t) / 3)) * 0.85, r = Math.max(2, px * 1.4 * k);
            ctx.fillStyle = view.night > 0.5 ? `rgba(150,155,165,${a.toFixed(2)})` : `rgba(238,240,243,${a.toFixed(2)})`;
            const N = 22;
            for (let n = 0; n < N; n++) {
              const u = n / N * Math.PI * 2;
              const [hx, hy] = e.srdce ? [16 * Math.sin(u) ** 3, -(13 * Math.cos(u) - 5 * Math.cos(2 * u) - 2 * Math.cos(3 * u) - Math.cos(4 * u))] : [15 * Math.cos(u), 15 * Math.sin(u) * 0.55];
              ctx.beginPath(); ctx.arc(X + hx * px * 0.35 * k, Y + hy * px * 0.35 * k, r, 0, Math.PI * 2); ctx.fill();
            }
          }
        }
      }, { layer: 'sky', priority: 2 });
    },
  });
})();
