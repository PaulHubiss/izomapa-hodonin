  // ---------- Den za minutu (Pavel 2026-11-26, napady/ZABAVA.md bod 1) ----------
  // Vypínač ve Vzhledu pod „Podle skutečného času“ (stejný řádek jako ostatní, hodiny běží vpravo vedle vypínače; vyskakovací
  // lišta zrušena, Pavel 2026-11-26): ve městě uteče 24 hodin za 60 s, od 4:00 do 4:00 dnešního dne. Svítání, ranní autobusy podle
  // jízdního řádu, lidé, setmění, rozsvícená okna. Virtuální hodiny DZM (00-zaklad.js) čte pragueNow, hustota aut, aktivita lidí
  // a zvířat i výška slunce; během ukázky se chovají jako „Podle skutečného času“ (podleHodin()), vypínač se ale nepřepne. Na konci (nebo po vypnutí, pohnutí posuvníkem
  // denní doby či přepnutí skutečného času) se vše vrátí, jak bylo. Živé polohy MHD se během ukázky nepoužijí (jsou z jiného času).
  // Panel se na telefonu nezavírá, ať jsou hodiny vidět (zavřít ho jde ručně).
  const DZM_DELKA = 60, DZM_OD = 4;                          // s skutečného času na 24 h, začátek v hodinách
  let dzmPred = null;
  const dzmCas = (h) => `${Math.floor(h)}:${String(Math.floor(h % 1 * 60 / 5) * 5).padStart(2, '0')}`;   // po 5 minutách, ať číslo neblikává
  function dzmStart() {
    if (DZM) return;
    const s = pragueNow().s;
    dzmPred = { night: state.night };                        // vypínač „Podle skutečného času“ se nepřepíná (podleHodin() v 00-zaklad.js)
    DZM = { t0: performance.now(), v0: Date.now() - (s - DZM_OD * 3600) * 1000, k: 86400 / DZM_DELKA };
    $('dzm').checked = true; $('dzmCas').textContent = dzmCas(DZM_OD);
    if (window.__test) window.__test.dzm = { start: true };
    requestAnimationFrame(dzmKrok);
  }
  function dzmStop() {
    if (!DZM) return;
    DZM = null;
    if ($('realTime').checked) tickReal(); else { state.night = dzmPred.night; $('night').value = Math.round(state.night * 100); applyTime(); }
    $('dzm').checked = false; $('dzmCas').textContent = '';
    MHD.t = -1;                                              // jedoucí spoje hned podle skutečného času
    if (window.__test) window.__test.dzm = { ...window.__test.dzm, konec: true };
  }
  function dzmKrok() {
    if (!DZM) return;
    const uteklo = (performance.now() - DZM.t0) / 1000;
    if (uteklo >= DZM_DELKA) { dzmStop(); return; }
    tickReal();                                              // denní doba ze slunce ve virtuálním čase
    const h = (DZM_OD + uteklo / DZM_DELKA * 24) % 24;
    $('dzmCas').textContent = dzmCas(h);
    if (window.__test) window.__test.dzm.h = h;
    requestAnimationFrame(dzmKrok);
  }
  $('dzmRadek').hidden = false;
  $('dzm').addEventListener('change', (e) => (e.target.checked ? dzmStart() : dzmStop()));
  $('night').addEventListener('input', () => { if (DZM) { dzmPred.night = state.night; dzmStop(); } });   // ruční denní doba ukázku ukončí
  $('realTime').addEventListener('change', () => { if (DZM) dzmStop(); });
