  // ---------- povodně: záplavová území Moravy (F4, Pavel 2026-11-26) ----------
  // site/povodne.json z nastroje-pavel/povodne.py (DIBAVOD, VÚV T. G. M.): pětiletá, dvacetiletá a stoletá voda, polygony v metrech
  // mapy. Přepínač „Povodňová území“ (Pavel 2026-11-26, dřív „Povodně“; l-povodne, výchozí vypnuto, v odkazu „spovodnemi“). Kreslí se po terénu modře, vnořené úrovně
  // ztmavují; domy se z vody vykrojí (obrysy budov), ať voda nepřebarvuje střechy. Kreslí se do vlastního plátna a znovu jen
  // při změně pohledu nebo načtení dalšího čtverce. Bez souboru se přepínač nezobrazí.
  const POV = { img: null, platno: null, klic: '', verze: 0 };
  const POV_BARVY = [['q100', 'rgba(70,140,225,0.30)'], ['q20', 'rgba(50,115,215,0.22)'], ['q5', 'rgba(30,90,200,0.24)']];
  onChunk.push(() => { POV.verze++; });
  fetch(`povodne.json${VER ? VER + '&' : '?'}s=${SEST}`, NC).then((r) => (r.ok ? r.json() : null)).then((d) => {
    if (!d || !d.q100) return;
    const kruh = (f) => { const o = []; for (let i = 0; i < f.length; i += 2) o.push(toImg(f[i], f[i + 1], gz(f[i], f[i + 1]))); return o; };
    POV.img = Object.fromEntries(POV_BARVY.map(([k]) => [k, (d[k] || []).map((p) => p.map(kruh))]));
    const lab = $('l-povodne')?.closest('label'); if (lab) lab.hidden = false;
    const z = document.querySelector('#helpDlg .muted');
    if (z && d.zdroj) z.append(` Záplavová území © ${d.zdroj.replace(/ \(.*\)$/, '')} (`, Object.assign(document.createElement('a'), { href: 'https://www.dibavod.cz', target: '_blank', rel: 'noopener', textContent: 'DIBAVOD' }), ').');
  }).catch(() => {});
  function kresliPovodne(sx, ox, oy, cw, ch, dpr) {
    if (!POV.img || !$('l-povodne')?.checked) return;
    const klic = [sx, ox, oy, cw, ch, dpr, POV.verze].map((v) => Math.round(v * 1000)).join(',');
    if (klic !== POV.klic) {
      POV.klic = klic;
      const c = POV.platno || (POV.platno = document.createElement('canvas'));
      if (c.width !== fx.width || c.height !== fx.height) { c.width = fx.width; c.height = fx.height; }
      const g = c.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, cw, ch);
      const cesta = (P) => { g.beginPath(); for (const r of P) r.forEach(([x, y], i) => (i ? g.lineTo : g.moveTo).call(g, ox + x * sx, oy + y * sx)); g.closePath(); };
      for (const [k, barva] of POV_BARVY) { g.fillStyle = barva; for (const P of POV.img[k]) { cesta(P); g.fill('evenodd'); } }
      g.strokeStyle = 'rgba(40,100,200,0.65)'; g.lineWidth = Math.max(1, Math.min(2, sx * 2));
      for (const P of POV.img.q100) { cesta(P); g.stroke(); }
      // domy ve výřezu z vody vykrojit (načtené jen zblízka; při oddálení jde voda přes všechno jako na mapě)
      const x0 = -ox / sx, y0 = -oy / sx, x1 = (cw - ox) / sx, y1 = (ch - oy) / sx, videno = new Set();
      g.globalCompositeOperation = 'destination-out'; g.fillStyle = '#000';
      for (let i = Math.floor(x0 / CELL); i <= Math.floor(x1 / CELL); i++) for (let j = Math.floor(y0 / CELL); j <= Math.floor(y1 / CELL); j++)
        for (const b of grid.get(i + ',' + j) || []) {
          if (videno.has(b) || b.bb[2] < x0 || b.bb[0] > x1 || b.bb[3] < y0 || b.bb[1] > y1) continue;
          videno.add(b); g.beginPath(); b.hull.forEach(([x, y], n) => (n ? g.lineTo : g.moveTo).call(g, ox + x * sx, oy + y * sx)); g.closePath(); g.fill();
        }
      g.globalCompositeOperation = 'source-over';
      if (window.__test) window.__test.povodne = { ploch: POV_BARVY.reduce((n, [k]) => n + POV.img[k].length, 0), vykrojeno: videno.size };
    }
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(POV.platno, 0, 0); ctx.restore();
  }
