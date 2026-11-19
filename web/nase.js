// Naše vrstva vzhledu nad autorovým web/app.html (Pavel + Claude, 2026-11-16).
// Menu B: svislá lišta s ikonami vlevo + vysouvací panel (na telefonu spodní lišta a panel nad ní).
// Nic se znovu nestaví: existující prvky (hledání, přepínače, seznamy) se jen přestěhují do sekcí,
// takže si nechají id i obsluhu z app.html. Spouští se hned za značkami, před skriptem mapy.
// Rozhodnutí a návrh: napady/PAVLOVY-NAPADY-2026-11-15.md („Plán stavby B“), navrhy/menu.html (kolo 2, B).
(() => {
  const $ = (id) => document.getElementById(id);
  const panel = $('panel'), head = panel && panel.querySelector('.head');
  if (!head) return;
  const body = document.body;
  const mobil = matchMedia('(max-width: 640px)');
  const uloz = (k, v) => { try { localStorage.setItem(k, v); } catch {} };
  const nacti = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
  uloz('izo-fold', '0');          // autorovo ouško panelu nahrazuje lišta; zasunutý panel by jinak zůstal neviditelný a inert

  // ---------- ikony: Lucide (ISC), čára 2 px ----------
  const I = (s) => `<svg class="nb-ik" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${s}</svg>`;
  const P = (...d) => d.map((x) => `<path d="${x}"/>`).join('');
  const IK = {
    hledat: I('<circle cx="11" cy="11" r="8"/>' + P('m21 21-4.3-4.3')),
    vzhled: I('<circle cx="12" cy="12" r="4"/>' + P('M12 2v2', 'M12 20v2', 'm4.93 4.93 1.41 1.41', 'm17.66 17.66 1.41 1.41', 'M2 12h2', 'M20 12h2', 'm6.34 17.66-1.41 1.41', 'm19.07 4.93-1.41 1.41')),
    vrstvy: I(P('m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z', 'm22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65', 'm22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65')),
    mista: I(P('M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0') + '<circle cx="12" cy="10" r="3"/>'),
    dnes: I('<rect x="3" y="4" width="18" height="18" rx="2"/>' + P('M16 2v4', 'M8 2v4', 'M3 10h18')),
    kamery: I('<rect x="2" y="6" width="14" height="12" rx="2"/>' + P('m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.87a.5.5 0 0 0-.752-.432L16 10.5')),   // Lucide video
    napoveda: I('<circle cx="12" cy="12" r="10"/>' + P('M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3', 'M12 17h.01')),
    plus: I(P('M5 12h14', 'M12 5v14')), minus: I(P('M5 12h14')),
    domu: I(P('M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8', 'M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z')),
    sdilet: I(P('M12 2v13', 'm16 6-4-4-4 4', 'M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8')),
    zavrit: I(P('M18 6 6 18', 'm6 6 12 12')),
    poloha: I(P('M2 12h3', 'M19 12h3', 'M12 2v3', 'M12 19v3') + '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="3"/>'),   // Lucide locate-fixed
  };
  // pořadí v liště (Pavel 2026-11-16): Vzhled, Vrstvy, Místa, Dnes, Kamery, Hledat
  const NAZVY = { vzhled: 'Vzhled', vrstvy: 'Vrstvy', mista: 'Místa', dnes: 'Dnes', kamery: 'Kamery', hledat: 'Hledat' };
  const KLICE = Object.keys(NAZVY);
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };

  // ---------- sekce panelu: přestěhovat existující prvky ----------
  const blok = (prvek) => prvek && prvek.closest('#panel > *');      // přímé dítě panelu, ve kterém prvek leží
  const sek = {};
  for (const k of KLICE) { sek[k] = el('div', 'nb-pane'); sek[k].dataset.pane = k; sek[k].hidden = true; sek[k].id = `nb-${k}`; }

  const hledani = panel.querySelector('.search');
  sek.hledat.append(hledani);

  const vzhled = [blok($('wipSel')), blok($('seasons')), panel.querySelector('.daynight'), blok($('weather'))].filter(Boolean);
  sek.vzhled.append(...vzhled);
  // úsporný režim jako poslední blok Vzhledu, stejně jako „Podle skutečného času“ (Pavel 2026-11-17)
  const ecoLab = $('ecoBox')?.closest('label');
  if (ecoLab) { ecoLab.classList.add('realtime'); const b = el('div', null, '<p class="label">Výkon</p>'); b.append(ecoLab); sek.vzhled.append(b); }

  // vrstvy ve skupinách podle smyslu. Kategorie míst (web/kategorie.js) mají stejnou ikonku a barvu jako v Místech a v mapě
  // (Pavel 2026-11-16); přepínače kromě autorova „Popisky“ (= Příběhy) tu vzniknou, počty a skrytí doplní app.html.
  const stareVrstvy = blok($('l-labels'));
  const KATEG = window.IZO_KAT || [];
  const katIk = (c) => { const s = el('span', 'kat-ik', window.IZO_KAT_SVG(c.ik)); s.style.setProperty('--kat', c.barva); return s; };
  for (const c of KATEG) {
    let lab = $(c.vrstva)?.closest('label');
    if (!lab) { lab = el('label', null, `<input type="checkbox" id="${c.vrstva}" checked>`); lab.hidden = true; stareVrstvy?.append(lab); }
    for (const n of [...lab.childNodes]) if (n.nodeType === 3) n.remove();               // autorův text „Popisky“ i mezery
    lab.querySelector('.lay-n')?.remove();
    const vstup = lab.querySelector('input');
    vstup.after(katIk(c), document.createTextNode(c.nazev), Object.assign(el('span', 'lay-n'), { id: `n-${c.k}` }));
  }
  // ostatní vrstvy taky s ikonkou, ať všechny názvy začínají pod sebou (Lucide: car-front, users, wind, mouse-pointer-2)
  // Vrstva hasičů zrušena (Pavel 2026-11-18), výjezdy jsou jen v sekci Dnes.
  const DALSI_IK = {
    'l-traffic': { barva: 'var(--muted)', ik: '<path d="m21 8-2 2-1.5-3.7A2 2 0 0 0 15.646 5H8.4a2 2 0 0 0-1.903 1.257L5 10 3 8"/><path d="M7 14h.01"/><path d="M17 14h.01"/><rect width="18" height="8" x="3" y="10" rx="2"/><path d="M5 18v2"/><path d="M19 18v2"/>' },
    'l-lide': { barva: 'var(--muted)', ik: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><path d="M16 3.128a4 4 0 0 1 0 7.744"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><circle cx="9" cy="7" r="4"/>' },
    'l-smoke': { barva: 'var(--muted)', ik: '<path d="M12.8 19.6A2 2 0 1 0 14 16H2"/><path d="M17.5 8a2.5 2.5 0 1 1 2 4H2"/><path d="M9.8 4.4A2 2 0 1 1 11 8H2"/>' },
    'l-hover': { barva: 'var(--muted)', ik: '<path d="M4.037 4.688a.495.495 0 0 1 .651-.651l16 6.5a.5.5 0 0 1-.063.947l-6.124 1.58a2 2 0 0 0-1.438 1.435l-1.579 6.126a.5.5 0 0 1-.947.063z"/>' },
  };
  const skupina = (nadpis, ids) => {
    const s = el('div', 'nb-sek', `<p class="label">${nadpis}</p>`), l = el('div', 'nb-layers');
    for (const id of ids) {
      const vstup = $(id); if (!vstup) continue;
      const lab = vstup.closest('label');
      if (DALSI_IK[id] && window.IZO_KAT_SVG) vstup.after(katIk(DALSI_IK[id]));
      l.append(lab);
    }
    s.append(l); return s;
  };
  sek.vrstvy.append(skupina('Místa', KATEG.length ? KATEG.map((c) => c.vrstva) : ['l-labels']),
    skupina('Život ve městě', ['l-traffic', 'l-lide', 'l-smoke', 'l-hover']));
  // přepínač, který app.html nezná (přibyl by v autorově novince), se neztratí: přidá se do poslední skupiny
  if (stareVrstvy) { for (const lab of stareVrstvy.querySelectorAll('label')) sek.vrstvy.lastElementChild.lastElementChild.append(lab); stareVrstvy.remove(); }

  // předvolby vrstev (F16, Pavel 2026-11-18 „sedí, stavěj“): jedno klepnutí přepne sadu vrstev. Zvýrazněná je předvolba,
  // která přesně odpovídá zapnutým vrstvám, takže po ručním přepnutí zhasne. Vánoční výzdobu nechávají být.
  // Vrstva bez dat (skrytý přepínač) se nepočítá. Odkaz Sdílet je nese sám, protože ukládá vypnuté vrstvy.
  const ZIVOT = ['l-traffic', 'l-lide', 'l-smoke', 'l-hover'];
  // jen ikonky v jednom řádku (Pavel 2026-11-18: „ať to nezabírá tolik místa“), název v bublině a vedle nadpisu Předvolby.
  // Lucide: bus, binoculars, balloon, map, check-check
  const PREDVOLBY = [
    { nazev: 'Jezdím MHD', kat: ['doprava'], zivot: ['l-traffic', 'l-hover'],
      ik: '<path d="M8 6v6"/><path d="M15 6v6"/><path d="M2 12h19.6"/><path d="M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H4a2 2 0 0 0-2 2v10h3"/><circle cx="7" cy="18" r="2"/><path d="M9 18h5"/><circle cx="16" cy="18" r="2"/>' },
    { nazev: 'Poznávám Hodonín', kat: ['pribehy', 'pamatky', 'kultura', 'kostely', 'jidlo', 'ubytovani', 'priroda'],
      ik: '<path d="M10 10h4"/><path d="M19 7V4a1 1 0 0 0-1-1h-2a1 1 0 0 0-1 1v3"/><path d="M20 21a2 2 0 0 0 2-2v-3.851c0-1.39-2-2.962-2-4.829V8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v11a2 2 0 0 0 2 2z"/><path d="M 22 16 L 2 16"/><path d="M4 21a2 2 0 0 1-2-2v-3.851c0-1.39 2-2.962 2-4.829V8a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v11a2 2 0 0 1-2 2z"/><path d="M9 7V4a1 1 0 0 0-1-1H6a1 1 0 0 0-1 1v3"/>' },
    { nazev: 'Ven s dětmi', kat: ['pribehy', 'priroda', 'sport', 'jidlo', 'kultura'],
      ik: '<path d="M12 16v1a2 2 0 0 0 2 2h1a2 2 0 0 1 2 2v1"/><path d="M12 6a2 2 0 0 1 2 2"/><path d="M18 8c0 4-3.5 8-6 8s-6-4-6-8a6 6 0 0 1 12 0"/>' },
    { nazev: 'Čistá mapa', kat: [],
      ik: '<path d="M14.106 5.553a2 2 0 0 0 1.788 0l3.659-1.83A1 1 0 0 1 21 4.619v12.764a1 1 0 0 1-.553.894l-4.553 2.277a2 2 0 0 1-1.788 0l-4.212-2.106a2 2 0 0 0-1.788 0l-3.659 1.83A1 1 0 0 1 3 19.381V6.618a1 1 0 0 1 .553-.894l4.553-2.277a2 2 0 0 1 1.788 0z"/><path d="M15 5.764v15"/><path d="M9 3.236v15"/>' },
    { nazev: 'Vše', kat: KATEG.map((c) => c.k), ik: '<path d="M18 6 7 17l-5-5"/><path d="m22 10-7.5 7.5L13 16"/>' },
  ];
  const cil = (p) => { const m = {};
    for (const c of KATEG) m[c.vrstva] = p.kat.includes(c.k);
    for (const id of ZIVOT) m[id] = !p.zivot || p.zivot.includes(id);
    return m; };
  const dostupne = (id) => { const v = $(id); return v && !v.closest('label')?.hidden ? v : null; };
  const predvolby = el('div', 'nb-predvolby');
  predvolby.setAttribute('role', 'group'); predvolby.setAttribute('aria-label', 'Předvolby vrstev');
  const tlPredvoleb = PREDVOLBY.map((p) => {
    const b = el('button', 'px-btn', I(p.ik)); b.type = 'button'; b.setAttribute('aria-pressed', 'false');
    b.title = p.nazev; b.setAttribute('aria-label', p.nazev);
    b.addEventListener('click', () => {
      for (const [id, on] of Object.entries(cil(p))) { const v = dostupne(id); if (v && v.checked !== on) { v.checked = on; v.dispatchEvent(new Event('change', { bubbles: true })); } }
      obnovPredvolby();
    });
    predvolby.append(b); return [b, p];
  });
  function obnovPredvolby() {
    let zap = '';
    for (const [b, p] of tlPredvoleb) {
      const sedi = Object.entries(cil(p)).every(([id, on]) => { const v = dostupne(id); return !v || v.checked === on; });
      b.setAttribute('aria-pressed', String(sedi));
      if (sedi && !zap) zap = p.nazev;
    }
    if (typeof jmenoPredvolby !== 'undefined') jmenoPredvolby.textContent = zap ? `· ${zap}` : '';   // na telefonu bublina není
  }
  // blok nemá přepínače, skrývání prázdných skupin (nase.css .nb-sek:not(:has(label…))) se ho proto netýká
  const blokPredvoleb = el('div', 'nb-sek nb-sek-predvolby', '<p class="label">Předvolby <span class="nb-predvolba-jmeno"></span></p>'); blokPredvoleb.append(predvolby);
  var jmenoPredvolby = blokPredvoleb.querySelector('.nb-predvolba-jmeno');
  sek.vrstvy.prepend(blokPredvoleb);
  sek.vrstvy.addEventListener('change', obnovPredvolby);
  // vrstvy z odkazu (#…-bezdopravy) nastaví a vrstvy s daty odkryje až app.html, a to po načtení dat (později než „load“)
  addEventListener('load', obnovPredvolby);
  new MutationObserver(obnovPredvolby).observe(sek.vrstvy, { subtree: true, attributes: true, attributeFilter: ['hidden'] });
  sek.vrstvy.addEventListener('input', obnovPredvolby);

  // tlačítko Moje poloha (F18) pod Sdílet, obsluha ve web/js/66-poloha.js; bez polohy v prohlížeči se nepřidá
  if ('geolocation' in navigator && $('share')) {
    const b = el('button', 'px-btn', IK.poloha); b.type = 'button'; b.id = 'poloha';
    b.title = 'Moje poloha'; b.setAttribute('aria-label', 'Moje poloha'); b.setAttribute('aria-pressed', 'false');
    $('share').after(b);
  }

  // rozbalovací bloky (details) jsou v sekci pořád otevřené, jejich nadpis je jen popisek
  const vzdyOtevreny = (d) => { if (!d) return; d.open = true; d.classList.add('nb-otevreny');
    d.addEventListener('toggle', () => { if (!d.open) d.open = true; }); };
  const mista = $('placesBox'); sek.mista.append(mista);
  // ---------- Kamery (Pavel 2026-11-16): webkamery z mesto.json "kamery" (window.IZO_KAMERY z app.html) ----------
  // Snímek se obnovuje jen při otevřené sekci a viditelné kartě prohlížeče (server města nezatěžovat zbytečně).
  const KAMERY = Array.isArray(window.IZO_KAMERY) ? window.IZO_KAMERY : [];
  const kamObr = [];
  sek.kamery.append(el('p', 'label', 'Webkamery'));
  for (const k of KAMERY) {
    const box = el('figure', 'nb-kamera');
    if (k.obrazek && !k.mimo_provoz) {
      const img = el('img'); img.alt = `Webkamera: ${k.nazev}`; img.loading = 'lazy'; img.decoding = 'async';
      const cas = el('span', 'nb-kamera-cas');
      img.addEventListener('load', () => { cas.textContent = `obnoveno ${new Date().toLocaleTimeString('cs-CZ', { hour: 'numeric', minute: '2-digit', second: '2-digit' })}`; box.classList.remove('chyba'); });
      img.addEventListener('error', () => { cas.textContent = 'obraz se teď nenačetl'; box.classList.add('chyba'); });
      box.append(img, cas); kamObr.push({ img, k });
    } else box.append(el('p', 'nb-kamera-mimo', k.mimo_provoz || 'Kamera je teď mimo provoz.'));
    const pop = el('figcaption');
    pop.append(el('b', null, k.nazev), ...(k.popis ? [el('span', null, k.popis)] : []));
    const odkazy = el('span', 'nb-kamera-odkazy');
    if (Number.isFinite(k.lat) && Number.isFinite(k.lon)) {
      const naMape = el('button', 'nb-odkaz', 'Ukázat na mapě'); naMape.type = 'button';
      naMape.addEventListener('click', () => {
        location.hash = `${location.hash.slice(1).split('@')[0] || 'leto'}@${k.lat},${k.lon},0.35`;
        // ikonka místa u kamery blikne jako při výběru z Míst (Pavel 2026-11-19); až po přeletu mapy, ať je bliknutí vidět
        setTimeout(() => window.IZO_OZNAC?.(k.lat, k.lon), 700);
      });
      odkazy.append(naMape);
    }
    if (k.zdroj_url) { const a = el('a', null, `Zdroj: ${k.zdroj || new URL(k.zdroj_url).hostname}`); a.href = k.zdroj_url; a.target = '_blank'; a.rel = 'noopener'; odkazy.append(a); }
    pop.append(odkazy); box.append(pop); sek.kamery.append(box);
  }
  const kamObnov = () => { for (const { img, k } of kamObr) img.src = `${k.obrazek}${k.obrazek.includes('?') ? '&' : '?'}t=${Date.now()}`; };
  let kamT = null;
  const kamHlidej = () => {
    const ma = otevrena === 'kamery' && !document.hidden;
    if (ma && !kamT) { kamObnov(); kamT = setInterval(kamObnov, 1000 * Math.max(5, Math.min(...KAMERY.map((k) => k.obnova || 10)))); }
    if (!ma && kamT) { clearInterval(kamT); kamT = null; }
  };
  document.addEventListener('visibilitychange', kamHlidej);

  // Místa (Pavel 2026-11-16): Příběhy a skupiny veřejných míst (app.html #verSkupiny) jako jedna řada rozbalovacích
  // skupin se šipkou; otevřená je vždy jen jedna (otevření jiné ostatní zavře), na začátku Příběhy
  if (mista) {
    mista.classList.add('ver-sk', 'ver-pribehy');
    const s = mista.querySelector('summary');
    const c0 = KATEG.find((c) => c.k === 'pribehy');
    for (const n of s.childNodes) if (n.nodeType === 3 && n.textContent.trim()) { n.textContent = c0 ? c0.nazev : 'Příběhy'; break; }
    if (c0) { s.prepend(katIk(c0)); mista.style.setProperty('--kat', c0.barva); }
    mista.open = !mobil.matches;
  }
  if ($('verSkupiny')) sek.mista.append($('verSkupiny'));
  sek.mista.addEventListener('toggle', (e) => {
    const d = e.target; if (!d.open || !d.classList?.contains('ver-sk')) return;
    for (const o of sek.mista.querySelectorAll('details.ver-sk[open]')) if (o !== d) o.open = false;
  }, true);                                                     // toggle nebublá, proto zachytávání
  const dnesBox = $('dnesBox'), vylBox = $('vylukyBox');
  vzdyOtevreny(dnesBox); vzdyOtevreny(vylBox);
  sek.dnes.append(dnesBox, vylBox, el('p', 'nb-prazdno', 'Dnes se ve městě nic zvláštního neděje.'));

  // ---------- nápověda se záložkami Ovládání · Vrstvy · O projektu (Pavel 2026-11-15, bod 6) ----------
  // „O projektu“ z panelu jde sem, menu slouží mapě. Zdroje dat a kredit autora zůstávají (záložka O projektu).
  // Autorův návod na ovládání popisoval starou spodní lištu telefonu, proto vlastní text. Klávesy ověřeny v prohlížeči.
  // Čtvrtá záložka „Napište nám“ = formulář (body 1 a 2, Pavel 2026-11-19), server worker/zprava.js.
  const about = panel.querySelector('.about'), dlg = $('helpDlg');
  if (dlg) {
    const nadpis = $('helpTitle'), plocha = $('plochaBtn')?.closest('p'), popis = plocha?.nextElementSibling;
    const zdroje = dlg.querySelector('.muted');
    // Přeskládáno podle navrhy/napoveda.html (Pavel 2026-11-19: „OK“): ~950 → ~330 viditelných slov, Soukromí a zdroje sbalené
    const ZAL = { ovladani: 'Ovládání', vrstvy: 'V mapě', projekt: 'O mapě', napiste: 'Napište nám' };
    const klav = (k) => `<kbd>${k}</kbd>`;
    // krátké názvy kategorií pro tečky (celé názvy jsou ve Vrstvách a Místech)
    const KRATCE = { kostely: 'Kostely', jidlo: 'Restaurace', priroda: 'Příroda' };
    const obsah = {
      ovladani: `<dl class="nb-ovl">
        <dt>Posun</dt><dd>táhněte myší nebo prstem, klávesy ${klav('←')}${klav('↑')}${klav('↓')}${klav('→')}</dd>
        <dt>Přiblížení</dt><dd>kolečko, dva prsty nebo dvojklik; ${klav('+')} ${klav('−')}, celá mapa ${klav('0')}</dd>
        <dt>Karta</dt><dd>klepněte na budovu nebo místo; zavře ji křížek nebo ${klav('Esc')}</dd>
        <dt>Hledat</dt><dd>ulice, adresy, budovy i místa; vybraná ulice se žlutě obtáhne</dd>
        <dt>Vzhled</dt><dd>roční období, denní doba a počasí, nebo podle skutečnosti</dd>
        <dt>Sdílet</dt><dd>odkaz přesně na to, co vidíte; z karty i s otevřenou kartou</dd>
        <dt>Moje poloha</dt><dd>modrá tečka, kde právě jste; prohlížeč se nejdřív zeptá</dd>
      </dl>`,
      vrstvy: `<h3>Místa</h3>
      <p>Ikonka v barvě kategorie, klepnutím karta s adresou, otevírací dobou a odkazy. V oddálené mapě tečky.</p>
      <div class="nb-kat-tecky">${KATEG.map((c) => `<span><i style="background:${c.barva}"></i>${KRATCE[c.k] || c.nazev}</span>`).join('')}</div>
      <p class="nb-napo-pozn">Restaurace ukážou, jestli je teď otevřeno. Památky mají fotku a číslo z Ústředního seznamu kulturních památek.</p>
      <h3>Předvolby</h3>
      <p>Jedním klepnutím sada vrstev: Jezdím MHD, Poznávám Hodonín, Ven s dětmi, Čistá mapa, Vše.</p>
      <h3>Život města</h3>
      <ul class="nb-napo">
        <li><b>Doprava:</b> MHD a vlaky podle jízdních řádů, kde to jde, živě i se zpožděním; auta podle sčítání dopravy.</li>
        <li><b>Lidé:</b> chodci, cyklisté, zvířata v zoo a loďky; řídí je denní doba, počasí a roční období.</li>
        <li><b>Kouř z komínů</b> se stáčí podle skutečného větru.</li>
      </ul>
      <p class="nb-napo-pozn">Auta, lidé a loďky jsou ilustrační, ne skuteční.</p>`,
    };
    const listy = el('div', 'chips4 nb-zalozky');
    listy.setAttribute('role', 'tablist');
    listy.innerHTML = Object.entries(ZAL).map(([k, t]) => `<button class="px-btn" type="button" role="tab" data-zal="${k}">${t}</button>`).join('');
    const telo = el('div', 'nb-napo-telo');
    const okno = {};
    for (const k of Object.keys(ZAL)) { okno[k] = el('div', 'nb-napo-okno', obsah[k] || ''); okno[k].dataset.zal = k; okno[k].setAttribute('role', 'tabpanel'); telo.append(okno[k]); }
    if (plocha) { okno.ovladani.append(plocha, el('p', 'nb-napo-pozn nb-plocha-pozn', 'Mapa se pak otevře jako aplikace, bez lišty prohlížeče.')); }
    // autorův popis a „Jak mapa vzniká“ nahrazuje kratší text (navrhy/napoveda.html); jejich prvky z okna zmizí
    popis?.remove(); about?.remove();
    okno.projekt.append(
      el('p', null, 'Izometrická pixel-art mapa Hodonína ve stylu SimCity 2000: roční období, den a noc, počasí, místa s příběhy a živá doprava.'),
      el('h3', null, 'Kdo za ní stojí'),
      el('p', null, 'Mapu pro Hodonín upravil a doplnil Paul Hubiss.'),     // Pavel 2026-11-19: jen tahle věta
      el('p', null, 'Postavená je na otevřeném nástroji <a href="https://izomapa.fun" target="_blank" rel="noopener">izomapa</a> od Adama Klatovského (původně Izometrický Liberec).'),
      // AGPL-3.0 (Pavel 2026-11-19): kód naší verze je veřejný, nastroje-pavel/zverejni_kod.py ho nahrává při nasazení
      el('p', null, '<a href="https://github.com/PaulHubiss/izomapa-hodonin" target="_blank" rel="noopener">Zdrojový kód</a> této verze je veřejný (licence AGPL-3.0).'));
    // upozornění na nepřesnost (Pavel 2026-11-17: „aby je nikdo nebral příliš závazně“)
    okno.projekt.append(el('h3', null, 'Jak mapu brát'),
      el('p', 'nb-upozorneni', 'Je to ilustrace z otevřených dat, ne úřední podklad. Otevírací doby, jízdní řády a program si ověřte u zdroje.'),
      el('h3', null, 'Jak vzniká'),
      el('p', null, 'Budovy, ulice a voda z OpenStreetMap a Overture Maps, výšky budov, les a pole z dat ČÚZK. Lampy, zaparkovaná auta a část stromů jsou doplněné podle typu území.'));
    // Soukromí (napady/PRED-SPUSTENIM.md kap. 2, 2026-11-18): ověřeno v kódu – v prohlížeči jen izo-fold, izo-realtime,
    // izo-realweather (localStorage) a izo-eco (sessionStorage); přímá spojení: Open-Meteo, HZS JMK, KORDIS (gis.brno.cz),
    // Wikimedia (fotky v kartě), hodonin.eu (kamera). Program a výluky jdou přes functions/api. Písmo a knihovny jsou u nás.
    // Cloudflare Web Analytics zapnuté 2026-11-19 (web/app.html, jen na ostrém webu), věta v odrážce o službách. Hlášení nepřesností (od 2026-11-19, worker/index.js +
    // hlaseni/worker.js): text, název a poloha místa, otisk IP (SHA-256 se solí SALT, IP se neukládá), limit 3 za hodinu, e-mail Pavlovi.
    const sbal = (nadpis, ...obsah) => { const d = el('details', 'nb-sbal'); d.append(el('summary', null, nadpis), ...obsah); return d; };
    okno.projekt.append(sbal('Soukromí', el('ul', 'nb-napo nb-sbal-seznam',
      '<li>Žádné cookies, nikdo vás nesleduje. Zvolená nastavení (skutečný čas a počasí, úsporný režim) si pamatuje jen váš prohlížeč.</li>'
      + '<li>Kvůli živým datům se prohlížeč připojuje k Open-Meteo (počasí), HZS JMK (výjezdy hasičů), KORDIS JMK (poloha autobusů), '
      + 'Wikimedia Commons (fotky památek) a k webkameře města (jen při otevřených Kamerách); tyto služby vidí vaši IP adresu. '
      + 'Program akcí a výluky stahuje náš server. Písmo i knihovny jsou u nás, web běží na Cloudflare. Návštěvnost měří Cloudflare Web Analytics bez cookies a jen souhrnně (kolik zobrazení, odkud přišla), nepozná, kdo jste.</li>'
      + '<li>Moje poloha: zjišťuje ji váš prohlížeč jen po vašem svolení, mapa ji jen zobrazí, nikam ji neposílá ani neukládá.</li>'
      + '<li>Hlášení nepřesnosti a zprávy: uloží se jen to, co napíšete (jméno a e-mail jsou nepovinné, e-mail slouží jen k odpovědi). '
      + 'IP adresa se neukládá, jen z ní jednosměrně odvozený kód proti zahlcení. O nové zprávě dostane autor mapy e-mail. '
      + 'Formulář chrání Cloudflare Turnstile, který ověří, že ho posílá člověk.</li>')));
    // uvedení zdrojů: jedna věta zůstává vidět (licence OSM a ČÚZK chtějí viditelné uvedení), celý seznam je sbalený
    okno.projekt.append(el('p', 'nb-napo-pozn nb-zdroje-kratce', 'Mapová data © přispěvatelé OpenStreetMap, ČÚZK a další, viz Zdroje dat.'));
    if (zdroje) okno.projekt.append(sbal('Zdroje dat', zdroje));

    // ---------- Napište nám (Pavel 2026-11-19): druh, zpráva, jméno, e-mail, poloha; Turnstile až při otevření záložky ----------
    const TS_KLIC = '0x4AAAAAAGIVR_81Z6hByeOw';    // veřejný klíč widgetu „Hodonin - formular Napiste nam“ (tajný je ve Workeru)
    const DRUHY_Z = { misto: 'Místo', napad: 'Nápad', chyba: 'Chyba', jine: 'Vzkaz' };
    const PRO_DRUH = {
      misto: 'Které místo v mapě chybí, nebo co o něm víte? Klidně i odkaz na zdroj.',
      napad: 'Co by se v mapě hodilo?',
      chyba: 'Co nefunguje? Pomůže, na jakém zařízení a v jakém prohlížeči.',
      jine: 'Vaše zpráva',
    };
    const fz = el('form', 'nb-zprava'); fz.noValidate = true;
    fz.innerHTML = `<p class="nb-napo-pozn">Chybí v mapě místo, víte o něm víc, máte nápad nebo něco nefunguje? Napište. Zprávu čte autor úprav mapy.</p>
      <div class="chips4 nb-zprava-druh" role="group" aria-label="O co jde">${Object.entries(DRUHY_Z).map(([k, t]) => `<button class="px-btn" type="button" data-druh="${k}" aria-pressed="false">${t}</button>`).join('')}</div>
      <p class="nb-zprava-misto" hidden><span></span> <button class="px-btn" type="button" aria-label="Zprávu nevázat na místo" title="Zprávu nevázat na místo">×</button></p>
      <label class="nb-pole"><span>Zpráva</span><textarea name="text" rows="5" maxlength="2000" required></textarea></label>
      <div class="nb-zprava-radek">
        <label class="nb-pole"><span>Jméno <i>(nepovinné)</i></span><input name="jmeno" maxlength="80" autocomplete="name"></label>
        <label class="nb-pole"><span>E-mail <i>(jen pro odpověď)</i></span><input name="email" type="email" maxlength="200" autocomplete="email" inputmode="email"></label>
      </div>
      <label class="nb-zprava-poloha"><input type="checkbox" name="poloha" checked> Přiložit místo, na které se v mapě dívám</label>
      <div class="nb-zprava-ts"></div>
      <div class="nb-zprava-odeslat"><button class="px-btn" type="submit">Odeslat</button><span class="nb-zprava-stav" role="status"></span></div>`;
    okno.napiste.append(fz);
    const zMisto = fz.querySelector('.nb-zprava-misto'), zText = fz.elements.text, zStav = fz.querySelector('.nb-zprava-stav');
    let zDruh = null, zKarta = null, tsToken = '', tsId = null;
    const stav = (t, cls) => { zStav.textContent = t; zStav.className = 'nb-zprava-stav' + (cls ? ' ' + cls : ''); };
    const vyberDruh = (k) => {
      zDruh = k;
      for (const b of fz.querySelectorAll('[data-druh]')) b.setAttribute('aria-pressed', String(b.dataset.druh === k));
      zText.placeholder = PRO_DRUH[k] || PRO_DRUH.jine;
    };
    fz.querySelector('.nb-zprava-druh').addEventListener('click', (e) => { const b = e.target.closest('[data-druh]'); if (b) vyberDruh(b.dataset.druh); });
    const nastavKartu = (k) => {
      zKarta = k; zMisto.hidden = !k;
      if (k) zMisto.querySelector('span').textContent = `K místu: ${k.title}`;
    };
    zMisto.querySelector('button').addEventListener('click', () => nastavKartu(null));
    // Turnstile jen na ostrém webu (widget zná jen hodonin.paulhubiss.cz); načte se až s otevřením záložky, ne všem návštěvníkům
    const naWebu = location.hostname === 'hodonin.paulhubiss.cz';
    const nactiTs = () => {
      if (!naWebu || tsId !== null || window.__tsNacita) return;
      window.__tsNacita = true;
      window.__tsPripraven = () => {
        tsId = window.turnstile.render(fz.querySelector('.nb-zprava-ts'), { sitekey: TS_KLIC, theme: 'dark', language: 'cs', size: 'flexible',
          callback: (t) => { tsToken = t; }, 'expired-callback': () => { tsToken = ''; }, 'error-callback': () => { tsToken = ''; } });
      };
      const s = document.createElement('script');
      s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=__tsPripraven'; s.async = true;
      document.head.append(s);
    };
    const stredMapy = () => {
      const I = window.Izomapa; if (!I) return null;
      try { const v = I.getView(), [wx, wy] = I.imgToWorld(v.x, v.y), [lat, lon] = I.worldToLatLon(wx, wy); return Number.isFinite(lat) ? { lat, lon } : null; } catch { return null; }
    };
    fz.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!zDruh) { stav('Vyberte prosím nahoře, o co jde.', 'err'); return; }
      if (zText.value.trim().length < 5) { stav('Napište prosím aspoň pár slov.', 'err'); zText.focus(); return; }
      const email = fz.elements.email.value.trim();
      if (email && !fz.elements.email.checkValidity()) { stav('E-mail nevypadá správně. Můžete ho i vynechat.', 'err'); fz.elements.email.focus(); return; }
      if (naWebu && !tsToken) { stav('Chvilku, ještě ověřuji, že nejste robot…', ''); return; }
      const poloha = zKarta?.lat != null ? zKarta : (fz.elements.poloha.checked ? stredMapy() : null);
      const tl = fz.querySelector('[type=submit]'); tl.disabled = true; stav('Odesílám…', '');
      try {
        const r = await fetch('api/zprava', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({
          druh: zDruh, text: zText.value.trim(), jmeno: fz.elements.jmeno.value.trim(), email, misto: zKarta?.title || '',
          lat: poloha?.lat, lon: poloha?.lon, token: tsToken }) });
        const d = await r.json().catch(() => ({}));
        if (d.ok) { zText.value = ''; nastavKartu(null); stav('Děkuji! Zpráva je odeslaná.', 'ok'); }
        else stav(d.msg || (naWebu ? 'Zprávu se nepovedlo odeslat. Zkuste to prosím za chvíli.' : 'Odesílání funguje jen na webu mapy.'), 'err');
      } catch { stav('Zprávu teď nejde odeslat (bez připojení?). Zkuste to prosím později.', 'err'); }
      tl.disabled = false;
      if (tsId !== null) { tsToken = ''; window.turnstile.reset(tsId); }   // token platí jen jednou
    });
    // odkaz v kartě místa: otevře záložku s předvyplněným místem a druhem „Místo“
    const karta = $('card'), odkaz = el('p', 'nb-karta-napiste');
    odkaz.innerHTML = '<button type="button" class="nb-odkaz">Víte o tomhle místě víc? Napište nám</button>';
    if (karta) karta.append(odkaz);
    // autorův obsah, který jsme do záložek nerozdělili (návod na ovládání, případné novinky), z okna zmizí jen ten starý návod
    for (const n of [...dlg.children]) if (n.parentElement === dlg && n !== nadpis && !n.classList.contains('close')) {
      if (n.tagName === 'H3' && /Ovládání/.test(n.textContent)) { n.nextElementSibling?.tagName === 'UL' && n.nextElementSibling.remove(); n.remove(); }
      else okno.projekt.append(n);
    }
    if (nadpis) { nadpis.textContent = 'Nápověda'; nadpis.after(listy, telo); }
    const ukaz = (k) => {
      // role="tab" smí jen aria-selected, ne aria-pressed (axe aria-allowed-attr, 2026-11-18); vzhled podle aria-selected v nase.css
      for (const b of listy.children) { const on = b.dataset.zal === k; b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1; }
      for (const [x, o] of Object.entries(okno)) o.classList.toggle('on', x === k);
      telo.scrollTop = 0;                                    // nová záložka od začátku (posouvá se jen obsah, 2026-11-19)
      if (k === 'napiste') nactiTs();
    };
    odkaz.querySelector('button').addEventListener('click', () => {
      const k = window.IZO_KARTA; nastavKartu(k?.title ? k : null); vyberDruh('misto'); stav('', '');
      dlg.showModal(); ukaz('napiste'); zText.focus();
    });
    listy.addEventListener('click', (e) => { const b = e.target.closest('[data-zal]'); if (b) ukaz(b.dataset.zal); });
    listy.addEventListener('keydown', (e) => {                // záložky podle ARIA: šipky mezi nimi, Home/End na kraj
      const tl = [...listy.children], i = tl.indexOf(document.activeElement); if (i < 0) return;
      const j = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tl.length - 1 }[e.key]; if (j === undefined) return;
      e.preventDefault(); const b = tl[(j + tl.length) % tl.length]; ukaz(b.dataset.zal); b.focus();
    });
    ukaz('ovladani');
    dlg.addEventListener('close', () => ukaz('ovladani'));   // příště zase od začátku
  }

  // ---------- hlavička: nadpis, nápověda, zavřít ----------
  const tlacitka = head.querySelector('.head-btns');
  const napoveda = $('help');
  if (napoveda) napoveda.innerHTML = IK.napoveda;
  const zavritBtn = el('button', 'px-btn nb-zavrit', IK.zavrit);
  zavritBtn.type = 'button'; zavritBtn.title = 'Zavřít panel'; zavritBtn.setAttribute('aria-label', 'Zavřít panel');
  tlacitka.append(zavritBtn);
  panel.append(...KLICE.map((k) => sek[k]));

  // ---------- lišta ----------
  const lista = el('nav', 'nb-rail nb-sklo');
  lista.id = 'nbRail'; lista.setAttribute('aria-label', 'Menu mapy');
  // logo v menu = kostka izomapy (favicon autora). Značku města (web/logo-hodonin.svg, 2026-11-17) Pavel 2026-11-18 vrátil
  // zpět na kostku; soubor zůstává pro případ, že by město souhlasilo.
  lista.innerHTML = `<span class="nb-logo" aria-hidden="true"><img src="favicon.svg" alt=""></span>`
    + KLICE.map((k) => `<button type="button" data-tab="${k}" aria-controls="panel" aria-pressed="false">${IK[k]}<span>${NAZVY[k]}</span></button>`).join('')
    + `<button type="button" class="nb-vice" id="nbVice" title="Nápověda a o projektu">${IK.napoveda}<span>Více</span></button>`;
  panel.before(lista);
  panel.classList.add('nb-sklo');
  const tab = (k) => lista.querySelector(`[data-tab="${k}"]`);

  // ---------- ovládání mapy a karta: ikony místo znaků ----------
  for (const [id, ik] of [['zin', 'plus'], ['zout', 'minus'], ['home', 'domu'], ['share', 'sdilet'], ['cardShare', 'sdilet'], ['cardClose', 'zavrit']]) if ($(id)) $(id).innerHTML = IK[ik];
  for (const s of ['.controls', '#card', '#follow', '#toast', '#helpDlg', '#plochaDlg']) document.querySelector(s)?.classList.add('nb-sklo');

  // ---------- otevírání a zavírání ----------
  const KLIC = 'nase-panel';
  let otevrena = null, posledni = 'vzhled';
  function otevri(k, ulozit = true) {
    if (!sek[k] || tab(k).hidden) k = 'hledat';
    otevrena = posledni = k;
    body.classList.remove('nb-zavreno');
    for (const x of KLICE) { sek[x].hidden = x !== k; const b = tab(x); b.classList.toggle('on', x === k); b.setAttribute('aria-pressed', String(x === k)); }
    if (mobil.matches && !$('card').hidden) $('cardClose').click();     // na telefonu sekce i karta zabírají stejné místo nad lištou
    if (ulozit) uloz(KLIC, k);
    if (k === 'hledat') requestAnimationFrame(() => $('q').focus({ preventScroll: true }));
    kamHlidej();
  }
  function zavri(ulozit = true) {
    otevrena = null;
    body.classList.add('nb-zavreno');
    for (const x of KLICE) { const b = tab(x); b.classList.remove('on'); b.setAttribute('aria-pressed', 'false'); }
    if (ulozit) uloz(KLIC, '0');
    kamHlidej();
  }
  lista.addEventListener('click', (e) => {
    const b = e.target.closest('[data-tab]');
    if (b) { b.dataset.tab === otevrena ? zavri() : otevri(b.dataset.tab); return; }
    if (e.target.closest('#nbVice')) { e.stopPropagation(); dlg?.showModal(); }
  });
  zavritBtn.addEventListener('click', () => zavri());
  // zavřený panel na počítači = jen štítek s nadpisem; klik na něj panel zase otevře
  head.addEventListener('click', (e) => { if (otevrena || mobil.matches || e.target.closest('button')) return; otevri(posledni); });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || !otevrena || document.querySelector('dialog[open]')) return;
    if (!$('card').hidden) return;                                      // první Esc zavře kartu (app.html), až další panel
    if (e.target === $('q') && $('q').value) return;                    // Esc v hledání nejdřív smaže dotaz
    zavri();
  });

  // autorův kód na telefonu zavírá menu (třída .closed na panelu) po výběru místa nebo výsledku hledání
  new MutationObserver(() => { if (mobil.matches && panel.classList.contains('closed') && otevrena) zavri(false); })
    .observe(panel, { attributes: true, attributeFilter: ['class'] });
  // otevřená karta na telefonu zavře sekci (obě jsou nad spodní lištou)
  new MutationObserver(() => { if (mobil.matches && !$('card').hidden && otevrena) zavri(false); })
    .observe($('card'), { attributes: true, attributeFilter: ['hidden'] });

  // sekce bez obsahu: Místa bez mista.json, Dnes bez zpráv a výluk → ikona v liště zmizí
  const sync = () => {
    tab('mista').hidden = !!mista?.hidden;
    tab('kamery').hidden = !KAMERY.length;
    const dnesNic = (!dnesBox || dnesBox.hidden) && (!vylBox || vylBox.hidden);
    sek.dnes.classList.toggle('prazdna', dnesNic);
    tab('dnes').hidden = dnesNic && !body.dataset.nbDnes;
    if (!dnesNic) body.dataset.nbDnes = '1';                            // jednou ukázaná sekce Dnes zůstane (zprávy se obnovují)
    if (otevrena && tab(otevrena).hidden) otevri('hledat', false);
  };
  for (const d of [mista, dnesBox, vylBox]) if (d) new MutationObserver(sync).observe(d, { attributes: true, attributeFilter: ['hidden'] });
  // počet míst u nadpisu sekce, jako u přepínačů vrstev
  const mistaN = el('span', 'lay-n'); mista?.querySelector('summary')?.append(mistaN);
  const pocet = () => { const n = $('places')?.children.length || 0; mistaN.textContent = n ? ` (${n})` : ''; };
  if ($('places')) new MutationObserver(pocet).observe($('places'), { childList: true });

  // ---------- hlavička na telefonu zvlášť nahoře, na počítači v panelu ----------
  // oblasti stránky pro čtečky (axe „region“, 2026-11-18): mapa = hlavní obsah, panel = ovládání; hlavička mimo panel
  // (telefon) = záhlaví stránky – banner smí být jen nahoře v body, ne uvnitř panelu
  $('map')?.setAttribute('role', 'main');
  panel.setAttribute('aria-label', 'Ovládání mapy');
  function rozlozeni() {
    if (mobil.matches) { if (head.parentElement === panel) { body.append(head); head.classList.add('nb-sklo', 'nb-hlava-mobil'); } }
    else if (head.parentElement !== panel) { panel.prepend(head); head.classList.remove('nb-sklo', 'nb-hlava-mobil'); }
    if (head.parentElement === panel) head.removeAttribute('role'); else head.setAttribute('role', 'banner');
  }
  // (lišta „Dnes“ nahoře zrušena 2026-11-16, Pavel: zprávy jsou v sekci Dnes – i s výpočtem volné plochy pro ni)
  mobil.addEventListener('change', () => { rozlozeni(); if (mobil.matches) zavri(false); });

  // ---------- start: na počítači vždy otevřený Vzhled (Pavel 2026-11-16), na telefonu zavřeno (panel by zakryl mapu) ----------
  sync(); pocet(); rozlozeni();
  if (mobil.matches) zavri(false); else otevri('vzhled', false);
})();
