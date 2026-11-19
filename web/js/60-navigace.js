  // ---------- zvýraznění ulice z hledání (Pavel 2026-11-17: „když dám do hledání název ulice bez čísla, … teď nejde vidět,
  // kde vlastně je“) ----------
  // Tvar ulic: site/ulice.json z nastroje-pavel/ulice.py (svět, m), načte se při prvním vybrání ulice. Výřez se přizpůsobí
  // celé ulici (nejméně ULICE_MIN_M široký), ulice se obtáhne žlutě s tmavým lemem a první 3 s pulzuje. Zmizí po kliknutí
  // do mapy nebo dalším hledání. Bez souboru (jiná mapa) jako dřív: skok na střed ulice.
  const ULICE = { data: null, nacitani: null, vyber: null }, ULICE_MIN_M = 350;
  function ukazUlici(s) {
    const nacti = ULICE.nacitani || (ULICE.nacitani = fetch(`ulice.json${VER ? VER + '&' : '?'}s=${SEST}`, NC).then((r) => (r.ok ? r.json() : {})).catch(() => ({})).then((d) => (ULICE.data = d)));
    nacti.then((d) => {
      const cary = d[s.name];
      if (!cary || !cary.length) { goTo(s.xy[0], s.xy[1], 0.9); return; }
      const img = cary.map((flat) => { const out = []; for (let i = 0; i < flat.length; i += 2) out.push(toImg(flat[i], flat[i + 1], gz(flat[i], flat[i + 1]))); return out; });
      const xs = img.flat().map((p) => p[0]), ys = img.flat().map((p) => p[1]);
      let x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
      const sz = viewer.viewport.getContainerSize(), r = sz.x / Math.max(1, sz.y), minW = ULICE_MIN_M / cam.mpp;
      let w = Math.max((x1 - x0) * 1.3, (y1 - y0) * 1.3 * r, minW), h = w / r;
      const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
      ULICE.vyber = { nazev: s.name, img, t0: performance.now() };
      viewer.viewport.fitBounds(new OpenSeadragon.Rect((cx - w / 2) / W, (cy - h / 2) / W, w / W, h / W));
      if (isMobile()) setMenu(false);
    });
  }
  function kresliUlici(sx, ox, oy, now) {
    const U = ULICE.vyber; if (!U) return;
    const t = (now - U.t0) / 1000, puls = t < 3 ? 0.55 + 0.45 * Math.abs(Math.cos(t * Math.PI * 1.2)) : 1;
    ctx.save(); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    for (const [barva, sirka] of [['rgba(20,24,34,0.8)', 10], [`rgba(255,210,63,${puls})`, 5]]) {
      ctx.strokeStyle = barva; ctx.lineWidth = sirka; ctx.beginPath();
      for (const cara of U.img) cara.forEach((p, i) => (i ? ctx.lineTo : ctx.moveTo).call(ctx, ox + p[0] * sx, oy + p[1] * sx));
      ctx.stroke();
    }
    ctx.restore();
  }
  // ---------- navigace, hledání ----------
  function goTo(ix, iy, zoomImg = 1.6) {
    viewer.viewport.panTo(new OpenSeadragon.Point(ix / W, iy / W));
    viewer.viewport.zoomTo(zoomImg * W / viewer.viewport.getContainerSize().x);
    if (isMobile()) setMenu(false);
  }
  const placesUl = $('places');
  const placesAbc = [...myPlaces].sort((a, b) => a.name.localeCompare(b.name, 'cs'));
  var renderPlaces = () => {
    placesUl.replaceChildren();
    for (const p of placesAbc) {
      if (!shown(p.k)) continue;
      const li = document.createElement('li'); const b = document.createElement('button'); b.type = 'button'; b.textContent = p.name;
      b.addEventListener('click', () => { goTo(p.xy[0], p.xy[1], 1.4); placeCard(p); });
      li.appendChild(b); placesUl.appendChild(li);
    }
  };
  renderPlaces();
  // sekce Místa: pod Příběhy sbalitelné skupiny všech dalších kategorií ve stejném pořadí jako Vrstvy (web/kategorie.js,
  // Pavel 2026-11-16). Jen název (druh bývá v názvu), u stejných názvů šedě ulice, vpravo „otevřeno / zavřeno“, kde ho známe;
  // stav se přepočítá při každém rozbalení skupiny. Počet u skupiny = počet u přepínače vrstvy.
  {
    const box = $('verSkupiny');
    const ulice = (a) => (a ? a.replace(/\s+[\d/ ]+[a-zA-Z]?$/, '').trim() : null);
    const POLOZKY = {
      pamatky: () => PAMATKY.map((p) => ({ p, nazev: p.nazev, otevri: () => showPamatka(p) })),
      jidlo: () => PODNIKY.map((p) => ({ p, nazev: p.nazev, ulice: ulice(p.adresa), oh: p.oteviraci, otevri: () => showPodnik(p) })),
    };
    const pocet = { pribehy: myPlaces.length };
    for (const c of Object.values(KAT)) {
      if (c.k === 'pribehy') continue;
      const mm = (POLOZKY[c.k] ? POLOZKY[c.k]() : VEREJNA.filter((p) => p.skupina === c.k).map((p) => {
        const o = verOteviraci(p);
        return { p, nazev: p.nazev, ulice: p.ulice || ulice(p.adresa), oh: o && o.oh, otevri: () => showVerejne(p) };
      })).sort((a, b) => a.nazev.localeCompare(b.nazev, 'cs'));
      pocet[c.k] = mm.length;
      if (!mm.length) continue;
      const kolik = {}; for (const m of mm) kolik[m.nazev] = (kolik[m.nazev] || 0) + 1;
      const det = document.createElement('details'); det.className = `ver-sk kat-sk-${c.k}`; det.dataset.sk = c.k;
      det.style.setProperty('--kat', c.barva);
      const sum = document.createElement('summary');
      sum.innerHTML = `<span class="kat-ik">${katSvg(c.ik)}</span>${c.nazev}<span class="lay-n"> (${mm.length})</span>`;
      const ul = document.createElement('ul'); ul.className = 'places';
      const vykresli = () => {
        ul.replaceChildren(...mm.filter((m) => shown(m.p.k)).map((m) => {
          const li = document.createElement('li'), b = document.createElement('button'); b.type = 'button';
          const n = document.createElement('span'); n.className = 'ver-nazev'; n.textContent = m.nazev;
          if (kolik[m.nazev] > 1 && m.ulice) { const u = document.createElement('span'); u.className = 'ver-kde'; u.textContent = ` · ${m.ulice}`; n.append(u); }
          b.append(n);
          const t = m.oh && ohParse(m.oh), ted = t && ohTed(t);
          if (ted) { const st = document.createElement('span'); st.className = `ver-stav ${ted[0] ? 'otevreno' : 'zavreno'}`; st.textContent = ted[0] ? 'otevřeno' : 'zavřeno'; b.append(st); }
          b.addEventListener('click', () => { goTo(m.p.xy[0], m.p.xy[1], 1.4); m.otevri(); });
          li.append(b); return li;
        }));
      };
      det.addEventListener('toggle', () => { if (det.open) vykresli(); });
      det.append(sum, ul); box.append(det); vykresli();
    }
    box.hidden = !box.children.length;
    // přepínače kategorií ve Vrstvách (vytvoří je web/nase.js): počet jako v Místech, bez míst schované
    for (const c of Object.values(KAT)) {
      const vstup = $(c.vrstva); if (!vstup) continue;
      layN(`n-${c.k}`, pocet[c.k]); vstup.closest('label').hidden = !pocet[c.k];
      vstup.addEventListener('change', (e) => $('map').classList.toggle(`nokat-${c.k}`, !e.target.checked));
    }
  }
  const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const index = [];
  for (const n of OV.neighbors || []) {
    if (OBEC && n.obec && n.obec !== OBEC) continue;
    index.push({ label: n.name, kind: 'soused', k: n.k, n: norm(n.name), go: () => { goTo(n.xy[0], n.xy[1], 1.4); neighborCard(n); } });
  }
  for (const p of PAMATKY) index.push({ label: p.nazev, kind: 'památka', k: p.k, n: norm(p.nazev), go: () => { goTo(p.xy[0], p.xy[1], 1.4); showPamatka(p); } });
  for (const p of PODNIKY) index.push({ label: p.nazev, kind: (POD_DRUH[p.druh] || 'podnik').toLowerCase(), k: p.k, n: norm(p.nazev), go: () => { goTo(p.xy[0], p.xy[1], 1.4); showPodnik(p); } });
  for (const p of VEREJNA) index.push({ label: p.nazev, kind: p.druh.toLowerCase(), k: p.k, n: norm(`${p.nazev} ${p.druh}`), go: () => { goTo(p.xy[0], p.xy[1], 1.4); showVerejne(p); } });
  for (const p of OV.places) index.push({ label: p.name, kind: 'místo', k: p.k, n: norm(p.name), go: () => { goTo(p.xy[0], p.xy[1], 1.4); placeCard(p); } });
  for (const s of OV.streets) index.push({ label: s.name, kind: 'ulice', k: s.k, n: norm(s.name), go: () => ukazUlici(s) });
  // adresy celé mapy jsou ve zvláštním souboru, načtou se při prvním psaní do hledání
  let addrLoad = null;
  const loadAddr = () => addrLoad || (addrLoad = fetch('search.json' + DV, NC).then((r) => r.json()).then((A) => {
    for (const [a, k, cx, cy, i, kind] of A) index.push({ label: a, kind: kind || 'adresa', k, n: norm(a), go: () => { goTo(cx, cy, 2); loadChunk(k).then((c) => c && showBuilding(c.buildings[i])); } });
  }).catch(() => {}));
  $('q').addEventListener('focus', loadAddr);
  let res = [], cur = -1;
  function renderResults() {
    const ul = $('results'); ul.replaceChildren();
    res.forEach((r, i) => {
      const li = document.createElement('li'); const b = document.createElement('button'); b.type = 'button';
      if (i === cur) b.className = 'on';
      const s1 = document.createElement('span'); s1.textContent = r.label; const s2 = document.createElement('small'); s2.textContent = r.kind;
      b.append(s1, s2); b.addEventListener('click', () => pick(r)); li.appendChild(b); ul.appendChild(li);
    });
  }
  function pick(r) { ULICE.vyber = null; r.go(); $('q').value = r.label; res = []; cur = -1; renderResults(); }
  $('q').addEventListener('input', (e) => {
    const q = norm(e.target.value.trim());
    cur = -1;
    if (q.length < 2) { res = []; renderResults(); return; }
    if (!addrLoad) { loadAddr().then(() => e.target.dispatchEvent(new Event('input'))); }
    const pool = index.filter((r) => shown(r.k)), seenL = new Set();
    const starts = pool.filter((r) => r.n.startsWith(q)), inside = pool.filter((r) => !r.n.startsWith(q) && r.n.includes(q));
    const order = { 'místo': 0, 'zastávka': 0.5, budova: 1, ulice: 2, adresa: 3 };
    res = [...starts, ...inside].filter((r) => !seenL.has(r.kind + r.label) && seenL.add(r.kind + r.label)).sort((a, b) => (a.n.startsWith(q) === b.n.startsWith(q) ? order[a.kind] - order[b.kind] : 0)).slice(0, 8);
    renderResults();
  });
  $('q').addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { cur = Math.min(res.length - 1, cur + 1); renderResults(); e.preventDefault(); }
    if (e.key === 'ArrowUp') { cur = Math.max(0, cur - 1); renderResults(); e.preventDefault(); }
    if (e.key === 'Enter' && res.length) pick(res[Math.max(cur, 0)]);
    if (e.key === 'Escape') { res = []; renderResults(); }
  });

  const zbtn = (id, f) => $(id).addEventListener('click', f);
  // tlačítka +/− se zastaví na stejných mezích jako kolečko (Pavel 2026-11-17: tlačítkem šlo oddálit 4× dál, „matoucí“);
  // krok od cíle rozjetého zoomu, ať rychlé klikání sčítá
  const zoomTlacitko = (f) => {
    const vp = viewer.viewport, z0 = vp.getZoom(false), z = Math.max(vp.getMinZoom(), Math.min(vp.getMaxZoom(), z0 * f));
    if (Math.abs(z / z0 - 1) > 1e-6) vp.zoomTo(z);
  };
  zbtn('zin', () => zoomTlacitko(1.6));
  zbtn('zout', () => zoomTlacitko(1 / 1.6));
  if (HOME_VIEW && !HOME_ALL) $('home').title = 'Výchozí pohled';
  zbtn('home', () => goHome());
  // Tlačítko Zpět (a gesto zpět na Androidu) zavře otevřené okno místo odchodu z webu: otevření okna přidá záznam do historie
  for (const d of document.querySelectorAll('dialog')) {
    const sm = d.showModal.bind(d);
    d.showModal = () => { if (d.open) return; sm(); uiDepth++; try { history.pushState({ ui: uiDepth }, ''); } catch {} };
    d.addEventListener('close', () => { if (uiPop || !uiDepth) return; uiDepth--; uiBackAt = Date.now(); uiSelf++; history.back(); });
  }
  addEventListener('popstate', () => {
    if (uiSelf) { uiSelf--; return; }                     // krok zpět po zavření okna tlačítkem: nezavírat další (vnořené) okno
    if (!uiDepth) return;
    uiDepth--; uiBackAt = Date.now(); uiPop = true;
    const ds = [...document.querySelectorAll('dialog[open]')]; if (ds.length) ds[ds.length - 1].close();
    uiPop = false;
  });
  $('help').addEventListener('click', (e) => { e.stopPropagation(); $('helpDlg').showModal(); });
  $('helpClose').addEventListener('click', () => $('helpDlg').close());
  $('helpDlg').addEventListener('click', (e) => { if (e.target === $('helpDlg')) $('helpDlg').close(); });
  // přidání na plochu: návod podle zařízení; Chrome na Androidu a počítači nabídne rovnou svoje okno instalace
  {
    const ua = navigator.userAgent, os = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) ? 'ios' : /Android/.test(ua) ? 'android' : 'pc';
    let prompt = null;
    if (matchMedia('(display-mode: standalone)').matches || navigator.standalone) $('plochaBtn').hidden = true;   // už běží jako aplikace
    addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); prompt = e; });
    addEventListener('appinstalled', () => { prompt = null; $('plochaBtn').hidden = true; $('plochaDlg').close(); });
    $('plochaBtn').addEventListener('click', () => {
      $('plInstall').hidden = !prompt;
      document.querySelectorAll('#plochaDlg [data-os]').forEach((el) => { el.hidden = el.dataset.os !== os; });
      $('plochaDlg').showModal();                       // nad nápovědou; po zavření se vrátí do ní
    });
    $('plochaGo').addEventListener('click', async () => { if (!prompt) return; prompt.prompt(); await prompt.userChoice.catch(() => {}); prompt = null; $('plInstall').hidden = true; });
    $('plochaClose').addEventListener('click', () => $('plochaDlg').close());
    $('plochaDlg').addEventListener('click', (e) => { if (e.target === $('plochaDlg')) $('plochaDlg').close(); });
  }
  // sdílení: odkaz obsahuje polohu, přiblížení, roční období, denní dobu a vypnuté vrstvy (#zima-noc-bezdopravy@50.77,15.06,0.8);
  // s otevřenou kartou míří na její místo a kartu otevře (…@lat,lon,km,druh, viz showCard)
  function shareUrl() {
    const tok = [{ spring: 'jaro', summer: 'leto', autumn: 'podzim', winter: 'zima' }[state.season]];
    if (state.night > 0.7) tok.push('noc'); else if (state.night > 0.25) tok.push('soumrak');
    for (const [t, id] of Object.entries(LAYER_TOKEN)) if ($(id) && !$(id).checked && !$(id).closest('label').hidden) tok.push(t);   // skrytý přepínač (vrstva bez dat) do odkazu nepatří
    let at = location.hash.split('@')[1] || '';
    if (state.card && !$('card').hidden) at = `${state.card.lat.toFixed(5)},${state.card.lon.toFixed(5)},${at.split(',')[2] || '0.40'},${state.card.kind}`;
    return `${location.origin}${location.pathname}#${tok.join('-')}@${at}`;
  }
  const shareToast = (t) => { $('toast').textContent = t; $('toast').hidden = false; clearTimeout(shareToast.t); shareToast.t = setTimeout(() => { $('toast').hidden = true; }, 2200); };
  async function copyLink(url) {
    try { await navigator.clipboard.writeText(url); shareToast('Odkaz na tento pohled je zkopírovaný'); }
    catch {
      try {                                                      // vestavěné prohlížeče bez schránky: starý způsob kopírování
        const ta = document.createElement('textarea'); ta.value = url; ta.style.cssText = 'position:fixed;opacity:0'; document.body.append(ta); ta.select();
        const ok = document.execCommand('copy'); ta.remove();
        shareToast(ok ? 'Odkaz na tento pohled je zkopírovaný' : url);
      } catch { shareToast(url); }
    }
  }
  // nabídka sdílení na počítači (Pavel 2026-11-18): Kopírovat odkaz · Facebook · WhatsApp · E-mail. Obyčejné odkazy, žádné skripty
  // sociálních sítí (nesledují návštěvníky, viz Soukromí). Na telefonu dál systémová nabídka sdílení (Facebook, Messenger, WhatsApp…).
  // Ikonky: Lucide copy, mail; Tabler brand-facebook, brand-whatsapp (čára 2 px).
  const SH_IK = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  const SH_POL = [
    { k: 'kopirovat', t: 'Kopírovat odkaz', ik: '<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>' },
    { k: 'facebook', t: 'Facebook', ik: '<path d="M7 10v4h3v7h4v-7h3l1 -4h-4v-2a1 1 0 0 1 1 -1h3v-4h-3a5 5 0 0 0 -5 5v2h-3"/>',
      href: (u) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(u)}` },
    { k: 'whatsapp', t: 'WhatsApp', ik: '<path d="M3 21l1.65 -3.8a9 9 0 1 1 3.4 2.9l-5.05 .9"/><path d="M9 10a.5 .5 0 0 0 1 0v-1a.5 .5 0 0 0 -1 0v1a5 5 0 0 0 5 5h1a.5 .5 0 0 0 0 -1h-1a.5 .5 0 0 0 0 1"/>',
      href: (u) => `https://wa.me/?text=${encodeURIComponent(`${document.title} ${u}`)}` },
    { k: 'email', t: 'E-mail', ik: '<path d="m22 7-8.991 5.727a2 2 0 0 1-2.009 0L2 7"/><rect x="2" y="4" width="20" height="16" rx="2"/>',
      href: (u) => `mailto:?subject=${encodeURIComponent(document.title)}&body=${encodeURIComponent(u)}` },
    // systémové sdílení (na Macu AirDrop, Zprávy, Poznámky…), jen kde ho prohlížeč umí (Firefox ne); Pavel 2026-11-18 „kombinace“
    ...(navigator.share ? [{ k: 'dalsi', t: 'Další možnosti…', ik: '<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>' }] : []),
  ];
  const shMenu = document.createElement('div');
  shMenu.className = 'share-menu nb-sklo'; shMenu.id = 'shareMenu'; shMenu.hidden = true; shMenu.setAttribute('role', 'menu'); shMenu.setAttribute('aria-label', 'Sdílet');
  shMenu.innerHTML = SH_POL.map((p) => (p.href
    ? `<a role="menuitem" data-k="${p.k}" target="_blank" rel="noopener">${SH_IK(p.ik)}<span>${p.t}</span></a>`
    : `<button type="button" role="menuitem" data-k="${p.k}">${SH_IK(p.ik)}<span>${p.t}</span></button>`)).join('');
  document.body.append(shMenu);
  let shUrl = '', shFrom = null;
  const shClose = (vratFokus) => { if (shMenu.hidden) return; shMenu.hidden = true; shFrom?.setAttribute('aria-expanded', 'false'); if (vratFokus) shFrom?.focus(); };
  function shOpen(btn) {
    shUrl = shareUrl(); shFrom = btn;
    for (const p of SH_POL) if (p.href) shMenu.querySelector(`[data-k="${p.k}"]`).href = p.href(shUrl);
    shMenu.hidden = false; btn.setAttribute('aria-expanded', 'true');
    // vedle tlačítka: u ovládání mapy (vpravo) nalevo od něj, jinak pod ním; vždy celé v okně
    const r = btn.getBoundingClientRect(), m = shMenu.getBoundingClientRect(), vlevo = !!btn.closest('.controls');
    let x = vlevo ? r.left - m.width - 8 : r.right - m.width, y = vlevo ? r.bottom - m.height : r.bottom + 8;
    x = Math.max(8, Math.min(x, innerWidth - m.width - 8)); y = Math.max(8, Math.min(y, innerHeight - m.height - 8));
    shMenu.style.left = `${x}px`; shMenu.style.top = `${y}px`;
    shMenu.querySelector('[role="menuitem"]').focus();
  }
  shMenu.addEventListener('click', (e) => {
    const it = e.target.closest('[data-k]'); if (!it) return;
    if (it.dataset.k === 'kopirovat') copyLink(shUrl);
    else if (it.dataset.k === 'dalsi') navigator.share({ title: document.title, url: shUrl }).catch(() => {});   // zavřené okno: nic nehlásit
    else if (it.dataset.k === 'facebook') { e.preventDefault(); open(it.href, 'sdilet', 'width=620,height=560'); }   // okno Facebooku jako dřív u tlačítek Sdílet
    shClose(false);
  });
  shMenu.addEventListener('keydown', (e) => {
    const pol = [...shMenu.querySelectorAll('[role="menuitem"]')], i = pol.indexOf(document.activeElement);
    if (e.key === 'Escape') { e.stopPropagation(); shClose(true); }
    else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); pol[(i + (e.key === 'ArrowDown' ? 1 : pol.length - 1)) % pol.length].focus(); }
    else if (e.key === 'Tab') shClose(false);
  });
  document.addEventListener('pointerdown', (e) => { if (!shMenu.hidden && !shMenu.contains(e.target) && !shFrom?.contains(e.target)) shClose(false); }, true);
  async function share(e) {
    const btn = e?.currentTarget;
    if (navigator.share && isMobile()) {
      try { await navigator.share({ title: document.title, url: shareUrl() }); }
      catch (err) { if (!err || err.name !== 'AbortError') copyLink(shareUrl()); }   // zavřená nabídka: nic nehlásit
      return;
    }
    if (!btn) { copyLink(shareUrl()); return; }
    if (!shMenu.hidden && shFrom === btn) { shClose(false); return; }   // druhé klepnutí nabídku zavře
    shOpen(btn);
  }
  for (const id of ['share', 'mShare', 'cardShare']) $(id)?.setAttribute('aria-haspopup', 'menu');
  zbtn('share', share); zbtn('mShare', share); zbtn('cardShare', share);
  function setMenu(open) { $('panel').classList.toggle('closed', !open); $('menu').setAttribute('aria-expanded', String(open)); $('menu').textContent = open ? 'Skrýt' : 'Menu'; }
  $('menu').addEventListener('click', () => setMenu($('panel').classList.contains('closed')));
  // desktop: panel jde zasunout ouškem vpravo od něj, stav si pamatuje prohlížeč
  function setFold(f) {
    document.body.classList.toggle('folded', f);
    const t = f ? 'Vysunout panel' : 'Zasunout panel';
    $('fold').textContent = f ? '›' : '‹'; $('fold').title = t; $('fold').setAttribute('aria-label', t); $('fold').setAttribute('aria-expanded', String(!f));
    $('panel').inert = f && !isMobile();
    try { localStorage.setItem('izo-fold', f ? '1' : '0'); } catch {}
  }
  $('fold').addEventListener('click', () => setFold(!document.body.classList.contains('folded')));
  new ResizeObserver(() => document.documentElement.style.setProperty('--pw', $('panel').offsetWidth + 'px')).observe($('panel'));
  try { if (localStorage.getItem('izo-fold') === '1' && !isMobile()) setFold(true); } catch {}
  if (isMobile()) { setMenu(false); $('placesBox').open = false; }
  function layN(id, n) { const e = $(id); if (e) e.textContent = Number.isFinite(n) ? ` (${n})` : ''; }   // počet položek u přepínače vrstvy
  $('l-labels').addEventListener('change', (e) => $('map').classList.toggle('nolabels', !e.target.checked));
  // (přepínače kategorií míst obsluhuje blok sekce Místa výš, podle web/kategorie.js)
  applyLayers(hashTokens);                                   // vrstvy ze sdíleného odkazu

