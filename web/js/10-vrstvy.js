  // ---------- OpenSeadragon: vrstvy po čtvercích (den podle ročního období × teplý tón × tma + světla) ----------
  // souřadnice: pixely čtverce (0, 0), šířka W = 1 v souřadnicích pohledu; ostatní čtverce jsou posunuté
  // UM = metry na pixel souřadnic prohlížeče (obrysy, animace: vždy 0,2); base.mpp = rozlišení dlaždic (0,2, u detailního 0,1)
  const base = TILES.base || { x0: OV.cam.x0, y1: OV.cam.y1, mpp: OV.cam.mpp, status: 'hotovo' }, UM = OV.cam.mpp;
  const LAYERS = [{ key: 'c0_0', status: base.status, src: (v) => TILES[v], x: 0, y: 0, w: 1 }];
  for (const [key, ch] of Object.entries(TILES.chunks || {})) {
    const any = ch.autumn || ch.lights; if (!any) continue;
    const dx = (any.x0 - base.x0) / UM, dy = (base.y1 - any.y1) / UM;
    LAYERS.push({ key, status: ch.status, src: (v) => ch[v], x: dx / W, y: dy / W, w: +any.Image.Size.Width * base.mpp / UM / W });
  }
  // pořadí vrstev podle hloubky: pohled od JZ, takže čtverce dál na S a V (větší i + j) se kreslí dřív (níž)
  const far = (k) => { const [i, j] = k.slice(1).split('_').map(Number); return i + j; };
  LAYERS.sort((a, b) => far(b.key) - far(a.key));
  if (!WIP) { $('wipSel').parentElement.hidden = true; state.wip = true; }   // vše hotové: bez přepínače, celá mapa   // bez rozpracovaných čtverců (např. náhled v artefaktu)
  const shown = (k) => state.wip || (LAYERS.find((l) => l.key === k) || {}).status === 'hotovo';
  const SLOW = matchMedia('(max-width: 640px)').matches || !!(navigator.connection && (navigator.connection.saveData || /2g|3g/.test(navigator.connection.effectiveType || '')));
  const viewer = OpenSeadragon({
    element: $('osd'), tileSources: [],
    showNavigationControl: false, imageSmoothingEnabled: false,
    // největší přiblížení stejné v metrech (detailní dlaždice mají 2× víc pixelů, proto u nich poloviční poměr)
    maxZoomPixelRatio: 6 * base.mpp / UM, minZoomImageRatio: 0.6, visibilityRatio: 0.4, animationTime: 0.6,
    // mobil a pomalé připojení: hrubší dlaždice, aby se mapa ukázala hned (při přiblížení se doostří)
    ...(SLOW ? { minPixelRatio: 1.2, immediateRender: true, imageLoaderLimit: 4 } : { minPixelRatio: 0.6 }),
    gestureSettingsMouse: { clickToZoom: false, dblClickToZoom: true }, gestureSettingsTouch: { pinchRotate: false }, gestureSettingsPen: { clickToZoom: false, dblClickToZoom: true },
  });
  // verze dlaždic v adrese: dlaždice se cachují na rok, nové nasazení změní verzi (tiles.json se ověřuje vždy)
  const VER = TILES.ver ? `?v=${TILES.ver}` : '';
  viewer.world.addHandler('add-item', (e) => { if (e.item.source && e.item.source.tilesUrl !== undefined) e.item.source.queryParams = VER; });
  const solid = (r, g, b) => { const c = document.createElement('canvas'); c.width = c.height = 2; const x = c.getContext('2d'); x.fillStyle = `rgb(${r},${g},${b})`; x.fillRect(0, 0, 2, 2); return c.toDataURL(); };
  let warmItem = null, darkItem = null, ready = false;
  const add = (opts) => new Promise((res) => viewer.addTiledImage({ ...opts, success: (e) => res(e.item), error: () => res(null) }));
  const layerOpacity = (l) => (shown(l.key) ? 1 : 0);
  // náhled celé mapy (jeden obrázek ~0,5 MB): ukáže se hned, detailní dlaždice čtverců se doplní pod ním souběžně
  let previewItem = null, previewGen = 0;
  async function addPreview(season) {
    const gen = ++previewGen;
    try {
      const pv = await fetch(`preview/${season}.json${VER}`).then((r) => r.json());
      const it = await add({ tileSource: { type: 'image', url: `preview/${season}.webp${VER}`, buildPyramid: false },
        x: (pv.x0 - base.x0) / UM / W, y: (base.y1 - pv.y1) / UM / W, width: pv.w * pv.mpp / UM / W, index: 0 });
      if (it && gen !== previewGen) { viewer.world.removeItem(it); return; }   // mezitím jiné období
      if (it) { if (previewItem) viewer.world.removeItem(previewItem); previewItem = it; viewer.world.setItemIndex(it, 0); }
    } catch {}
  }
  // pořadí kreslení: náhled, pak čtverce odzadu dopředu (bližší zakryje řez zeminou vzdálenějšího);
  // při změně období leží stará vrstva čtverce hned pod novou, dokud se nová nenačte
  const reorder = () => {
    let k = 0;
    if (previewItem) viewer.world.setItemIndex(previewItem, k++);
    for (const l of LAYERS) {
      if (l.base && l.base !== l.day && viewer.world.getIndexOfItem(l.base) >= 0) viewer.world.setItemIndex(l.base, k++);
      if (l.day) viewer.world.setItemIndex(l.day, k++);
      for (const e of Object.values(l.extra || {})) if (e.it && viewer.world.getIndexOfItem(e.it) >= 0) viewer.world.setItemIndex(e.it, k++);   // výzdoba hned nad svým čtvercem
    }
  };
  // ---------- přídavná vrstva čtverců: vánoční výzdoba (assets/vanoce.json) ----------
  // Zimní mapa = výzdoba a Santa, bez ohledu na datum (Pavel 2026-11-21: „nechci žádné datumy u vzhledu, zima je zima“).
  // Od–do ve vanoce.json prohlížeč nepoužívá (autor podle nich výzdobu zapíná a kreslí ji i na podzim).
  const VANOCE = {{VANOCE}};
  let xmasUser = null;                                         // ruční přepnutí v menu (jen v tomto prohlížeči)
  const xmasOn = () => !!VANOCE && (xmasUser ?? true);
  // výzdoba jen v zimní mapě (Pavel 2026-11-20: jarmark do podzimní mapy nepatří)
  const xmasShow = () => xmasOn() && state.season === 'winter';
  function applyExtras() {
    if (!ready && !LAYERS.some((l) => l.day)) return;
    $('l-xmas').checked = xmasOn();
    $('l-xmas').closest('label').hidden = !VANOCE;
    const want = (l) => {
      const w = {};
      if (xmasShow()) { const v = state.season === 'winter' ? 'xmas_winter' : 'xmas_autumn'; if (l.src(v)) w.xmas = v; }
      return w;
    };
    for (const l of LAYERS) {
      l.extra = l.extra || {};
      const w = want(l);
      for (const [k, e] of Object.entries(l.extra)) if (w[k] !== e.v) { if (e.it) viewer.world.removeItem(e.it); e.dead = true; delete l.extra[k]; }
      for (const [k, v] of Object.entries(w)) if (!l.extra[k]) {
        const e = l.extra[k] = { v };
        viewer.addTiledImage({ tileSource: l.src(v), x: l.x, y: l.y, width: l.w, opacity: layerOpacity(l), success: (ev) => {
          if (e.dead) { viewer.world.removeItem(ev.item); return; }
          e.it = ev.item; reorder();
        } });
      }
    }
  }
  $('l-xmas').addEventListener('change', (e) => { xmasUser = e.target.checked; applyExtras(); });
  const S_REV = { spring: 'jaro', summer: 'leto', autumn: 'podzim', winter: 'zima' };
  const neighborHref = (n) => {
    let u = n.url || '';
    if (u.includes('@')) return u;
    const lat = n.target_lat ?? (n.cil ? n.cil[0] : n.lat);
    const lon = n.target_lon ?? (n.cil ? n.cil[1] : n.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return u;
    let km = 1.4;
    try {
      if (viewer && viewer.viewport && cam) {
        const w = viewer.viewport.getBounds(true).width * W * cam.mpp / 1000;
        if (w > 0 && Number.isFinite(w)) km = Math.min(Math.max(Number(w.toFixed(2)), 0.05), 10);
      }
    } catch {}
    const sTok = S_REV[state.season] || 'leto';
    const nTok = state.night > 0.65 ? '-noc' : state.night > 0.25 ? '-soumrak' : '';
    const hash = `#${sTok}${nTok}@${Number(lat).toFixed(5)},${Number(lon).toFixed(5)},${km}`;
    return u.split('#')[0] + hash;
  };

  async function initLayers() {
    await addPreview(state.season);
    $('loading').hidden = true;
    await Promise.all(LAYERS.map(async (l) => { l.day = l.base = await add({ tileSource: l.src(state.season), x: l.x, y: l.y, width: l.w, opacity: layerOpacity(l) }); }));
    reorder();
    // tónování soumraku a noci jen přes pixely mapy (source-atop), jinak byl v noci vidět obdélník kolem mapy
    warmItem = await add({ tileSource: { type: 'image', url: solid(255, 160, 90) }, x: -60, y: -60, width: 200, opacity: 0, compositeOperation: 'source-atop' });
    darkItem = await add({ tileSource: { type: 'image', url: solid(14, 20, 52) }, x: -60, y: -60, width: 200, opacity: 0, compositeOperation: 'source-atop' });
    for (const l of LAYERS) if (l.src('lights')) l.light = await add({ tileSource: l.src('lights'), x: l.x, y: l.y, width: l.w, opacity: 0, compositeOperation: 'lighter', preload: false });
    // Levnější noc se stejným obrazem. OpenSeadragon (4.1.0) kreslí každou vrstvu s prolnutím přes pomocné plátno:
    // smazat, nakreslit, přenést = tři průchody přes celou obrazovku na tón a na každou vrstvu světel.
    // Tón je jednobarevný, stačí jeden obdélník přímo do hlavního plátna; pořadí vrstev zůstává.
    // (Světla zůstávají původní cestou: přímé přičítání dělalo na švech dlaždic světlé linky.)
    try {
      const mainCtx = () => viewer.drawer && viewer.drawer.context;
      if (!mainCtx() || !darkItem._drawTiles || !viewer.drawer.drawTile) throw new Error('jiná verze OpenSeadragonu');
      for (const [it, col] of [[warmItem, 'rgb(255,160,90)'], [darkItem, 'rgb(14,20,52)']]) it.draw = function () {
        this._needsDraw = false;
        if (!this.opacity) return;
        const c = mainCtx(); c.save(); c.setTransform(1, 0, 0, 1, 0, 0);
        c.globalCompositeOperation = 'source-atop'; c.globalAlpha = this.opacity; c.fillStyle = col; c.fillRect(0, 0, c.canvas.width, c.canvas.height);
        c.restore();
      };
    } catch (e) { console.warn('noc: zůstává původní skládání', e.message); }
    applyExtras();
    for (const n of OV.needs || []) {
      const el = document.createElement('div'); el.className = 'pin need'; el.textContent = '📷 ' + n.name; el.title = n.text; n.el = el;
      viewer.addOverlay({ element: el, location: new OpenSeadragon.Point(n.xy[0] / W, n.xy[1] / W), placement: OpenSeadragon.Placement.CENTER, checkResize: false });
    }
    // místa všech kategorií jako ikonky (web/kategorie.js), název po najetí; stejné místo ve dvou kategoriích má jednu ikonku
    // (památka u příběhu nebo u veřejného místa, veřejné místo stejného jména jako příběh: karta toho, kdo ikonku má)
    const ikPin = (p, k, ik, nazev, popis, otevri) => {
      const el = document.createElement('button'); el.type = 'button'; el.className = `pin ikp kat-${k}`;
      el.style.setProperty('--kat', KAT[k] ? KAT[k].barva : 'var(--ink)'); el.innerHTML = katSvg(ik);
      el.dataset.nazev = nazev; el.setAttribute('aria-label', `${popis}: ${nazev}`); p.el = el; PINY.push(p);
      el.addEventListener('pointerdown', (e) => e.stopPropagation());
      el.addEventListener('click', (e) => { e.stopPropagation(); otevri(p); });
      viewer.addOverlay({ element: el, location: new OpenSeadragon.Point(p.xy[0] / W, p.xy[1] / W), placement: OpenSeadragon.Placement.CENTER, checkResize: false });
    };
    const IK0 = (k) => (KAT[k] ? KAT[k].ik : '');
    for (const p of OV.places) ikPin(p, 'pribehy', IK0('pribehy'), p.name, 'Příběh místa', (q) => placeCard(q));
    for (const p of PAMATKY) if (!p.uMista && !p.uVer) ikPin(p, 'pamatky', IK0('pamatky'), p.nazev, 'Kulturní památka', showPamatka);
    // restaurace, kavárny, hospody: ikona podle druhu, „utensils-crossed“, „coffee“ a „beer“ z Lucide (ISC)
    const POD_IK = { jidlo: ['m16 2-2.3 2.3a3 3 0 0 0 0 4.2l1.8 1.8a3 3 0 0 0 4.2 0L22 8', 'M15 15 3.3 3.3a4.2 4.2 0 0 0 0 6l7.3 7.3c.7.7 2 .7 2.8 0L15 15Zm0 0 7 7', 'm2.1 21.8 6.4-6.3', 'm19 5-7 7'],
      kava: ['M10 2v2', 'M14 2v2', 'M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1', 'M6 2v2'],
      pivo: ['M17 11h1a3 3 0 0 1 0 6h-1', 'M9 12v6', 'M13 12v6', 'M14 7.5c-1 0-1.44.5-3 .5s-2-.5-3-.5-1.72.5-2.5.5a2.5 2.5 0 0 1 0-5c.78 0 1.57.5 2.5.5S9.44 2 11 2s2 1.5 3 1.5 1.72-.5 2.5-.5a2.5 2.5 0 0 1 0 5c-.78 0-1.5-.5-2.5-.5Z', 'M5 8v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V8'] };
    const podIk = (d) => POD_IK[{ cafe: 'kava', ice_cream: 'kava', confectionery: 'kava', pastry: 'kava', pub: 'pivo', bar: 'pivo', biergarten: 'pivo' }[d] || 'jidlo'];
    for (const p of PODNIKY) ikPin(p, 'jidlo', podIk(p.druh).map((d) => `<path d="${d}"/>`).join(''), p.nazev, POD_DRUH[p.druh] || 'Podnik', showPodnik);
    for (const p of VEREJNA) if (!p.uMista) ikPin(p, p.skupina, IK0(p.skupina), p.nazev, p.druh, showVerejne);
    hasiciStart();                                          // výjezdy hasičů (mesto.json "hasici")
    for (const n of OV.neighbors || []) {
      if (OBEC && n.obec && n.obec !== OBEC) continue;
      const el = document.createElement('a'); el.className = 'pin neighbor'; el.href = neighborHref(n);
      if (n.target) el.target = n.target;
      if (el.target === '_blank') el.rel = 'noopener';
      el.title = n.text || `Přejít na mapu: ${n.name}`;
      el.innerHTML = `<span class="pin-ico">↗</span> ${n.name}`;
      const upd = () => { el.href = neighborHref(n); };
      el.addEventListener('pointerenter', upd);
      el.addEventListener('pointerdown', (e) => { e.stopPropagation(); upd(); });
      el.addEventListener('click', (e) => { e.stopPropagation(); upd(); });
      n.el = el;
      viewer.addOverlay({ element: el, location: new OpenSeadragon.Point(n.xy[0] / W, n.xy[1] / W), placement: OpenSeadragon.Placement.CENTER, checkResize: false });
    }
    ready = true; applyVisibility(); applyTime(); loadMini(); tickReal();
    viewer.viewport.fitBounds(fillBounds(), true);
    limitZoom();
    viewer.addHandler('viewport-change', keepInside);
    // omezení i v každém snímku animace, před vykreslením (Pavel 2026-11-17: zoom kolečkem u okraje poskakoval):
    // viewport-change přijde jen při zubu kolečka, mezi zuby jela animace bez omezení a další zub ji naráz strhl zpět
    // (trhnutí až 250 px, nastroje-pavel/test_zoom.mjs)
    { const vp = viewer.viewport, upd = vp.update.bind(vp); vp.update = function () { const r = upd(); if (LAD) LAD.zdroj = 'snimek'; keepInside.snimek = true; keepInside(); keepInside.snimek = false; if (LAD) LAD.snimek(); return r; }; }
    if (LAD) LAD.start();
    viewer.addHandler('resize', () => { limitZoom(); viewer.viewport.applyConstraints(); keepInside(); });
    { const b = homeBounds(), side = Math.max(b.width, b.height) * 1.04, tx = b.x - (side - b.width) / 2, ty = b.y - (side - b.height) / 2;   // čtverec kolem mapy místo 200 × 200: omezení oddálení a posunu platí k mapě
      for (const it of [warmItem, darkItem]) if (it) { it.setPosition(new OpenSeadragon.Point(tx, ty), true); it.setWidth(side, true); } }
    // odkaz na místo: #zima-noc@50.76984,15.05836,2 (zeměpisná šířka, délka, přiblížení = šířka výřezu v km)
    // ...,1 = značka přesně na místě a karta budovy (odkaz z administrace hlášení i Sdílet u otevřené karty);
    // ,2 karta památky, ,3 karta místa nebo sousední mapy, ,4 vybrané místo; jen jedna značka a jeden čekající výběr, i po dalších odkazech
    let herePin = null, hereAt = null;                    // hereAt = [ix, iy, lat, lon] budovy, na jejíž data odkaz čeká
    const linkBuilding = (ix, iy, lat, lon) => {          // přesně budova z odkazu: z budov pod bodem ta s nejbližším středem (hit() by vzal tu vpředu)
      let best = null, bd = Infinity;
      for (const b of grid.get(Math.floor(ix / CELL) + ',' + Math.floor(iy / CELL)) || []) {
        if (!shown(b.k) || !inPoly(ix, iy, b.hull)) continue;
        const d = geoM(lat, lon, b); if (d < bd) { best = b; bd = d; }
      }
      return best;
    };
    const near = (list, lat, lon, max) => { let best = null, bd = max; for (const p of list) { const d = geoM(lat, lon, p); if (d < bd) { best = p; bd = d; } } return best; };
    onChunk.push(() => { if (!hereAt) return; const bb = linkBuilding(...hereAt); if (bb) { hereAt = null; showBuilding(bb); } });   // kartu otevřít, jakmile se načtou data
    const goToLink = (imm, home) => {
      const at = (location.hash.split('@')[1] || '').split(',').map(Number);
      const hasAt = at.length >= 2 && at.every(Number.isFinite);
      if (!hasAt && !home) return;
      if (herePin) { viewer.removeOverlay(herePin); herePin = null; }
      hereAt = null;
      const pos = goView(hasAt ? at : HOME_VIEW, imm);
      if (pos && hasAt && at[3] >= 1 && at[3] <= 5) {
        herePin = document.createElement('div'); herePin.className = 'here-pin';
        viewer.addOverlay({ element: herePin, location: new OpenSeadragon.Point(pos[0] / W, pos[1] / W), placement: OpenSeadragon.Placement.CENTER, checkResize: false });
        const [lat, lon, , kind] = at;
        if (kind === 1) { const bb = linkBuilding(...pos, lat, lon); if (bb) showBuilding(bb); else hereAt = [...pos, lat, lon]; }
        else if (kind === 2) { const p = near(PAMATKY, lat, lon, 30); if (p) showPamatka(p); }
        else if (kind === 5) { const p = near(PODNIKY, lat, lon, 30); if (p) showPodnik(p); }
        else if (kind === 6) { const p = near(VEREJNA, lat, lon, 30); if (p) showVerejne(p); }
        else if (kind === 3) {
          const n = near((OV.neighbors || []).filter((q) => !OBEC || !q.obec || q.obec === OBEC), lat, lon, 40), p = near(OV.places, lat, lon, 40);
          if (n && (!p || geoM(lat, lon, n) < geoM(lat, lon, p))) neighborCard(n); else if (p) placeCard(p);
        } else showCard({ title: 'Vybrané místo', rows: [], lat, lon, kind: 4 });
      }
    };
    goToLink(true, true);
    // odkaz vložený do už otevřené mapy: stránka se nenačte znovu, takže je potřeba přejít sem (replaceState níže tuto událost nespouští)
    addEventListener('hashchange', () => {
      if (Date.now() - uiBackAt < 1500) return;                  // návrat po zavření okna (Zpět) mapu nepřesouvá
      const tok = location.hash.slice(1).split('@')[0].split('-');
      for (const q of tok) if (SEASON_TOKEN[q]) setSeason(SEASON_TOKEN[q]);
      // sdílený odkaz má vždy roční období, noc nebo soumrak jen když platí; odkaz jen s polohou denní dobu nemění
      const denni = tok.includes('noc') ? 1 : tok.includes('soumrak') ? 0.42 : tok.some((q) => SEASON_TOKEN[q]) ? 0 : null;
      if (denni !== null) { $('realTime').checked = false; state.night = denni; $('night').value = Math.round(denni * 100); applyTime(); }
      if (tok.some((q) => SEASON_TOKEN[q])) applyLayers(tok);   // celý sdílený odkaz nese i vrstvy; odkaz jen s polohou je nemění
      goToLink(false, false);
    });
    let hashT = null;
    viewer.addHandler('animation-finish', () => { clearTimeout(hashT); hashT = setTimeout(() => {
      const c = viewer.viewport.getCenter(true), [x, y] = imgToWorld(c.x * W, c.y * W), [lon, lat] = lonlat(x, y);
      const km = viewer.viewport.getBounds(true).width * W * cam.mpp / 1000;
      const base = location.hash.slice(1).split('@')[0];
      history.replaceState(null, '', `#${base}@${lat.toFixed(5)},${lon.toFixed(5)},${km.toFixed(2)}`);
    }, 400); });
    loadVisible();
  }
  // sezónní výchozí stav z mesto.json "sezonni_start" (Pavel 2026-11-23: zima se sněžením a skok na jarmark do konce února):
  // platí jen v rozmezí od–do (MM-DD, může přes Nový rok) a jen bez odkazu s ročním obdobím / polohou; domů = jeho pohled
  const SEZ = {{SEZONNI_START}};
  const sezAktivni = (() => {
    if (!SEZ || !SEZ.od || !SEZ.do) return false;
    const md = (s) => +s.slice(0, 2) * 100 + +s.slice(3, 5), d = new Date(), t = (d.getMonth() + 1) * 100 + d.getDate();
    const a = md(SEZ.od), b = md(SEZ.do);
    return a <= b ? t >= a && t <= b : t >= a || t <= b;
  })();
  const HOME_VIEW = (sezAktivni && Array.isArray(SEZ.pohled) && SEZ.pohled) || {{POHLED}}, HOME_ALL = sezAktivni ? false : {{DOMU_CELEK}}, OBEC = {{OBEC}};
  const ROZSAH_MESTA = {{ROZSAH_MESTA}};   // obrys zástavby [[lat, lon], …] (mesto.json, nastroje-pavel/rozsah_mesta.py): na něj jde mapu oddálit
  function homeBounds() {
    const vis = LAYERS.filter((l) => shown(l.key));
    const x0 = Math.min(...vis.map((l) => l.x)), y0 = Math.min(...vis.map((l) => l.y));
    const x1 = Math.max(...vis.map((l) => l.x + l.w)), y1 = Math.max(...vis.map((l) => l.y + (l.day ? l.day.getBounds().height : 0.56)));
    return new OpenSeadragon.Rect(x0, y0, x1 - x0, y1 - y0);
  }
  // výchozí pohled, který okno vyplní: mapa je v izometrii kosočtverec, takže celá mapa v okně = prázdné rohy;
  // největší obdélník s poměrem stran okna uvnitř kosočtverce (rohy mapy přes výšku terénu). Prázdné okraje jsou vidět až po oddálení.
  // Nepravidelná mřížka čtverců (ne celý obdélník) nebo rozpracované čtverce: celá mapa jako dřív.
  // kosočtverec mapy v souřadnicích pohledu (rohy celé mřížky čtverců přes výšku terénu, 3 % dovnitř kvůli nerovnému
  // okraji terénu) a vnitřní normály hran; null = nepravidelná mřížka nebo rozpracované čtverce (pak bez omezení)
  let quadCache = null;
  function mapQuad() {
    const G = cam.grounds || [], h = cam.half;
    if (!G.length || !state.wip && LAYERS.some((l) => l.status !== 'hotovo')) return null;
    if (quadCache) return quadCache;
    const xs = G.map((q) => q.cx), ys = G.map((q) => q.cy);
    const x0 = Math.min(...xs) - h, x1 = Math.max(...xs) + h, y0 = Math.min(...ys) - h, y1 = Math.max(...ys) + h;
    if (G.length !== Math.round((x1 - x0) / (2 * h)) * Math.round((y1 - y0) / (2 * h))) return null;
    const R = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].map(([x, y]) => toImg(x, y, gz(x, y)).map((v) => v / W));
    const cx = R.reduce((s, p) => s + p[0], 0) / 4, cy = R.reduce((s, p) => s + p[1], 0) / 4;
    const P = R.map(([x, y]) => [cx + (x - cx) * 0.97, cy + (y - cy) * 0.97]);
    // hrana k: bod q je uvnitř, když n·q ≥ b (n = vnitřní normála)
    const E = P.map(([ax, ay], k) => {
      const [bx, by] = P[(k + 1) % 4]; let n = [-(by - ay), bx - ax];
      if (n[0] * (cx - ax) + n[1] * (cy - ay) < 0) n = [-n[0], -n[1]];
      const l = Math.hypot(n[0], n[1]); n = [n[0] / l, n[1] / l];
      return { n, b: n[0] * ax + n[1] * ay };
    });
    return (quadCache = { R, P, E, cx, cy });
  }
  // obdélník (souřadnice pohledu) kolem obrysu zástavby města; null = mesto.json ho nemá (pak jen kosočtverec jako dřív)
  let townCache;
  function townRect() {
    if (townCache !== undefined) return townCache;
    if (!ROZSAH_MESTA) return (townCache = null);
    const pts = ROZSAH_MESTA.map(([lat, lon]) => { const x = (lon - cam.lon0) * cam.kx, y = (lat - cam.lat0) * cam.ky; return toImg(x, y, gz(x, y)).map((v) => v / W); });
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    const x0 = Math.min(...xs), y0 = Math.min(...ys);
    return (townCache = new OpenSeadragon.Rect(x0, y0, Math.max(...xs) - x0, Math.max(...ys) - y0));
  }
  // výchozí pohled, který okno vyplní: největší obdélník s poměrem stran okna uvnitř kosočtverce
  function fillBounds() {
    const Q = mapQuad(); if (!Q) return homeBounds();
    const sz = viewer.viewport.getContainerSize(), r = sz.x / Math.max(1, sz.y);
    // pro půlvýšku m a půlšířku w = m·r je obdélník kolem středu uvnitř, když pro každou hranu n·c − |nx|·w − |ny|·m ≥ b
    let m = Infinity;
    for (const { n, b } of Q.E) { const s = Math.abs(n[0]) * r + Math.abs(n[1]); m = Math.min(m, (n[0] * Q.cx + n[1] * Q.cy - b) / s); }
    const w = m * r;
    return m > 0 ? new OpenSeadragon.Rect(Q.cx - w, Q.cy - m, 2 * w, 2 * m) : homeBounds();
  }
  // mapa se nedá oddálit ani posunout tak, aby byly vidět prázdné rohy a okolí kosočtverce (Pavel 2026-11-15):
  // nejmenší přiblížení = výchozí pohled, střed výřezu se drží v menším kosočtverci (hrany posunuté o půlku výřezu)
  // Diorama (Pavel 2026-11-16): oddálit jde i za výchozí pohled, až je v okně celý obrys zástavby (townRect);
  // kolem kosočtverce je pak vidět pozadí se stínem (podložka). Bez obrysu jen na výchozí pohled jako dřív.
  // Volná mapa (Pavel 2026-11-17, po ladění zoomu): „vrátit možnost, že budou vidět i prázdná místa kolem mapy … tato funkce
  // zároveň omezuje pohyb v mapě a blízko okraje se často nedá dostat k obsahu“. Střed okna smí kamkoli na mapu
  // (kosočtverec), oddálit jde na celou mapu s 8% okrajem. Výchozí pohled dál bez prázdných rohů (fillBounds).
  // Dřívější přísné omezení (okno celé uvnitř mapy, za výchozím pohledem stahování k městu) je níž v clampCenterPrisne.
  function limitZoom() {
    const Q = mapQuad(); if (!Q) return;
    const sz = viewer.viewport.getContainerSize(), r = sz.x / Math.max(1, sz.y);
    const xs = Q.R.map((p) => p[0]), ys = Q.R.map((p) => p[1]);
    const w = Math.max(Math.max(...xs) - Math.min(...xs), (Math.max(...ys) - Math.min(...ys)) * r) * 1.08;
    viewer.viewport.minZoomLevel = 1 / w;
  }
  function clampCenter(c) {
    const Q = mapQuad(); if (!Q) return c;
    return promitni(c, Q.E.map(({ n, b }) => [n[0], n[1], b]));
  }
  function clampCenterPrisne(c, half) {
    const Q = mapQuad(); if (!Q) return c;
    const f = fillBounds(), T = townRect();
    const over = T && half.y > f.height / 2 * 1.002;           // oddáleno za výchozí pohled (tolerance na zaokrouhlení, jinak „domů“ poskočí)
    const wMin = 1 / viewer.viewport.minZoomLevel, hMin = wMin * f.height / f.width;   // pohled na doraz oddálený
    const tc = T ? [T.x + T.width / 2, T.y + T.height / 2] : null;
    // obdélník města utahovat plynule (Pavel 2026-11-17: při zoomu kolečkem mapa na hranici tmavých rohů poskočí):
    // dřív platil naráz od prvního oddálení za výchozí pohled a střed mimo obdélník do něj skočil. Teď je na výchozím
    // pohledu roztažený na celý kosočtverec (nic neomezí) a do obdélníku města se stáhne až na doraz oddálený.
    let TT = T;
    if (over) {
      const u = Math.max(0, Math.min(1, (half.y * 2 - f.height) / Math.max(1e-12, hMin - f.height)));
      const xs = Q.R.map((p) => p[0]), ys = Q.R.map((p) => p[1]), x0 = Math.min(...xs), y0 = Math.min(...ys), x1 = Math.max(...xs), y1 = Math.max(...ys);
      const l = T.x + (x0 - T.x) * (1 - u), t = T.y + (y0 - T.y) * (1 - u);
      TT = { x: l, y: t, width: T.x + T.width + (x1 - T.x - T.width) * (1 - u) - l, height: T.y + T.height + (y1 - T.y - T.height) * (1 - u) - t };
    }
    // povolená poloha středu = průnik polorovin n·p ≥ c: hrany kosočtverce posunuté o půlku pohledu, oddáleno i obdélník města
    const H = [];
    for (const { n, b } of Q.E) {
      const pr = (hx, hy) => Math.abs(n[0]) * hx + Math.abs(n[1]) * hy;
      const p = pr(half.x, half.y);
      let need = b + p;                                      // přiblíženo: pohled celý uvnitř kosočtverce
      if (over) {
        // oddáleno: povolený přesah přes hranu roste plynule od nuly (výchozí pohled) tak, aby na doraz šel střed
        // pohledu až na střed města (k ≥ 2, aby se dalo posouvat i tam, kde město leží uprostřed mapy)
        const pf = pr(f.width / 2, f.height / 2), pm = pr(wMin / 2, hMin / 2);
        const k = pm - pf > 1e-12 ? Math.max(2, (b + pm - (n[0] * tc[0] + n[1] * tc[1])) / (pm - pf)) : 2;
        need = b + p - k * (p - pf);
      }
      H.push([n[0], n[1], need]);
    }
    if (over) {                                              // vůči obdélníku města: větší pohled ho musí celý ukázat, menší z něj nevyjede
      const meze = (a, d, h) => (2 * h >= d ? [a + d - h, a + h] : [a + h, a + d - h]);
      const [x0, x1] = meze(TT.x, TT.width, half.x), [y0, y1] = meze(TT.y, TT.height, half.y);
      H.push([1, 0, x0], [-1, 0, -x1], [0, 1, y0], [0, -1, -y1]);
    }
    return promitni(c, H);
  }
  // Přesné promítnutí bodu na konvexní průnik polorovin [nx, ny, c] (n·p ≥ c): mnohoúhelník oříznutím velkého čtverce
  // (Sutherland–Hodgman), pak nejbližší bod jeho obvodu. Dřív střídavé promítání na hrany (64 kol): v rohu kosočtverce
  // nedokonvergovalo a jednotlivý snímek uletěl o stovky px a v dalším se vrátil – to bylo „poskakování“ při zoomu
  // (Pavel 2026-11-17, změřeno nastroje-pavel/test_zoom.mjs --bez-animace: páry skoků 470–490 px).
  function promitni(c, H) {
    const uvnitr = (q, [a, b, k]) => a * q[0] + b * q[1] >= k - 1e-12;
    if (H.every((h) => uvnitr([c.x, c.y], h))) return c;
    const R = 1e3;
    let P = [[c.x - R, c.y - R], [c.x + R, c.y - R], [c.x + R, c.y + R], [c.x - R, c.y + R]];
    for (const h of H) {
      const out = [];
      for (let i = 0; i < P.length; i++) {
        const A = P[i], B = P[(i + 1) % P.length], ia = uvnitr(A, h), ib = uvnitr(B, h);
        if (ia) out.push(A);
        if (ia !== ib) { const da = h[0] * A[0] + h[1] * A[1] - h[2], db = h[0] * B[0] + h[1] * B[1] - h[2], t = da / (da - db); out.push([A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t]); }
      }
      P = out; if (!P.length) break;
    }
    if (!P.length) {                                         // nesplnitelné (nemělo by nastat): nejbližší přípustné podle jednotlivých polorovin
      let x = c.x, y = c.y;
      for (const [a, b, k] of H) { const v = a * x + b * y; if (v < k) { x += a * (k - v); y += b * (k - v); } }
      return new OpenSeadragon.Point(x, y);
    }
    let best = P[0], bd = Infinity;
    for (let i = 0; i < P.length; i++) {
      const A = P[i], B = P[(i + 1) % P.length], dx = B[0] - A[0], dy = B[1] - A[1], L = dx * dx + dy * dy;
      const t = L > 0 ? Math.max(0, Math.min(1, ((c.x - A[0]) * dx + (c.y - A[1]) * dy) / L)) : 0;
      const q = [A[0] + dx * t, A[1] + dy * t], d = (q[0] - c.x) ** 2 + (q[1] - c.y) ** 2;
      if (d < bd) { bd = d; best = q; }
    }
    return new OpenSeadragon.Point(best[0], best[1]);
  }
  // podložka diorámatu: měkký stín pod kosočtvercem mapy (SVG pod plátnem OpenSeadragonu).
  // Rozmazání se nakreslí JEDNOU v pevném měřítku (kosočtverec široký PODL_S px) a při posunu a zoomu se jen přesouvá
  // a zvětšuje CSS transformací – to skládá grafická karta bez nového rastrování. (První verze přepočítávala filtr
  // s každým snímkem přes celé okno: rastrování při posunu +38 až +97 %, posun byl znatelně pomalejší – Pavel 2026-11-16,
  // změřeno nastroje-pavel/mereni_posunu.mjs.) Když mapa vyplňuje okno, stín není vidět a je skrytý úplně.
  const PODL_S = 1000, PODL_M = 60;                        // šířka kosočtverce ve stínu a okraj pro rozmazání (px)
  let podlozka = null, podlBox = null;
  const PODLOZKA = false;                                  // stín pod mapou vypnutý (Pavel 2026-11-17: „ať víme, co to bude dělat“); true = zpět
  function kresliPodlozku() {
    if (!PODLOZKA) return;
    const Q = mapQuad();
    if (!Q) { if (podlozka) podlozka.style.display = 'none'; return; }
    if (!podlozka) {
      const xs = Q.R.map((p) => p[0]), ys = Q.R.map((p) => p[1]), bx = Math.min(...xs), by = Math.min(...ys), bw = Math.max(...xs) - bx;
      podlBox = { bx, by, bw };
      const k = PODL_S / bw, H = (Math.max(...ys) - by) * k;
      const NS = 'http://www.w3.org/2000/svg';
      podlozka = document.createElementNS(NS, 'svg'); podlozka.id = 'podlozka'; podlozka.setAttribute('aria-hidden', 'true');
      podlozka.setAttribute('width', PODL_S + 2 * PODL_M); podlozka.setAttribute('height', Math.ceil(H + 2 * PODL_M));
      const body = Q.R.map(([x, y]) => `${((x - bx) * k + PODL_M).toFixed(1)},${((y - by) * k + PODL_M + H * 0.025).toFixed(1)}`).join(' ');
      podlozka.innerHTML = `<defs><filter id="podlozka-rozmaz" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="${(H * 0.02).toFixed(1)}"/></filter></defs>`
        + `<polygon id="podlozka-stin" points="${body}" filter="url(#podlozka-rozmaz)"/>`;
      $('map').insertBefore(podlozka, $('osd'));
    }
    // stín jen když okno přesahuje mapu (některý roh okna je mimo kosočtverec); jinak skrytý kvůli výkonu
    const vp = viewer.viewport, B = vp.getBounds(true);
    const oddaleno = [[B.x, B.y], [B.x + B.width, B.y], [B.x, B.y + B.height], [B.x + B.width, B.y + B.height]]
      .some(([x, y]) => Q.E.some(({ n, b }) => n[0] * x + n[1] * y < b - 1e-9));
    podlozka.style.display = oddaleno ? '' : 'none';
    if (!oddaleno) return;
    const p0 = vp.pixelFromPoint(new OpenSeadragon.Point(podlBox.bx, podlBox.by), true);
    const s = (vp.pixelFromPoint(new OpenSeadragon.Point(podlBox.bx + podlBox.bw, podlBox.by), true).x - p0.x) / PODL_S;
    podlozka.style.transform = `translate(${(p0.x - PODL_M * s).toFixed(2)}px, ${(p0.y - PODL_M * s).toFixed(2)}px) scale(${s.toFixed(5)})`;
  }
  viewer.addHandler('update-viewport', kresliPodlozku);
  let clamping = false;
  const OMEZENI_PRUZINA = 0.5;                             // 0,35 zaostávala a na hranici výchozího pohledu to dorovnalo tvrdé omezení (59 px)
  function keepInside() {
    if (clamping || !mapQuad()) return;
    const vp = viewer.viewport, b = vp.getBounds(true), c = vp.getCenter(true);
    let q = clampCenter(c);
    // Střed mimo mapu při zoomu kolečkem (oddalování u okraje): omezení dojíždí jako pružina, polovinou zbytku za snímek
    // (dřív strhlo mapu až o 93 px za jediný snímek, Pavel 2026-11-17, ?ladeni). Volá se v každém snímku (vp.update),
    // takže dojede i po skončení zoomu; z události (viewport-change) se během zoomu nedělá nic, táhlo by to dvakrát.
    // Tažení myší a ostatní pohyby: tvrdě (střed se o okraj mapy zarazí).
    if (ZK.raf && Math.hypot(q.x - c.x, q.y - c.y) * vp.getContainerSize().x / b.width > 1) {
      if (!keepInside.snimek) return;
      q = new OpenSeadragon.Point(c.x + (q.x - c.x) * OMEZENI_PRUZINA, c.y + (q.y - c.y) * OMEZENI_PRUZINA);
    }
    if (LAD) LAD.omezeni(c, q, b);
    if (Math.abs(q.x - c.x) > 1e-9 || Math.abs(q.y - c.y) > 1e-9) { clamping = true; vp.panTo(q, true); clamping = false; }
  }
  // ---------- ladění zoomu (Pavel 2026-11-17, adresa s ?ladeni): poskakování mapy při přibližování kolečkem ----------
  // Při zoomu kolečkem má bod mapy pod kurzorem zůstat pod kurzorem. Každý snímek se zapíše: výřez, střed, o kolik ho
  // posunulo omezení pohledu (keepInside) a kam ujel bod, který byl pod myší při posledním zubu („drift“). Skok = drift
  // nebo omezení se za jeden snímek změní o víc než LAD_PRAH px → rámeček bliká červeně. Na mapě: kroužek = kde je myš,
  // tečka = kde je teď bod, který pod ní byl (při správném zoomu jsou na sobě). „Uložit záznam“ pošle vše náhledovému
  // serveru (nastroje-pavel/nahled_server.py → ladeni/zoom-*.json), jinde se stáhne jako soubor.
  const LAD_PRAH = 4;
  const LAD = /[?&]ladeni\b/.test(location.search) ? {
    t0: performance.now(), snimky: [], kolecko: [], skoky: [], mys: null, kotva: null, kotvaT: -1e9, posl: null, zdroj: 'udalost', om: 0, omUd: 0,
    cas() { return Math.round(performance.now() - this.t0); },
    pxNaJednotku() { const vp = viewer.viewport; return vp.getContainerSize().x / vp.getBounds(true).width; },
    kolecko_(o, pos, vetev) {                                  // zub kolečka / švih trackpadu
      const vp = viewer.viewport;
      this.mys = { x: pos.x, y: pos.y }; this.kotva = vp.pointFromPixel(pos, true); this.kotvaT = performance.now(); this.novaKotva = true;
      this.kolecko.push([this.cas(), Math.round(o.deltaY * 10) / 10, o.deltaMode, o.ctrlKey ? 1 : 0, Math.round(pos.x), Math.round(pos.y), vetev]);
    },
    omezeni(c, q, b) {                                         // posun středu omezením pohledu (px na obrazovce)
      const d = Math.hypot(q.x - c.x, q.y - c.y) * this.pxNaJednotku();
      if (this.zdroj === 'snimek') this.om = d; else this.omUd += d;
      this.zdroj = 'udalost';
    },
    snimek() {
      const vp = viewer.viewport, b = vp.getBounds(true), c = vp.getCenter(true), k = this.pxNaJednotku();
      const km = b.width * W * cam.mpp / 1000, f = fillBounds();
      let dx = null, dy = null;
      if (this.kotva && performance.now() - this.kotvaT < 1500) { const p = vp.pixelFromPoint(this.kotva, true); dx = p.x - this.mys.x; dy = p.y - this.mys.y; }
      const zaz = [this.cas(), +km.toFixed(4), +(c.x * W).toFixed(1), +(c.y * W).toFixed(1), +this.om.toFixed(1), +this.omUd.toFixed(1),
        dx === null ? null : +dx.toFixed(1), dy === null ? null : +dy.toFixed(1), b.height > f.height * 1.002 ? 1 : 0,
        +(vp.getZoom(true) / vp.getMinZoom()).toFixed(4)];
      const p = this.posl;
      const zmena = !p || zaz[1] !== p[1] || zaz[2] !== p[2] || zaz[3] !== p[3] || zaz[4] || zaz[5];
      if (zmena) {
        this.snimky.push(zaz); if (this.snimky.length > 30000) this.snimky.splice(0, 5000);
        // pohyb bodu pod myší za snímek (s novým zubem kolečka se bod mění → první snímek se neporovnává).
        // Plynulý tah omezení (pár px za snímek, postupně slábne) skok není; skok = pohyb nad práh a náhle víc
        // než 2,5× předchozího snímku (trhnutí), nebo posun omezením z události mimo snímek (to se oko nestihne dívat).
        const zm = !this.novaKotva && p && dx !== null && p[6] !== null ? Math.hypot(dx - p[6], dy - p[7]) : 0;
        this.novaKotva = false;
        const skok = (zm > LAD_PRAH && zm > 2.5 * (this.zmPred || 0) + 2) || zaz[5] > LAD_PRAH;
        this.tah = (this.tah || 0) + zaz[4];
        if (skok) {
          this.skoky.push({ t: zaz[0], px: +Math.max(zm, zaz[5]).toFixed(1), predchozi: +(this.zmPred || 0).toFixed(1), omezeni: zaz[4], omezeniUdalost: zaz[5], km: zaz[1], oddaleno: zaz[8] });
          this.el.classList.remove('lad-skok'); void this.el.offsetWidth; this.el.classList.add('lad-skok');
        }
        this.zmPred = zm;
        this.posl = zaz;
      }
      this.om = 0; this.omUd = 0; this.zdroj = 'udalost';
      this.panel(zaz, dx, dy);
    },
    panel(z, dx, dy) {
      const mys = this.mys && performance.now() - this.kotvaT < 1500;   // kroužek a tečka každý snímek, text 10× za sekundu
      this.kruh.style.display = this.tecka.style.display = mys ? '' : 'none';
      if (mys) {
        this.kruh.style.transform = `translate(${this.mys.x}px, ${this.mys.y}px)`;
        const p = viewer.viewport.pixelFromPoint(this.kotva, true); this.tecka.style.transform = `translate(${p.x}px, ${p.y}px)`;
      }
      if (performance.now() - (this.panelT || 0) < 100) return; this.panelT = performance.now();
      const s = this.skoky[this.skoky.length - 1];
      this.info.innerHTML = `výřez <b>${z[1].toFixed(3)} km</b> · zoom ${z[9].toFixed(2)}× nejmenšího${z[8] ? ' · <b>za výchozím pohledem</b>' : ''}<br>`
        + `posun pod myší <b>${dx === null ? '–' : Math.hypot(dx, dy).toFixed(1) + ' px'}</b> · omezení ${(z[4] + z[5]).toFixed(1)} px<br>`
        + `tah omezení celkem ${Math.round(this.tah || 0)} px · úsporný režim <b>${eco ? 'ZAPNUTÝ (hrubší dlaždice)' : 'vypnutý'}</b><br>`
        + `skoků <b>${this.skoky.length}</b>${s ? ` · poslední ${s.px} px před ${((this.cas() - s.t) / 1000).toFixed(0)} s` : ''} · snímků ${this.snimky.length}`;
    },
    async uloz() {
      const vp = viewer.viewport, f = fillBounds();
      const data = { druh: 'zoom', ulozeno: new Date().toISOString(), prohlizec: navigator.userAgent, okno: [innerWidth, innerHeight], dpr: devicePixelRatio,
        sestaveni: SEST, minZoom: vp.getMinZoom(), vychoziPohled: [f.x, f.y, f.width, f.height], prah: LAD_PRAH,
        sloupce: { snimky: ['t ms', 'výřez km', 'střed x px', 'střed y px', 'omezení ve snímku px', 'omezení z události px', 'drift x px', 'drift y px', 'za výchozím pohledem', 'zoom / nejmenší'],
          kolecko: ['t ms', 'deltaY', 'deltaMode', 'ctrl', 'myš x', 'myš y', 'větev 0 = OpenSeadragon, 1 = úměrně (do 2026-11-17), 2 = jednotný plynulý zoom'] },
        usporny: eco,
        skoky: this.skoky, kolecko: this.kolecko, snimky: this.snimky };
      const txt = JSON.stringify(data);
      try {
        const r = await fetch('/ladeni', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: txt });
        if (!r.ok) throw new Error(r.status);
        this.zprava(`Uloženo: ${(await r.json()).soubor}`);
      } catch {
        const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([txt], { type: 'application/json' }));
        a.download = `zoom-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json`; a.click();
        this.zprava('Server záznam nepřijal, stáhl se jako soubor');
      }
    },
    zprava(t) { this.msg.textContent = t; clearTimeout(this.msgT); this.msgT = setTimeout(() => { this.msg.textContent = ''; }, 6000); },
    smaz() { this.snimky = []; this.kolecko = []; this.skoky = []; this.posl = null; this.tah = 0; this.zmPred = 0; this.zprava('Záznam smazán'); },
    start() {
      const st = document.createElement('style');
      st.textContent = `#ladeni{position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:9999;background:rgba(18,20,28,.86);color:#e8eaf0;
        font:12px/1.5 ui-monospace,Menlo,monospace;padding:8px 12px;border-radius:8px;border:2px solid transparent;max-width:calc(100vw - 32px)}
        #ladeni b{color:#fff}#ladeni button{font:inherit;margin:6px 6px 0 0;padding:3px 10px;border-radius:5px;border:1px solid #5a6070;background:#2a2f3c;color:#fff;cursor:pointer}
        #ladeni .lad-msg{color:#9fd49f;margin-left:4px}#ladeni.lad-skok{animation:ladSkok .5s}
        @keyframes ladSkok{0%,60%{border-color:#ff3b30;background:rgba(120,20,20,.9)}100%{border-color:transparent}}
        .lad-bod{position:fixed;left:0;top:0;z-index:9998;pointer-events:none;width:0;height:0}
        .lad-bod::after{content:'';position:absolute;border-radius:50%}
        #lad-kruh::after{left:-9px;top:-9px;width:14px;height:14px;border:2px solid #fff;box-shadow:0 0 0 1px #000}
        #lad-tecka::after{left:-4px;top:-4px;width:8px;height:8px;background:#ff3b30;box-shadow:0 0 0 1px #fff}`;
      document.head.append(st);
      this.el = document.createElement('div'); this.el.id = 'ladeni';
      this.el.innerHTML = '<div><b>Ladění zoomu</b> · točte kolečkem pomalu</div><div class="lad-info"></div>'
        + '<button type="button" data-a="uloz">Uložit záznam</button><button type="button" data-a="smaz">Smazat</button><span class="lad-msg"></span>';
      document.body.append(this.el);
      this.info = this.el.querySelector('.lad-info'); this.msg = this.el.querySelector('.lad-msg');
      this.el.addEventListener('click', (e) => { const a = e.target.dataset && e.target.dataset.a; if (a === 'uloz') this.uloz(); else if (a === 'smaz') this.smaz(); });
      for (const id of ['lad-kruh', 'lad-tecka']) { const d = document.createElement('div'); d.id = id; d.className = 'lad-bod'; document.body.append(d); }
      this.kruh = $('lad-kruh'); this.tecka = $('lad-tecka');
      // pozice kontejneru mapy: myš z OpenSeadragonu je v souřadnicích #osd, body jsou position:fixed → přičíst jeho roh
      const roh = () => $('osd').getBoundingClientRect();
      const pan = this.panel.bind(this);
      this.panel = (z, dx, dy) => { pan(z, dx, dy); const r = roh(); for (const el of [this.kruh, this.tecka]) el.style.translate = `${r.left}px ${r.top}px`; };
    },
  } : null;
  function goView(v, imm = false) {
    const b = homeBounds();
    if (!v || v.length < 2 || !v.every(Number.isFinite)) { viewer.viewport.fitBounds(fillBounds(), imm); return null; }
    const [lat, lon, km] = v, x = (lon - cam.lon0) * cam.kx, y = (lat - cam.lat0) * cam.ky;
    const [ix, iy] = toImg(x, y, gz(x, y));
    if (ix / W < b.x || ix / W > b.x + b.width || iy / W < b.y || iy / W > b.y + b.height) { viewer.viewport.fitBounds(b, imm); return null; }
    viewer.viewport.panTo(new OpenSeadragon.Point(ix / W, iy / W), imm);
    viewer.viewport.zoomTo(W * cam.mpp / (Math.min(Math.max(km > 0 ? km : 1, 0.05), W * cam.mpp / 1000) * 1000), null, imm);
    return [ix, iy];
  }
  const goHome = (imm = false) => goView(HOME_VIEW && !HOME_ALL ? HOME_VIEW : null, imm);
  viewer.addOnceHandler('open', () => {});
  // Zoom kolečkem a trackpadem JEDNÍM způsobem (Pavel 2026-11-17, ladění ?ladeni): plynulá kolečka (Magic Mouse, myši
  // s volným kolečkem v Safari) posílají zuby od 4 do 220 podle rychlosti otáčení. Dřív šly zuby pod 50 cestou trackpadu
  // (okamžitě, úměrně) a nad 50 pevným krokem OpenSeadragonu s vlastní animací → v jednom tahu se střídaly dva zoomy,
  // mapa se cukala a na 217 ms zamrzla (výřez skočil 2,34 → 2,98 km). Teď každý zub posune CÍL úměrně velikosti
  // (velký zub omezený na ZOOM_MAX_ZUB) a mapa k cíli dojíždí po snímcích (ZOOM_DOJEZD za snímek), bod pod kurzorem stojí.
  // Dojezd ve dvou stupních (mezicíl honí cíl, zoom honí mezicíl): každý krok se plynule rozjede i zastaví (křivka S).
  // S jedním stupněm ujel první snímek 30 % kroku naráz a tvrdé omezení u okraje mapy to dohánělo trhnutím 122 px
  // (nastroje-pavel/test_zoom.mjs).
  const ZOOM_K = 0.0025, ZOOM_K_STIP = 0.01, ZOOM_MAX_ZUB = 120, ZOOM_DOJEZD = 0.3;
  const ZK = { cil: 0, mez: 0, bod: null, raf: 0 };
  function zoomKrok() {
    ZK.raf = 0;
    const vp = viewer.viewport, z = vp.getZoom(true);
    ZK.mez = Math.abs(Math.log(ZK.cil / ZK.mez)) < 0.001 ? ZK.cil : ZK.mez * Math.pow(ZK.cil / ZK.mez, ZOOM_DOJEZD);
    const dalsi = ZK.mez === ZK.cil && Math.abs(Math.log(ZK.cil / z)) < 0.002 ? ZK.cil : z * Math.pow(ZK.mez / z, ZOOM_DOJEZD);
    vp.zoomTo(dalsi, ZK.bod, true);
    if (dalsi !== ZK.cil) ZK.raf = requestAnimationFrame(zoomKrok);
  }
  viewer.addHandler('canvas-scroll', (e) => {
    const o = e.originalEvent;
    if (!o) return;
    if (LAD) LAD.kolecko_(o, e.position, 2);
    e.preventDefaultAction = true;
    const dy = o.deltaY * (o.deltaMode === 1 ? 33 : o.deltaMode === 2 ? 800 : 1);   // řádky (Firefox) a stránky na px
    const vp = viewer.viewport, f = Math.exp(-Math.max(-ZOOM_MAX_ZUB, Math.min(ZOOM_MAX_ZUB, dy)) * (o.ctrlKey ? ZOOM_K_STIP : ZOOM_K));
    const z0 = ZK.raf ? ZK.cil : vp.getZoom(true);                 // během dojezdu se přičítá k cíli, jinak od současného stavu
    if (!ZK.raf) ZK.mez = z0;
    ZK.cil = Math.max(vp.getMinZoom(), Math.min(vp.getMaxZoom(), z0 * f));
    ZK.bod = vp.pointFromPixel(e.position, true);
    if (!ZK.raf) ZK.raf = requestAnimationFrame(zoomKrok);
  });
  if ('ongesturestart' in window && !('ontouchstart' in window)) {   // Safari na Macu neposílá štípnutí jako kolečko
    let gs = 1;
    $('osd').addEventListener('gesturestart', (e) => { e.preventDefault(); gs = 1; });
    $('osd').addEventListener('gesturechange', (e) => { e.preventDefault(); viewer.viewport.zoomBy(e.scale / gs); viewer.viewport.applyConstraints(); gs = e.scale; });
  }
  const layersReady = initLayers();
  const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  function applyTime() {
    const t = state.night;
    const warm = Math.max(0, 1 - Math.abs(t - 0.42) / 0.32) * 0.8;
    if (warmItem) warmItem.setOpacity(warm * 0.32);
    if (darkItem) darkItem.setOpacity(smooth(0.35, 0.95, t) * 0.78);
    for (const l of LAYERS) if (l.light) l.light.setOpacity(shown(l.key) ? smooth(0.5, 0.95, t) : 0);
    const d = smooth(0.35, 0.95, t);
    const mix = (a, b) => Math.round(a + (b - a) * d);
    $('map').style.background = $('osd').style.background = `rgb(${mix(27 + warm * 30, 9)},${mix(35 + warm * 12, 12)},${mix(51, 24)})`;
    $('mTime').textContent = t < 0.25 ? 'Den' : t < 0.7 ? 'Soumrak' : 'Noc';
  }
  function applyVisibility() {
    for (const l of LAYERS) if (l.day) l.day.setOpacity(layerOpacity(l));
    for (const l of LAYERS) for (const e of Object.values(l.extra || {})) if (e.it) e.it.setOpacity(layerOpacity(l));
    for (const p of OV.places) if (p.el) p.el.hidden = !shown(p.k);
    for (const p of PAMATKY) if (p.el) p.el.hidden = !shown(p.k);
    for (const p of PODNIKY) if (p.el) p.el.hidden = !shown(p.k);
    for (const p of VEREJNA) if (p.el) p.el.hidden = !shown(p.k);
    for (const n of OV.neighbors || []) if (n.el) n.el.hidden = !shown(n.k);
    for (const n of OV.needs || []) if (n.el) n.el.hidden = !state.wip;
    document.querySelectorAll('[data-wip]').forEach((b) => b.setAttribute('aria-pressed', String((b.dataset.wip === '1') === state.wip)));
    if (typeof renderPlaces === 'function') renderPlaces();
    applyTime();
    if (typeof loadVisible === 'function' && ready) loadVisible();
  }
  function setSeason(s) {
    document.querySelectorAll('[data-s]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.s === s)));
    if (s === state.season && ready) return;
    const wasWinter = state.season === 'winter';
    state.season = s;
    if (s === 'winter' && state.weather === 'clear') setWeather('snow');
    if (wasWinter && s !== 'winter' && state.weather === 'snow') setWeather('clear');
    setWeather(state.weather);
    if (!ready) return;
    addPreview(s).then(reorder);
    // každý čtverec drží jako podklad poslední úplně načtenou vrstvu (l.base) a nad ní novou (l.day);
    // podklad se smaže až po úplném načtení nové, i kdyby to bylo až po posunu mapy. Jinak by v bližším čtverci
    // zůstala díra a byl by vidět řez zeminou vzdálenějšího. Nejvýš dvě vrstvy na čtverec.
    LAYERS.forEach((l) => {
      const gen = l.gen = (l.gen || 0) + 1;
      viewer.addTiledImage({ tileSource: l.src(s), x: l.x, y: l.y, width: l.w, opacity: layerOpacity(l), success: (e) => {
        if (gen !== l.gen) { viewer.world.removeItem(e.item); return; }        // mezitím přepnuto jinam: pozdní vrstva pryč
        if (l.day && l.day !== l.base) viewer.world.removeItem(l.day);        // nedonačtená mezivrstva (podklad zůstává)
        l.day = e.item; reorder();                                           // hned na správné místo, ne navrch všeho
        const settle = () => {
          if (l.day !== e.item || !e.item.getFullyLoaded()) return;
          if (l.base && l.base !== e.item) viewer.world.removeItem(l.base);
          l.base = e.item; reorder();
        };
        if (e.item.getFullyLoaded()) settle(); else e.item.addHandler('fully-loaded-change', settle);
      } });
    });
    loadMini();
    applyExtras();
  }
  const snowAllowed = () => state.season === 'autumn' || state.season === 'winter';
  function setWeather(w) {
    if (w === 'snow' && !snowAllowed()) w = 'clear';
    state.weather = w;
    const sb = document.querySelector('[data-w="snow"]');
    sb.disabled = !snowAllowed(); sb.title = snowAllowed() ? '' : 'Sníh jen na podzim a v zimě';
    document.querySelectorAll('[data-w]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.w === w)));
  }
  document.querySelectorAll('[data-s]').forEach((b) => b.addEventListener('click', () => { if (b.dataset.s !== state.season) $('realWeather').checked = false; setSeason(b.dataset.s); }));
  const saveRW = (v) => { try { localStorage.setItem('izo-realweather', v ? '1' : '0'); } catch {} };
  document.querySelectorAll('[data-w]').forEach((b) => b.addEventListener('click', () => { $('realWeather').checked = false; saveRW(false); setWeather(b.dataset.w); }));
  applyRealWeather = () => { if ($('realWeather').checked && realWeather) setWeather(realWeather); };
  $('realWeather').addEventListener('change', (e) => { saveRW(e.target.checked); applyRealWeather(); });
  if ({{POCASI}}) {
    $('realWeatherRow').hidden = false;
    // výchozí vypnuté (Pavel 2026-11-19), zapne si ho každý sám a volba se pamatuje (dřív výchozí zapnuté)
    let rwOn = false; try { rwOn = localStorage.getItem('izo-realweather') === '1'; } catch {}
    $('realWeather').checked = rwOn && !hashTokens.some((t) => SEASON_TOKEN[t] || t === 'noc' || t === 'soumrak');   // sdílený odkaz si drží svůj vzhled
  }
  document.querySelectorAll('[data-wip]').forEach((b) => b.addEventListener('click', () => { state.wip = b.dataset.wip === '1'; applyVisibility(); viewer.viewport.fitBounds(homeBounds()); }));
  document.querySelectorAll('[data-wip]').forEach((b) => b.setAttribute('aria-pressed', String((b.dataset.wip === '1') === state.wip)));
  // výchozí roční období podle kalendáře (Pavel 2026-11-21): prosinec–únor zima, březen–květen jaro, červen–srpen léto,
  // září–listopad podzim. Odkaz s ročním obdobím si drží svoje. Zima od kalendáře bez padajícího sněhu (Pavel 2026-11-20),
  // skutečné počasí (když je zapnuté) sníh přidá samo.
  const obdobiKalendar = ['winter', 'spring', 'summer', 'autumn'][Math.floor(((new Date().getMonth() + 1) % 12) / 3)];
  const odKalendare = !hashTokens.some((t) => SEASON_TOKEN[t]);
  if (odKalendare) state.season = sezAktivni && SEZ.obdobi ? SEZ.obdobi : obdobiKalendar;
  setSeason(state.season); setWeather(odKalendare ? (sezAktivni && SEZ.pocasi ? SEZ.pocasi : 'clear') : state.weather); applyRealWeather();
  $('night').value = Math.round(state.night * 100);
  $('night').addEventListener('input', (e) => { state.night = e.target.value / 100; $('realTime').checked = false; saveRT(false); applyTime(); });
  // denní doba podle skutečné výšky slunce nad městem (zapíná se volitelně, pamatuje si to prohlížeč)
  function sunAlt(d) {
    const rad = Math.PI / 180, lat = OV.cam.lat0, lon = OV.cam.lon0;
    const day = (Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - Date.UTC(d.getUTCFullYear(), 0, 0)) / 864e5;
    const dec = -23.44 * Math.cos(2 * Math.PI / 365 * (day + 10)) * rad;
    const hour = d.getUTCHours() + d.getUTCMinutes() / 60 + lon / 15 - 12;          // sluneční čas
    const ha = hour * 15 * rad;
    return Math.asin(Math.sin(lat * rad) * Math.sin(dec) + Math.cos(lat * rad) * Math.cos(dec) * Math.cos(ha)) / rad;
  }
  const nightFromSun = (a) => (a > 8 ? 0 : a > 0 ? 0.42 * (1 - a / 8) + 0.0 : a > -7 ? 0.42 + 0.58 * (-a / 7) : 1);
  const saveRT = (v) => { try { localStorage.setItem('izo-realtime', v ? '1' : '0'); } catch {} };
  function tickReal() {
    if (!$('realTime').checked) return;
    state.night = Math.round(nightFromSun(sunAlt(new Date())) * 100) / 100; $('night').value = Math.round(state.night * 100); applyTime();
  }
  $('realTime').addEventListener('change', (e) => { saveRT(e.target.checked); tickReal(); });
  // výchozí stav: den, skutečný čas vypnutý (zapne si ho každý sám, volba se pak pamatuje)
  try { if (localStorage.getItem('izo-realtime') === '1' && !hashTokens.includes('noc') && !hashTokens.includes('soumrak')) { $('realTime').checked = true; } } catch {}
  setInterval(tickReal, 60000);
  $('mTime').addEventListener('click', () => { state.night = state.night < 0.25 ? 0.42 : state.night < 0.7 ? 1 : 0; $('realTime').checked = false; saveRT(false); $('night').value = Math.round(state.night * 100); applyTime(); });

