  // ---------- moje poloha (F18, Pavel 2026-11-18) ----------
  // Tlačítko #poloha přidá web/nase.js pod Sdílet. Klepnutí zapne sledování polohy (prohlížeč se zeptá na svolení),
  // mapa skočí na první polohu, modrá tečka se pak posouvá. Kroužek přesnosti je kružnice na zemi, v izometrii elipsa,
  // a jako obdélníkový overlay OpenSeadragonu se sám zvětšuje s přiblížením. Druhé klepnutí vypne. Poloha nikam neodchází.
  {
    const btn = $('poloha');
    if (btn && navigator.geolocation) {
      let hlidac = null, tecka = null, kruh = null, prvni = true;
      const zprava = (t) => { $('toast').textContent = t; $('toast').hidden = false; clearTimeout(zprava.t); zprava.t = setTimeout(() => { $('toast').hidden = true; }, 3500); };
      const vMape = (x, y) => cam.grounds.some((q) => Math.abs(x - q.cx) <= cam.half && Math.abs(y - q.cy) <= cam.half);
      const vypni = () => {
        if (hlidac !== null) navigator.geolocation.clearWatch(hlidac);
        hlidac = null;
        for (const o of [kruh, tecka]) if (o) viewer.removeOverlay(o);
        kruh = tecka = null;
        btn.setAttribute('aria-pressed', 'false'); btn.classList.remove('nb-hleda');
      };
      const mam = (p) => {
        btn.classList.remove('nb-hleda');
        const { latitude: lat, longitude: lon, accuracy } = p.coords;
        const x = (lon - cam.lon0) * cam.kx, y = (lat - cam.lat0) * cam.ky;
        if (!vMape(x, y)) { vypni(); if (!tise) zprava('Jste mimo oblast mapy.'); return; }
        const h = gz(x, y), [ix, iy] = toImg(x, y, h);
        const r = Math.min(Math.max(accuracy || 0, 4), 3000);
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        for (let i = 0; i < 24; i++) {
          const a = i / 24 * 2 * Math.PI, [px, py] = toImg(x + r * Math.cos(a), y + r * Math.sin(a), h);
          x0 = Math.min(x0, px); y0 = Math.min(y0, py); x1 = Math.max(x1, px); y1 = Math.max(y1, py);
        }
        const obrys = new OpenSeadragon.Rect(x0 / W, y0 / W, (x1 - x0) / W, (y1 - y0) / W), bod = new OpenSeadragon.Point(ix / W, iy / W);
        if (!tecka) {
          kruh = document.createElement('div'); kruh.className = 'poloha-kruh';
          tecka = document.createElement('div'); tecka.className = 'poloha-tecka';
          viewer.addOverlay({ element: kruh, location: obrys, checkResize: false });
          viewer.addOverlay({ element: tecka, location: bod, placement: OpenSeadragon.Placement.CENTER, checkResize: false });
        } else {
          viewer.updateOverlay(kruh, obrys);
          viewer.updateOverlay(tecka, bod, OpenSeadragon.Placement.CENTER);
        }
        if (prvni) { prvni = false; goTo(ix, iy, 1.4); }
      };
      let tise = false;                                      // samo zapnuté při startu: žádné hlášky, mimo mapu se jen vypne
      const chyba = (e) => {
        vypni();
        if (!tise) zprava(e.code === 1 ? 'Poloha není povolená. Povolte ji v nastavení prohlížeče.' : 'Polohu se nepodařilo zjistit.');
      };
      const spust = (skok) => {
        prvni = skok; btn.setAttribute('aria-pressed', 'true'); btn.classList.add('nb-hleda');
        hlidac = navigator.geolocation.watchPosition(mam, chyba, { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 });
      };
      btn.addEventListener('click', () => {
        if (hlidac !== null) { vypni(); return; }
        tise = false; spust(true);
      });
      // výchozí zapnutá (Pavel 2026-11-19), ale jen tomu, kdo polohu této stránce už povolil: nikomu nevyskočí dotaz prohlížeče.
      // Sdílený odkaz na místo (…@lat,lon) si drží svůj pohled, poloha se jen ukáže; mimo mapu se potichu vypne.
      navigator.permissions?.query({ name: 'geolocation' }).then((s) => {
        if (s.state !== 'granted' || hlidac !== null) return;
        tise = true; spust(!location.hash.includes('@'));
      }).catch(() => {});
    }
  }
