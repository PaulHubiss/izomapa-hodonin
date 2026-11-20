  // ---------- světové strany (Pavel 2026-11-20: „nepoznám, kde je jaký směr“) ----------
  // Písmena S V J Z venku za okraji mapy, jen při oddálení. Mapa se neotáčí (pohled od jihozápadu, geo.py AZ 225°),
  // takže na obrazovce je sever vždy vlevo nahoře, východ vpravo nahoře, jih vpravo dole, západ vlevo dole.
  // Písmeno stojí kolmo za středem strany mapy – při největším oddálení tedy v prázdném rohu okna.
  // Kreslí se do plátna efektů (draw v 89-kresleni.js), stejně jako auta: bez prvků v DOM, levné.
  const STRANY = (() => {
    const G = cam.grounds || [];
    if (!G.length) return [];
    const x0 = Math.min(...G.map((q) => q.cx - cam.half)), x1 = Math.max(...G.map((q) => q.cx + cam.half));
    const y0 = Math.min(...G.map((q) => q.cy - cam.half)), y1 = Math.max(...G.map((q) => q.cy + cam.half));
    const mx = (x0 + x1) / 2, my = (y0 + y1) / 2, d = Math.max(x1 - x0, y1 - y0) * 0.1;   // odstup od okraje: 10 % strany mapy
    // smer = jednotkový vektor na obrazovce podél okraje mapy (doprava): když písmeno zakryje panel, posune se po něm
    // a zůstane venku za mapou (vodorovný posun by ho u S strčil do mapy)
    return [['S', 'sever', mx, y1 + d, 1, 0], ['V', 'východ', x1 + d, my, 0, 1], ['J', 'jih', mx, y0 - d, 1, 0], ['Z', 'západ', x0 - d, my, 0, 1]]
      .map(([p, nazev, x, y, ex, ey]) => {
        const a = toImg(x, y, 0), b = toImg(x + ex * 100, y + ey * 100, 0);
        let dx = b[0] - a[0], dy = b[1] - a[1]; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
        if (dx < 0) { dx = -dx; dy = -dy; }
        return { p, nazev, xy: a, smer: [dx, dy] };
      });
  })();
  const STRANY_PISMO = getComputedStyle(document.body).fontFamily || 'sans-serif';
  // a = viditelnost 0–1 podle přiblížení (sx = pixely obrazovky na pixel mapy): plně do 0,2, mizí do 0,3 (tam začíná „far“)
  function kresliStrany(sx, ox, oy, cw, ch) {
    const a = Math.max(0, Math.min(1, (0.3 - sx) / 0.1));
    if (!a || !STRANY.length) return;
    const vel = Math.round(Math.max(18, Math.min(34, Math.min(cw, ch) * 0.045)));
    ctx.save();
    ctx.font = `700 ${vel}px ${STRANY_PISMO}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(3, vel * 0.16);
    // otevřený boční panel (desktop) zakrývá levý horní roh, kam padá S → písmeno těsně vedle panelu
    // (panel má position: fixed → offsetParent je vždy null; viditelnost podle obdélníku a visibility)
    const pan = $('panel'), pr = pan && pan.getClientRects().length && getComputedStyle(pan).visibility !== 'hidden' ? pan.getBoundingClientRect() : null;
    const fr = fx.getBoundingClientRect();
    for (const s of STRANY) {
      let x = ox + s.xy[0] * sx, y = oy + s.xy[1] * sx;
      if (pr && pr.width && x + fr.left > pr.left - vel && x + fr.left < pr.right + vel && y + fr.top > pr.top - vel && y + fr.top < pr.bottom + vel
          && s.smer[0] > 0.1) {
        const o = pr.right - fr.left + vel * 1.2 - x;           // o kolik doprava, aby bylo písmeno vedle panelu
        x += o; y += s.smer[1] / s.smer[0] * o;
      }
      if (x < -vel || y < -vel || x > cw + vel || y > ch + vel) continue;
      ctx.globalAlpha = a * 0.9;
      ctx.strokeStyle = 'rgba(10,14,28,.75)'; ctx.strokeText(s.p, x, y);
      ctx.fillStyle = '#f4efe2'; ctx.fillText(s.p, x, y);
      // celé slovo menším písmem pod písmenem (kdo nezná zkratku); jen když je místo
      if (vel >= 24) {
        const v2 = Math.round(vel * 0.42);
        ctx.font = `600 ${v2}px ${STRANY_PISMO}`; ctx.lineWidth = Math.max(2, v2 * 0.25);
        ctx.globalAlpha = a * 0.75;
        ctx.strokeText(s.nazev, x, y + vel * 0.78); ctx.fillText(s.nazev, x, y + vel * 0.78);
        ctx.font = `700 ${vel}px ${STRANY_PISMO}`; ctx.lineWidth = Math.max(3, vel * 0.16);
      }
    }
    ctx.restore();
  }
