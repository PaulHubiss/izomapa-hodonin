  // počasí: částice v souřadnicích obrazovky
  const drops = Array.from({ length: 420 }, (_, i) => ({ x: rnd(i * 2.1), y: rnd(i * 3.7), v: 0.6 + rnd(i * 5.3) * 0.5, s: rnd(i * 7.1) }));
  const fogTex = (() => { const c = document.createElement('canvas'); c.width = 48; c.height = 28; const g = c.getContext('2d');
    for (let y = 0; y < 28; y++) for (let x = 0; x < 48; x++) { const v = (Math.sin(x * 0.35) + Math.sin(y * 0.6 + x * 0.12) + Math.sin((x + y) * 0.21)) / 3; g.fillStyle = `rgba(226,232,240,${(0.18 + 0.2 * Math.max(0, v)).toFixed(3)})`; g.fillRect(x, y, 1, 1); }
    return c; })();

  let last = performance.now(), skip = false, miniKey = '', scaleTxt = '';
  // úsporný režim: hrubší dlaždice, méně souběžných stahování a animace na 30 fps. Zapne se sám, když prohlížeč nestíhá
  // animace (víc než čtvrtina snímků přes 34 ms ve dvou 3s oknech po sobě), a ohlásí to. Měří se jen v klidu: při zoomu,
  // posunu a dočítání dlaždic jsou pomalejší snímky normální (Pavel 2026-11-17: zapnul se mu po zkoušení zoomu, nevěděl
  // o něm a obraz byl „kostičkovaný“; dřív se zapínal po jednom okně a držel i přes obnovení stránky).
  // Přepínač „Úsporný režim“ v menu Vzhled, blok Výkon (web/nase.js): ruční volba platí do zavření karty a automatika ji nepřepíše.
  let eco = false, ecoRucne = null, perfN = 0, perfSlow = 0, perfW = 0, perfSpatne = 0, perfT0 = performance.now() + 8000;   // prvních 8 s se načítá, neměřit
  try { const s = sessionStorage.getItem('izo-eco'); if (s === '1' || s === '0') ecoRucne = s === '1'; } catch {}
  const ECO_PUV = { mpr: null, job: null };
  function setEco(on = true, jak = 'auto') {
    if (ECO_PUV.mpr === null) { ECO_PUV.mpr = viewer.minPixelRatio || 0.6; ECO_PUV.job = viewer.imageLoader ? viewer.imageLoader.jobLimit : 0; }
    eco = on;
    if (jak === 'rucne') { ecoRucne = on; try { sessionStorage.setItem('izo-eco', on ? '1' : '0'); } catch {} }
    viewer.minPixelRatio = on ? Math.max(ECO_PUV.mpr, 1.2) : ECO_PUV.mpr;
    for (let i = 0; i < viewer.world.getItemCount(); i++) viewer.world.getItemAt(i).minPixelRatio = viewer.minPixelRatio;
    if (viewer.imageLoader) viewer.imageLoader.jobLimit = on ? 4 : ECO_PUV.job;
    viewer.forceRedraw();
    if ($('ecoBox')) $('ecoBox').checked = on;
    if (jak === 'auto') {
      $('toast').textContent = 'Prohlížeč nestíhal, mapa přešla do úsporného režimu (vypnout jde v menu Vzhled, Výkon).';
      $('toast').hidden = false; clearTimeout(setEco.t); setEco.t = setTimeout(() => { $('toast').hidden = true; }, 6000);
    }
  }
  if (ecoRucne) setEco(true, 'start');
  if ($('ecoBox')) { $('ecoBox').checked = eco; $('ecoBox').addEventListener('change', (e) => setEco(e.target.checked, 'rucne')); }
  function perf(ms) {
    // neměřit: už úsporně, ručně zvoleno, skrytá karta, dlouhá pauza, načítání po startu, a do 1,5 s od pohybu mapy
    if (eco || ecoRucne !== null || document.hidden || ms > 250 || performance.now() < perfT0 || performance.now() - osdT < 1500) { perfN = perfSlow = 0; return; }
    const now = performance.now(); if (!perfN) perfW = now;
    perfN++; if (ms > 34) perfSlow++;
    if (now - perfW > 3000) {                                // okno 3 s; úsporně až po dvou špatných oknech po sobě
      perfSpatne = perfN > 20 && perfSlow / perfN > 0.25 ? perfSpatne + 1 : 0;
      if (perfSpatne >= 2) setEco(true, 'auto');
      perfN = perfSlow = 0;
    }
  }
