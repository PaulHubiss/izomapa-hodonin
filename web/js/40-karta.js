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
  // karta po oddílech (Pavel 2026-11-20, varianta C z navrhy/karty.html): údaje bez nadpisu, pak Otevírací doba (sbalená
  // na řádek „Teď“), Z katastru, Program, Odkazy (mřížka s ikonkami) a dole tenký řádek Nahlásit · Napište nám (web/nase.js)
  const KIK = {                                            // ikonky Lucide (ISC)
    web: '<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>',
    mapa: '<path d="M14.106 5.553a2 2 0 0 0 1.788 0l3.659-1.83A1 1 0 0 1 21 4.619v12.764a1 1 0 0 1-.553.894l-4.553 2.277a2 2 0 0 1-1.788 0l-4.212-2.106a2 2 0 0 0-1.788 0l-3.659 1.83A1 1 0 0 1 3 19.381V6.618a1 1 0 0 1 .553-.894l4.553-2.277a2 2 0 0 1 1.788 0z"/><path d="M15 5.764v15"/><path d="M9 3.236v15"/>',
    letecky: '<rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>',
    hod: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    kniha: '<path d="M12 7v14"/><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/>',
    pamatka: '<line x1="3" x2="21" y1="22" y2="22"/><line x1="6" x2="6" y1="18" y2="11"/><line x1="10" x2="10" y1="18" y2="11"/><line x1="14" x2="14" y1="18" y2="11"/><line x1="18" x2="18" y1="18" y2="11"/><polygon points="12 2 20 7 4 7"/>',
    data: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5V19A9 3 0 0 0 21 19V5"/><path d="M3 12A9 3 0 0 0 21 12"/>',
    fb: '<path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/>',
    chev: '<path d="m6 9 6 6 6-6"/>',
  };
  const kik = (n) => `<svg viewBox="0 0 24 24" aria-hidden="true" class="nb-kik">${KIK[n]}</svg>`;
  window.IZO_KIK = kik;
  const OH_DEN = /^(Po|Út|St|Čt|Pá|So|Ne)(–(Po|Út|St|Čt|Pá|So|Ne))?$/, OH_PRED = new Set(['Teď', 'Otevřeno', 'Platí']);
  const KATASTR = new Set(['Využití', 'Dokončeno', 'Podlaží', 'Bytů', 'Výška', 'Zastavěná plocha', 'Konstrukce', 'Vytápění', 'Výtah']);
  const odkazTyp = (href, txt) => {                       // ikonka a krátký název odkazu
    if (/pamatkovykatalog|Památkový katalog/.test(href + txt)) return ['pamatka', 'Památkový katalog'];
    if (/wikipedia/.test(href)) return ['kniha', 'Wikipedie'];
    if (/openstreetmap/.test(href)) return ['data', 'OpenStreetMap'];
    if (/cuzk\.gov\.cz/.test(href)) return ['data', 'Katastr (RÚIAN)'];
    if (/facebook\.com/.test(href)) return ['fb', 'Facebook'];
    if (/Zdroj otevírací/.test(txt)) return ['hod', 'Zdroj otevírací doby'];
    return ['web', txt === 'Web podniku' ? 'Web' : txt];
  };
  const sekce = (id, nadpis) => {                         // oddíl karty s malým nadpisem (vytvoří se jednou, za #cardDl)
    let s = $(id);
    if (!s) { s = document.createElement('div'); s.id = id; s.className = 'nb-oddil';
      if (id === 'cardVBudove') $('cardLinks').before(s); else (id === 'cardKat' ? $('cardOh') : $('cardDl')).after(s); }   // místa v budově: nad Odkazy
    s.replaceChildren(); const h = document.createElement('p'); h.className = 'nb-oddil-nadpis'; h.textContent = nadpis; s.append(h);
    return s;
  };
  const dlZ = (radky) => { const dl = document.createElement('dl'); for (const [a, b] of radky) { const dt = document.createElement('dt'); dt.textContent = a; const dd = document.createElement('dd'); dd.textContent = b; dl.append(dt, dd); } return dl; };
  function showCard({ title, text, rows, lon, lat, k, link, linkText, target, extra, foto, kind = 0, ohPozn }) {
    oznacPin(lat, lon);
    state.card = kind ? { lat, lon, kind } : null;
    $('cardShare').hidden = !kind;                          // zastávka: odkaz na kartu by nic neotevřel
    $('cardProgram').hidden = true; $('cardProgram').replaceChildren();
    $('cardVyl').hidden = true; $('cardVyl').replaceChildren();
    if ($('cardVBudove')) $('cardVBudove').hidden = true;  // seznam míst v budově vyplní až showBuilding / showVerejne / showPodnik
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
    // řádky do oddílů: otevírací doba (Teď, dny, Platí, Poznámka), údaje z katastru, zbytek nahoře bez nadpisu
    const plne = rows.filter(([, v]) => v !== undefined && v !== null && v !== '');
    const maOh = plne.some(([k]) => k === 'Teď' || k === 'Otevřeno');
    const jeOh = (k) => maOh && (OH_PRED.has(k) || OH_DEN.test(k) || k === 'Poznámka');
    const dl = $('cardDl'); dl.replaceChildren(); dl.classList.remove('odjezdy');
    for (const [k, v] of plne.filter(([k]) => !jeOh(k) && !KATASTR.has(k))) { const x = dlZ([[k, v]]); dl.append(...x.childNodes); }
    dl.hidden = !dl.children.length;
    const oh = sekce('cardOh', 'Otevírací doba'), ohR = plne.filter(([k]) => jeOh(k));
    oh.hidden = !ohR.length;
    if (ohR.length) {
      const ted = ohR.find(([k]) => k === 'Teď'), dny = ohR.filter(([k]) => OH_DEN.test(k));
      if (ted) {                                             // sbalené na „Teď“, týden po kliknutí
        const d = document.createElement('details'), s = document.createElement('summary'), t = document.createElement('span');
        t.id = 'cardOhTed'; t.className = 'oh-ted'; t.textContent = ted[1]; s.append(t); s.insertAdjacentHTML('beforeend', kik('chev'));
        d.append(s, Object.assign(dlZ(dny), { className: 'nb-tyden' })); oh.append(d);
      } else { const p = document.createElement('p'); p.textContent = (ohR.find(([k]) => k === 'Otevřeno') || [, ''])[1]; oh.append(p); }
      const drob = [ohR.find(([k]) => k === 'Platí'), ohR.find(([k]) => k === 'Poznámka')].filter(Boolean).map(([k, v]) => (k === 'Platí' ? `platí ${v}` : v));
      if (ohPozn) drob.push(ohPozn);
      if (drob.length) { const p = document.createElement('p'); p.className = 'nb-drob'; p.textContent = drob.join(' · '); oh.append(p); }
    }
    const katR = plne.filter(([k]) => KATASTR.has(k)), kat = sekce('cardKat', 'Z katastru');
    kat.hidden = !katR.length; if (katR.length) kat.append(dlZ(katR));
    const links = $('cardLinks'); links.replaceChildren(); links.classList.add('nb-oddil');
    const lh = document.createElement('p'); lh.className = 'nb-oddil-nadpis'; lh.textContent = 'Odkazy'; links.append(lh);
    if (link) {
      const btn = document.createElement('a'); btn.href = link; btn.className = 'card-neighbor-btn';
      if (target) btn.target = target;
      if (btn.target === '_blank') btn.rel = 'noopener';
      btn.textContent = linkText || `Přejít na mapu ${title} ↗`;
      links.append(btn);
    }
    const mriz = document.createElement('div'); mriz.className = 'nb-odkazy';
    const odkaz = (href, ik, txt, titul) => { const e = document.createElement('a'); e.target = '_blank'; e.rel = 'noopener'; e.href = href; e.innerHTML = kik(ik); e.append(txt); if (titul) e.title = titul; mriz.append(e); };
    for (const [href, txt] of extra || []) { const [ik, kr] = odkazTyp(href, txt); odkaz(href, ik, kr, txt !== kr ? txt : ''); }   // web místa první
    odkaz(`https://mapy.cz/zakladni?x=${lon.toFixed(6)}&y=${lat.toFixed(6)}&z=19&source=coor&id=${lon.toFixed(6)}%2C${lat.toFixed(6)}`, 'mapa', 'Mapy.cz', 'Ukázat ve skutečnosti (Mapy.cz)');
    odkaz(`https://mapy.cz/letecka?x=${lon.toFixed(6)}&y=${lat.toFixed(6)}&z=19`, 'letecky', 'Letecký snímek');
    links.append(mriz);
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
  function showPodnik(p, b) {
    b = b || budovaMista(p);
    state.sel = b || null;
    const kuch = (p.kuchyne || '').split(';').map((c) => POD_KUCH[c.trim()] || c.trim().replace(/_/g, ' ')).filter(Boolean).join(', ');
    const t = ohParse(p.oteviraci), ted = t && ohTed(t);
    const rows = [['Druh', [POD_DRUH[p.druh] || 'Podnik', kuch].filter(Boolean).join(' · ')], ['Adresa', p.adresa]];
    if (ted) rows.push(['Teď', ted[1]], ...ohRadky(t));
    else if (p.oteviraci) rows.push(['Otevřeno', ohPreklad(p.oteviraci)]);
    rows.push(['Telefon', p.telefon], ...(b ? budovaRadky(b) : []));
    const kt = (b && b.kat) || {};
    const extra = [p.web && [p.web, 'Web podniku'], p.facebook && [p.facebook, 'Facebook'],
      p.osm ? [p.osm, 'Údaje v OpenStreetMap'] : null,
      kt.kod && [`https://vdp.cuzk.gov.cz/vdp/ruian/stavebniobjekty/${kt.kod}`, 'Údaje v katastru (RÚIAN)']].filter(Boolean);
    showCard({ title: p.nazev, rows, lon: p.lon, lat: p.lat, k: p.k, extra, kind: 5 });
    tedBarva(ted);
    if (b) vBudove(mistaVBudove(b).filter((m) => m.p !== p), b, 'V budově také');
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
  function tedBarva(ted) { const e = $('cardOhTed'); if (ted && e) e.className = `oh-ted ${ted[0] ? 'otevreno' : 'zavreno'}`; }
  // místo s termínem (jarmark): po posledním dni (termin_do) karta nemá starý termín ani prázdný program, text je text_po
  // (Pavel 2026-11-25). Dokud je na stránce ještě nějaká akce (Vánoční burácení 24. 12.), program zůstává.
  const poTerminu = (p) => !!p.termin_do && Date.now() >= new Date(`${p.termin_do}T23:59:59`).getTime();
  function showVerejne(p, b) {
    if (p.uMista) { placeCard(p.uMista); return; }
    b = p.vanoce ? null : b || budovaMista(p);               // jarmark stojí na náměstí, ne v budově
    state.sel = b || null;                                   // budova v obrysu se zvýrazní stejně jako po kliku na ni
    const { rows: oh, ted } = verRadky(p), pm = p.pam, kt = (b && b.kat) || {};
    const rows = [['Druh', p.druh], ...(pm ? [['Kulturní památka', `ÚSKP ${pm.uskp}`]] : []), ['Adresa', p.adresa], ['Termín', poTerminu(p) ? null : p.termin], ...oh, ['Telefon', p.telefon],
      ...(b ? budovaRadky(b) : [])];
    const overeno = p.overeno ? new Date(p.overeno).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric' }) : null;
    const extra = [p.web && [p.web, 'Web'], p.zdroj && p.zdroj !== p.web && [p.zdroj, 'Zdroj otevírací doby'], ...(pm ? pamLinks(pm) : []),
      p.osm && [p.osm, 'Údaje v OpenStreetMap'],
      kt.kod && [`https://vdp.cuzk.gov.cz/vdp/ruian/stavebniobjekty/${kt.kod}`, 'Údaje v katastru (RÚIAN)']].filter(Boolean);
    showCard({ title: p.nazev, ohPozn: overeno ? `podle webu ${new URL(p.zdroj || p.web).hostname.replace(/^www\./, '')}, ověřeno ${overeno}` : '',
      text: (poTerminu(p) && p.text_po) || p.text, rows, lon: p.lon, lat: p.lat, k: p.k, extra, kind: 6, foto: pm && pm.foto ? { ...pm.foto, alt: pm.nazev } : null });
    tedBarva(ted);
    if (b) vBudove(mistaVBudove(b).filter((m) => m.p !== p), b, 'V budově také');
    if (p.program) showProgram(p);                           // kino (Pavel 2026-11-20), stejně jako příběh DK
  }
  // místo a památka na stejném bodě (do 30 m, nejbližší další dvojice je 83 m daleko): na mapě jen popisek místa,
  // jeho karta dostane fotku a údaje památky; památka zůstává v hledání a odkazech
  for (const p of OV.places) { let best = null, bd = 30; for (const m of PAMATKY) { const d = geoM(p.lat, p.lon, m); if (d < bd) { best = m; bd = d; } } if (best) { p.pam = best; best.uMista = p; } }
  // veřejné místo, které je zároveň příběhem (stejný název do 150 m, např. Zoo Hodonín): jedna ikonka, karta příběhu s otevírací dobou
  const nazevKlic = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
  for (const v of VEREJNA) { const p = OV.places.find((q) => nazevKlic(q.name) === nazevKlic(v.nazev) && geoM(q.lat, q.lon, v) < 150); if (p) { v.uMista = p; p.ver = v; } }
  // památka do 30 m od veřejného místa (kostel, muzeum): jedna ikonka v jeho kategorii, karta s fotkou a číslem památky
  // (jen budovy: WC, parkoviště nebo park vedle sochy památkou nejsou; hřbitov, socha, sloup… jen s místem téhož druhu –
  // kostel sv. Metoděje 19 m od bodu Městského hřbitova měl jeho fotku a číslo, 2026-11-24)
  const DRUH_PAM = /hřbitov|soch|sousoší|sloup|pomník|památník|náhrob|kašn/i;
  const druhPam = (s) => (DRUH_PAM.exec(s) || [''])[0].toLowerCase();
  for (const v of VEREJNA) { if (v.uMista || ['sluzby', 'doprava', 'priroda'].includes(v.skupina)) continue; let best = null, bd = 30;
    for (const m of PAMATKY) { if (m.uMista || m.uVer || druhPam(m.nazev) !== druhPam(`${v.nazev} ${v.druh || ''}`)) continue; const d = geoM(v.lat, v.lon, m); if (d < bd) { best = m; bd = d; } }
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
    if (!d.akce.length && poTerminu(p)) return;             // po skončení bez prázdného programu
    // dlouhý program (jarmark: ~50 vystoupení na jedné stránce): pod nejbližšími pěti sbalený zbytek, bez odkazu u každého řádku
    const dlouhy = d.akce.some((a) => a.druh === 'jarmark'), zbytek = dlouhy ? d.akce.slice(5) : [];
    const akce = d.akce.slice(0, 5);
    const box = $('cardProgram'), h = document.createElement('p'); h.className = 'nb-oddil-nadpis'; h.textContent = 'Program'; box.classList.add('nb-oddil');
    const ul = document.createElement('ul');
    const radek = (a) => {
      const o = new Date(a.t0), li = document.createElement('li'), tm = document.createElement('time'), x = document.createElement(dlouhy ? 'span' : 'a');
      tm.dateTime = a.od;
      tm.textContent = `${DNY[o.getDay()]} ${o.getDate()}. ${o.getMonth() + 1}.${o.getHours() || o.getMinutes() ? ` ${o.getHours()}:${String(o.getMinutes()).padStart(2, '0')}` : ''}`;
      if (!dlouhy) { x.href = a.url; x.target = '_blank'; x.rel = 'noopener'; }
      x.textContent = a.nazev;
      li.append(tm, x); return li;
    };
    ul.append(...akce.map(radek));
    if (!akce.length) { const li = document.createElement('li'); li.textContent = 'Teď nic naplánovaného.'; ul.append(li); }
    const vse = document.createElement('a'); vse.className = 'vse'; vse.href = d.zdroj; vse.target = '_blank'; vse.rel = 'noopener'; vse.textContent = 'Celý program ↗';
    box.replaceChildren(h, ul);
    if (zbytek.length) {
      const det = document.createElement('details'), s = document.createElement('summary'), u2 = document.createElement('ul'), n = zbytek.length;
      s.textContent = n < 5 ? `Další ${n}` : `Dalších ${n}`; s.insertAdjacentHTML('beforeend', kik('chev'));
      u2.append(...zbytek.map(radek)); det.append(s, u2); box.append(det);
    }
    if (dlouhy) vse.textContent = 'Program na webu DK Hodonín ↗';
    box.append(vse); box.hidden = false;
  }
  const neighborCard = (n) => showCard({ title: n.name, text: n.text || 'Sousední izometrická mapa.', lon: n.lon, lat: n.lat, k: n.k, link: neighborHref(n), linkText: `Přejít na mapu ${n.name} ↗`, target: n.target, rows: [['Sousední mapa', n.name]], kind: 3 });
  // víc vchodů jedné ulice do jednoho údaje: „Družstevní čtvrť 3133–3142“, jinak „Ulice 1, 3, 5“ (Pavel 2026-11-20: karty uklidit)
  function adresy(seznam) {
    const ulice = new Map();
    for (const a of seznam) { const m = /^(.*?)\s+(\d+)(\S*)$/.exec(a); if (!m || m[3]) { ulice.set(a, null); continue; }
      if (!ulice.has(m[1]) || !ulice.get(m[1])) ulice.set(m[1], []); ulice.get(m[1]).push(+m[2]); }
    return [...ulice].map(([u, c]) => {
      if (!c) return u;
      c = [...new Set(c)].sort((x, y) => x - y);
      const useky = []; for (const n of c) { const s = useky[useky.length - 1]; if (s && n === s[1] + 1) s[1] = n; else useky.push([n, n]); }
      return `${u} ${useky.map(([a, z]) => (a === z ? a : z === a + 1 ? `${a}, ${z}` : `${a}–${z}`)).join(', ')}`;
    }).join(', ');
  }
  // údaje budovy z katastru (nastroje/ruian_karta.py) a výška: karta budovy i karta veřejného místa v budově
  function budovaRadky(b) {
    const kt = b.kat || {}, cis = (n) => n.toLocaleString('cs-CZ');
    return [['Dokončeno', kt.rok], ['Podlaží', kt.podl], ['Výška', b.h ? `asi ${Math.round(b.h)} m` : null],
      ['Zastavěná plocha', kt.plocha ? `${cis(kt.plocha)} m²` : null]];
  }
  // místa v budově (Pavel 2026-11-20): veřejná místa a podniky s bodem v obrysu a do 35 m od středu budovy.
  // Jedno místo: klik na budovu = karta místa s údaji budovy. Víc míst (19 budov, nastroje-pavel/mista_v_budovach.py):
  // karta budovy se seznamem „V budově“, karta místa se seznamem „V budově také“.
  function mistaVBudove(b) {
    const v = (p) => geoM(b.lat, b.lon, p) < 35 && inPoly(p.xy[0], p.xy[1], b.hull);
    return [...VEREJNA.filter((p) => !p.uMista && !p.vanoce && v(p)).map((p) => ({ p, ver: true })), ...PODNIKY.filter(v).map((p) => ({ p, ver: false }))]
      .sort((x, y) => x.p.nazev.localeCompare(y.p.nazev, 'cs'));
  }
  const otevriMisto = (m, b) => (m.ver ? showVerejne(m.p, b) : showPodnik(m.p, b));
  function budovaMista(v) {                                // budova pod ikonkou: z budov, jejichž obrys bod obsahuje, ta s nejbližším středem
    let best = null, bd = 35;
    for (const b of grid.get(Math.floor(v.xy[0] / CELL) + ',' + Math.floor(v.xy[1] / CELL)) || []) {
      if (!inPoly(v.xy[0], v.xy[1], b.hull)) continue;
      const d = geoM(v.lat, v.lon, b); if (d < bd) { best = b; bd = d; }
    }
    return best;
  }
  function vBudove(ms, b, nadpis) {                         // seznam míst v kartě: ikonka kategorie, název, druh, teď otevřeno/zavřeno
    if (!ms.length) return;
    const s = sekce('cardVBudove', nadpis); s.hidden = false;
    const ul = document.createElement('ul'); ul.className = 'dnes-list v-budove';
    for (const m of ms) {
      const p = m.p, oh = m.ver ? verRadky(p).ted : (() => { const t = ohParse(p.oteviraci); return t && ohTed(t); })();
      const li = document.createElement('li'), btn = document.createElement('button'); btn.type = 'button';
      const ik = document.createElement('span'); ik.className = 'dnes-ico kat'; ik.innerHTML = p.el ? p.el.innerHTML : '';
      if (p.el) ik.style.setProperty('--kat', p.el.style.getPropertyValue('--kat'));
      const t = document.createElement('span'); t.textContent = p.nazev;
      const d = document.createElement('span'); d.className = 'misto'; d.textContent = m.ver ? p.druh : (POD_DRUH[p.druh] || 'Podnik'); t.append(d);
      const st = document.createElement('span'); if (oh) { st.className = `oh-ted ${oh[0] ? 'otevreno' : 'zavreno'}`; st.textContent = oh[0] ? 'otevřeno' : 'zavřeno'; }
      btn.append(ik, t, st); btn.addEventListener('click', () => otevriMisto(m, b));
      li.append(btn); ul.append(li);
    }
    s.append(ul);
  }
  function showBuilding(b) {
    state.sel = b;
    const pl = placeOf(b), pm = pamOf(b);
    const ms = pl ? [] : mistaVBudove(b);
    if (ms.length === 1) { otevriMisto(ms[0], b); return; }
    const nm = pl ? pl.name : b.name || (pm && pm.nazev);
    const story = (pl && pl.text) || b.text || (nm && placeByName[nm] ? placeByName[nm].text : null);
    const title = nm || b.cls[0].toUpperCase() + b.cls.slice(1);
    const kt = b.kat || {}, cis = (n) => n.toLocaleString('cs-CZ');   // údaje z katastru (nastroje/ruian_karta.py)
    showCard({ title, text: story, lon: b.lon, lat: b.lat, k: b.k, rows: [
      ['Adresa', adresy(b.addr || [])], ['Typ', nm ? b.cls : null],
      ['Využití', kt.vyuziti && kt.vyuziti.toLowerCase() !== (b.cls || '').toLowerCase() ? kt.vyuziti : null],
      ['Dokončeno', kt.rok], ['Podlaží', kt.podl], ['Bytů', kt.byty],
      ['Výška', b.h ? `asi ${Math.round(b.h)} m` : null], ['Zastavěná plocha', kt.plocha ? `${cis(kt.plocha)} m²` : null],
      ['Konstrukce', kt.konstr], ['Vytápění', kt.vytap], ['Výtah', kt.vytah ? 'ano' : null],
      ['Kulturní památka', pm ? `ÚSKP ${pm.uskp}` : null],
    ], foto: pm && pm.foto ? { ...pm.foto, alt: pm.nazev } : null,
    extra: [...(pl && pl.odkaz ? [[pl.odkaz, new URL(pl.odkaz).hostname.replace(/^www\./, '')]] : []), ...(pm ? pamLinks(pm) : []), ...(kt.kod ? [[`https://vdp.cuzk.gov.cz/vdp/ruian/stavebniobjekty/${kt.kod}`, 'Údaje v katastru (RÚIAN)']] : [])], kind: 1 });
    if (pl && pl.program) showProgram(pl);
    vBudove(ms, b, 'V budově');
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
