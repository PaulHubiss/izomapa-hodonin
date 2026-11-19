  // ---------- karta ----------
  const ROOF = { flat: 'plochá', gabled: 'sedlová', hipped: 'valbová', pyramidal: 'stanová' };
  // kind = co karta ukazuje, pro Sdílet (…@lat,lon,km,kind): 1 budova, 2 památka, 3 místo / sousední mapa, 4 bod; 0 = kartu nesdílet, jen pohled (zastávka)
  // ikonka místa, jehož karta je otevřená: výrazná a třikrát blikne (Pavel 2026-11-17: „splývá s ostatními ikonkami“).
  // Podle polohy karty, takže platí pro všechny cesty (klik na ikonku, seznam v Místech, hledání, odkaz).
  // Bez karty (Ukázat na mapě u webkamery…) se volá přes window.IZO_OZNAC s větším dosahem: blikne nejbližší ikonka místa
  // (Pavel 2026-11-19: „mělo by to platit obecně v aplikaci“).
  function oznacPin(lat, lon, dosah = 3) {
    for (const e of document.querySelectorAll('.pin.ikp.vybrany')) e.classList.remove('vybrany');
    if (lat == null || lon == null) return;
    let best = null, bd = dosah;                             // m
    for (const p of PINY) { if (p.lat == null) continue; const d = Math.hypot(lat - p.lat, (lon - p.lon) * Math.cos(lat * Math.PI / 180)) * 111320; if (d < bd) { bd = d; best = p; } }
    if (best) { const e = best.el; e.classList.remove('vybrany'); void e.offsetWidth; e.classList.add('vybrany'); }   // znovu spustit bliknutí
    return best;
  }
  window.IZO_OZNAC = (lat, lon, dosah = 60) => oznacPin(lat, lon, dosah);
  function showCard({ title, text, rows, lon, lat, k, link, linkText, target, extra, foto, kind = 0 }) {
    oznacPin(lat, lon);
    state.card = kind ? { lat, lon, kind } : null;
    $('cardShare').hidden = !kind;                          // zastávka: odkaz na kartu by nic neotevřel
    $('cardProgram').hidden = true; $('cardProgram').replaceChildren();
    $('cardVyl').hidden = true; $('cardVyl').replaceChildren();
    $('cardTitle').textContent = title;
    // fotka (památky z Wikimedia Commons): autor a licence pod ní, odkaz na stránku souboru
    $('cardFoto').hidden = !foto;
    if (foto) {
      $('cardFotoImg').src = foto.url; $('cardFotoImg').alt = foto.alt || title; $('cardFotoA').href = foto.stranka;
      const c = document.createElement('a'); c.href = foto.stranka; c.target = '_blank'; c.rel = 'noopener'; c.textContent = 'Wikimedia Commons';
      $('cardFotoCap').replaceChildren(`Foto: ${[foto.autor, foto.licence].filter(Boolean).join(', ')}, `, c);
    } else $('cardFotoImg').removeAttribute('src');
    if (k && !(LAYERS.find((l) => l.key === k) || {}).status?.startsWith('hotovo')) { const t = document.createElement('span'); t.className = 'wip-tag'; t.textContent = 'Rozpracováno'; $('cardTitle').append(' ', t); }
    $('cardText').hidden = !text; $('cardText').textContent = text || '';
    const dl = $('cardDl'); dl.replaceChildren(); dl.classList.remove('odjezdy');
    for (const [k, v] of rows) { if (v === undefined || v === null || v === '') continue; const dt = document.createElement('dt'); dt.textContent = k; const dd = document.createElement('dd'); dd.textContent = v; dl.append(dt, dd); }
    const links = $('cardLinks'); links.replaceChildren();
    if (link) {
      const btn = document.createElement('a'); btn.href = link; btn.className = 'card-neighbor-btn';
      if (target) btn.target = target;
      if (btn.target === '_blank') btn.rel = 'noopener';
      btn.textContent = linkText || `Přejít na mapu ${title} ↗`;
      links.append(btn);
    }
    const a = document.createElement('a'); a.target = '_blank'; a.rel = 'noopener';
    a.href = `https://mapy.cz/zakladni?x=${lon.toFixed(6)}&y=${lat.toFixed(6)}&z=19&source=coor&id=${lon.toFixed(6)}%2C${lat.toFixed(6)}`;
    a.textContent = 'Ukázat ve skutečnosti (Mapy.cz)';
    const s = document.createElement('a'); s.target = '_blank'; s.rel = 'noopener';
    s.href = `https://mapy.cz/letecka?x=${lon.toFixed(6)}&y=${lat.toFixed(6)}&z=19`; s.textContent = 'Letecký snímek';
    links.append(a, s);
    for (const [href, txt] of extra || []) {                 // další odkazy (budova: údaje v katastru)
      const e = document.createElement('a'); e.target = '_blank'; e.rel = 'noopener'; e.href = href; e.textContent = txt; links.append(e);
    }
    $('card').style.transform = '';
    $('card').hidden = false;
    setReport(`pt:${lat.toFixed(5)},${lon.toFixed(5)}`, title, lon, lat);     // výchozí cíl hlášení = místo, budova ho přepíše
  }
  // hlášení nepřesností: jen když je zapnuté v mesto.json ("hlaseni": true) a běží server z hlaseni/
  const HLASENI = {{HLASENI}};
  $('report').hidden = !HLASENI;
  let repTarget = null;
  const repMsg = (t, cls) => { $('repMsg').textContent = t; $('repMsg').className = cls ? 'rep-' + cls : ''; };
  function setReport(target, title, lon, lat) {
    repTarget = { target, title, lon, lat };
    window.IZO_KARTA = { title, lat, lon };   // pro odkaz „Napište nám“ v kartě (web/nase.js, Pavel 2026-11-19)
    $('report').open = false; repMsg('', ''); $('repNote').value = '';
  }
  $('reportForm').addEventListener('submit', async (e) => {
    e.preventDefault(); if (!repTarget) return;
    if ($('repNote').value.trim().length < 3) { repMsg('Napište prosím, co tu nesedí (aspoň pár slov).', 'err'); return; }
    $('reportForm').querySelector('button').disabled = true;
    repMsg('Odesílám…', '');
    try {
      const r = await fetch('api/report', { method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...repTarget, note: $('repNote').value.trim() }) });
      const d = await r.json().catch(() => ({}));
      if (d.ok) { $('repNote').value = ''; repMsg('Díky! Hlášení je odeslané.', 'ok'); }
      else repMsg(d.msg || 'Hlášení se nepovedlo odeslat. Zkuste to prosím za chvíli.', 'err');
    } catch { repMsg('Hlášení teď nejde odeslat (bez připojení?). Zkuste to prosím později.', 'err'); }
    $('reportForm').querySelector('button').disabled = false;
  });
  // speciální místo k budově: špendlík místa leží v obrysu budovy a budova je do 35 m (OSM má jiné názvy, „sv. Jan Křtitel“)
  const geoM = (lat, lon, p) => Math.hypot(lat - p.lat, (lon - p.lon) * Math.cos(p.lat * Math.PI / 180)) * 111320;
  function placeOf(b) {
    let best = null, bd = 35;
    for (const p of OV.places) { const d = geoM(b.lat, b.lon, p); if (d < bd && inPoly(p.xy[0], p.xy[1], b.hull)) { best = p; bd = d; } }
    return best;
  }
  function pamOf(b) {                                      // památka v obrysu budovy (kostel, radnice, zámek), nejbližší do 35 m
    let best = null, bd = 35;
    for (const p of PAMATKY) { const d = geoM(b.lat, b.lon, p); if (d < bd && inPoly(p.xy[0], p.xy[1], b.hull)) { best = p; bd = d; } }
    return best;
  }
  const pamLinks = (p) => [p.katalog && [p.katalog, 'Památkový katalog (NPÚ)'], p.wiki && [p.wiki, 'Wikipedie']].filter(Boolean);
  function showPamatka(p) {
    if (p.uMista) { placeCard(p.uMista); return; }           // památka má ikonku jiného místa (příběh, kostel, muzeum): jeho karta
    if (p.uVer) { showVerejne(p.uVer); return; }
    state.sel = null;
    showCard({ title: p.nazev, rows: [['Kulturní památka', `ÚSKP ${p.uskp}`]], lon: p.lon, lat: p.lat, k: p.k,
               foto: p.foto ? { ...p.foto, alt: p.nazev } : null, extra: pamLinks(p), kind: 2 });
  }
  function showPodnik(p) {
    state.sel = null;
    const kuch = (p.kuchyne || '').split(';').map((c) => POD_KUCH[c.trim()] || c.trim().replace(/_/g, ' ')).filter(Boolean).join(', ');
    const t = ohParse(p.oteviraci), ted = t && ohTed(t);
    const rows = [['Druh', [POD_DRUH[p.druh] || 'Podnik', kuch].filter(Boolean).join(' · ')], ['Adresa', p.adresa]];
    if (ted) rows.push(['Teď', ted[1]], ...ohRadky(t));
    else if (p.oteviraci) rows.push(['Otevřeno', ohPreklad(p.oteviraci)]);
    rows.push(['Telefon', p.telefon]);
    const extra = [p.web && [p.web, 'Web podniku'], p.facebook && [p.facebook, 'Facebook'],
      p.osm ? [p.osm, 'Údaje v OpenStreetMap'] : null].filter(Boolean);
    showCard({ title: p.nazev, rows, lon: p.lon, lat: p.lat, k: p.k, extra, kind: 5 });
    if (ted) { const dd = $('cardDl').querySelectorAll('dd')[[...$('cardDl').querySelectorAll('dt')].findIndex((x) => x.textContent === 'Teď')];
      if (dd) dd.className = `oh-ted ${ted[0] ? 'otevreno' : 'zavreno'}`; }
  }
  // karta veřejného místa: druh, adresa, otevírací doba (sezónní podle dnešního data), poznámka, telefon, web, zdroj údajů
  const MES = ['ledna', 'února', 'března', 'dubna', 'května', 'června', 'července', 'srpna', 'září', 'října', 'listopadu', 'prosince'];
  const mesDen = (md) => { const [m, d] = md.split('-').map(Number); return `${d}. ${MES[m - 1]}`; };
  function verRadky(p) {                                    // řádky karty s otevírací dobou (i pro kartu příběhu, který je zároveň veřejným místem)
    const o = verOteviraci(p), t = o && ohParse(o.oh), ted = t && ohTed(t), rows = [];
    if (ted) rows.push(['Teď', ted[1]], ...ohRadky(t));
    else if (o) rows.push(['Otevřeno', ohPreklad(o.oh)]);
    if (o && o.od) rows.push(['Platí', `${mesDen(o.od)} – ${mesDen(o.do)}`]);
    rows.push(['Poznámka', p.poznamka]);
    return { rows, ted };
  }
  const tedBarva = (ted) => { if (!ted) return; const dd = $('cardDl').querySelectorAll('dd')[[...$('cardDl').querySelectorAll('dt')].findIndex((x) => x.textContent === 'Teď')];
    if (dd) dd.className = `oh-ted ${ted[0] ? 'otevreno' : 'zavreno'}`; };
  function showVerejne(p) {
    if (p.uMista) { placeCard(p.uMista); return; }
    state.sel = null;
    const { rows: oh, ted } = verRadky(p), pm = p.pam;
    const rows = [['Druh', p.druh], ...(pm ? [['Kulturní památka', `ÚSKP ${pm.uskp}`]] : []), ['Adresa', p.adresa], ...oh, ['Telefon', p.telefon]];
    const overeno = p.overeno ? new Date(p.overeno).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric' }) : null;
    const extra = [p.web && [p.web, 'Web'], p.zdroj && p.zdroj !== p.web && [p.zdroj, 'Zdroj otevírací doby'], ...(pm ? pamLinks(pm) : []),
      p.osm && [p.osm, 'Údaje v OpenStreetMap']].filter(Boolean);
    showCard({ title: p.nazev, text: overeno ? `Otevírací doba podle webu ${new URL(p.zdroj || p.web).hostname.replace(/^www\./, '')}, ověřeno ${overeno}.` : '',
      rows, lon: p.lon, lat: p.lat, k: p.k, extra, kind: 6, foto: pm && pm.foto ? { ...pm.foto, alt: pm.nazev } : null });
    tedBarva(ted);
  }
  // místo a památka na stejném bodě (do 30 m, nejbližší další dvojice je 83 m daleko): na mapě jen popisek místa,
  // jeho karta dostane fotku a údaje památky; památka zůstává v hledání a odkazech
  for (const p of OV.places) { let best = null, bd = 30; for (const m of PAMATKY) { const d = geoM(p.lat, p.lon, m); if (d < bd) { best = m; bd = d; } } if (best) { p.pam = best; best.uMista = p; } }
  // veřejné místo, které je zároveň příběhem (stejný název do 150 m, např. Zoo Hodonín): jedna ikonka, karta příběhu s otevírací dobou
  const nazevKlic = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
  for (const v of VEREJNA) { const p = OV.places.find((q) => nazevKlic(q.name) === nazevKlic(v.nazev) && geoM(q.lat, q.lon, v) < 150); if (p) { v.uMista = p; p.ver = v; } }
  // památka do 30 m od veřejného místa (kostel, muzeum): jedna ikonka v jeho kategorii, karta s fotkou a číslem památky
  // (jen budovy: WC, parkoviště nebo park vedle sochy památkou nejsou)
  for (const v of VEREJNA) { if (v.uMista || ['sluzby', 'doprava', 'priroda'].includes(v.skupina)) continue; let best = null, bd = 30;
    for (const m of PAMATKY) { if (m.uMista || m.uVer) continue; const d = geoM(v.lat, v.lon, m); if (d < bd) { best = m; bd = d; } }
    if (best) { v.pam = best; best.uVer = v; } }
  const placeCard = (p) => {
    const pm = p.pam, v = p.ver && verRadky(p.ver);
    showCard({ title: p.name, text: p.text, lon: p.lon, lat: p.lat, k: p.k, rows: [...(pm ? [['Kulturní památka', `ÚSKP ${pm.uskp}`]] : []), ...(v ? v.rows : [])],
               foto: pm && pm.foto ? { ...pm.foto, alt: pm.nazev } : null, kind: 3,
               extra: [...(p.odkaz ? [[p.odkaz, new URL(p.odkaz).hostname.replace(/^www\./, '')]] : []), ...(pm ? pamLinks(pm) : []),
                 ...(p.ver && p.ver.zdroj ? [[p.ver.zdroj, 'Zdroj otevírací doby']] : [])] });
    if (v) tedBarva(v.ted);
    if (p.program) showProgram(p);
  };
  // aktuální program (functions/api/program.js, jen na Cloudflaru): nejbližších 5 akcí; bez prostředníka se sekce neukáže
  const PROGRAM = {}, DNY = ['ne', 'po', 'út', 'st', 'čt', 'pá', 'so'];
  async function programAkce(z) {                           // {akce: nadcházející seřazené, zdroj} nebo null; hodinu v paměti
    const ted = Date.now();
    if (!PROGRAM[z] || ted - PROGRAM[z].t > 3600e3) PROGRAM[z] = { t: ted, q: fetch(`api/program?zdroj=${encodeURIComponent(z)}`).then((r) => (r.ok ? r.json() : null)).catch(() => null) };
    const d = await PROGRAM[z].q;
    if (!d || !d.akce) return null;
    // nadcházející akce; probíhající jen krátké (jarmark ano, přihlášky na tři měsíce ne)
    return { zdroj: d.zdroj, akce: d.akce.map((a) => ({ ...a, t0: new Date(a.od).getTime(), t1: a.do ? new Date(a.do).getTime() : NaN }))
      .filter((a) => a.t0 >= ted - 3 * 3600e3 || (a.t1 >= ted && a.t1 - a.t0 <= 31 * 86400e3)).sort((a, b) => a.t0 - b.t0) };
  }
  async function showProgram(p) {
    const karta = state.card, d = await programAkce(p.program);
    if (!d || !karta || state.card !== karta || $('card').hidden) return;   // mezitím jiná nebo zavřená karta
    const akce = d.akce.slice(0, 5);
    const box = $('cardProgram'), h = document.createElement('h3'); h.textContent = 'Program';
    const ul = document.createElement('ul');
    for (const a of akce) {
      const o = new Date(a.t0), li = document.createElement('li'), tm = document.createElement('time'), x = document.createElement('a');
      tm.dateTime = a.od;
      tm.textContent = `${DNY[o.getDay()]} ${o.getDate()}. ${o.getMonth() + 1}.${o.getHours() || o.getMinutes() ? ` ${o.getHours()}:${String(o.getMinutes()).padStart(2, '0')}` : ''}`;
      x.href = a.url; x.target = '_blank'; x.rel = 'noopener'; x.textContent = a.nazev;
      li.append(tm, x); ul.append(li);
    }
    if (!akce.length) { const li = document.createElement('li'); li.textContent = 'Teď nic naplánovaného.'; ul.append(li); }
    const vse = document.createElement('a'); vse.className = 'vse'; vse.href = d.zdroj; vse.target = '_blank'; vse.rel = 'noopener'; vse.textContent = 'Celý program ↗';
    box.replaceChildren(h, ul, vse); box.hidden = false;
  }
  const neighborCard = (n) => showCard({ title: n.name, text: n.text || 'Sousední izometrická mapa.', lon: n.lon, lat: n.lat, k: n.k, link: neighborHref(n), linkText: `Přejít na mapu ${n.name} ↗`, target: n.target, rows: [['Sousední mapa', n.name]], kind: 3 });
  function showBuilding(b) {
    state.sel = b;
    const pl = placeOf(b), pm = pamOf(b);
    const nm = pl ? pl.name : b.name || (pm && pm.nazev);
    const story = (pl && pl.text) || b.text || (nm && placeByName[nm] ? placeByName[nm].text : null);
    const title = nm || b.cls[0].toUpperCase() + b.cls.slice(1);
    const kt = b.kat || {}, cis = (n) => n.toLocaleString('cs-CZ');   // údaje z katastru (nastroje/ruian_karta.py)
    showCard({ title, text: story, lon: b.lon, lat: b.lat, k: b.k, rows: [
      ['Adresa', (b.addr || []).join(', ')], ['Typ', nm ? b.cls : null],
      ['Využití', kt.vyuziti && kt.vyuziti.toLowerCase() !== (b.cls || '').toLowerCase() ? kt.vyuziti : null],
      ['Dokončeno', kt.rok], ['Podlaží', kt.podl], ['Bytů', kt.byty],
      ['Výška', b.h ? `asi ${Math.round(b.h)} m` : null], ['Zastavěná plocha', kt.plocha ? `${cis(kt.plocha)} m²` : null],
      ['Konstrukce', kt.konstr], ['Vytápění', kt.vytap], ['Výtah', kt.vytah ? 'ano' : null],
      ['Kulturní památka', pm ? `ÚSKP ${pm.uskp}` : null],
    ], foto: pm && pm.foto ? { ...pm.foto, alt: pm.nazev } : null,
    extra: [...(pl && pl.odkaz ? [[pl.odkaz, new URL(pl.odkaz).hostname.replace(/^www\./, '')]] : []), ...(pm ? pamLinks(pm) : []), ...(kt.kod ? [[`https://vdp.cuzk.gov.cz/vdp/ruian/stavebniobjekty/${kt.kod}`, 'Údaje v katastru (RÚIAN)']] : [])], kind: 1 });
    if (pl && pl.program) showProgram(pl);
    setReport(b.oid ? 'b:' + b.oid : b.id, [title, (b.addr || [])[0]].filter(Boolean).join(', '), b.lon, b.lat);
  }
  function showPoint(ix, iy) {
    state.sel = null;
    const [x, y] = imgToWorld(ix, iy); const [lon, lat] = lonlat(x, y);
    // sousední mapa: klik do 40 m od špendlíku (1 px = 0,2 m)
    let nb = null, nd = 200;
    for (const n of OV.neighbors || []) {
      if (!shown(n.k) || (OBEC && n.obec && n.obec !== OBEC)) continue;
      const d = Math.hypot(ix - n.xy[0], iy - n.xy[1]);
      if (d < nd) { nb = n; nd = d; }
    }
    if (nb) {
      neighborCard(nb);
      return;
    }
    // místo bez budovy (náměstí, hřbitov, přehrada): klik do 40 m od jeho špendlíku (1 px = 0,2 m)
    let pl = null, bd = 200;
    for (const p of OV.places) { if (!shown(p.k)) continue; const d = Math.hypot(ix - p.xy[0], iy - p.xy[1]); if (d < bd) { pl = p; bd = d; } }
    if (pl) { placeCard(pl); return; }
    showCard({ title: 'Vybrané místo', rows: [], lon, lat, kind: 4 });
  }
  const closeCard = () => { $('card').hidden = true; state.sel = null; state.card = null; oznacPin(); };
  $('cardClose').addEventListener('click', closeCard);
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('card').hidden && !document.querySelector('dialog[open]') && !e.target.matches('input, textarea')) closeCard(); });
  // mobil: kartu jde stáhnout prstem dolů
  { let y0 = null;
    const card = $('card');
    card.addEventListener('pointerdown', (e) => { if (isMobile() && (e.target === $('grab') || card.scrollTop === 0)) { y0 = e.clientY; } });
    card.addEventListener('pointermove', (e) => { if (y0 !== null) { const d = Math.max(0, e.clientY - y0); card.style.transform = `translateY(${d}px)`; } });
    const end = (e) => { if (y0 === null) return; const d = e.clientY - y0; y0 = null; if (d > 70) closeCard(); else card.style.transform = ''; };
    card.addEventListener('pointerup', end); card.addEventListener('pointercancel', end);
  }

  const vpToImg = (pos) => { const p = viewer.viewport.viewerElementToViewportCoordinates(pos); return [p.x * W, p.y * W]; };
