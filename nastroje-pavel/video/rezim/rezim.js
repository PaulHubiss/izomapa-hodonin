// Režim ?video (napady/VIDEO.md, fáze 2): karta „Video“ v menu mapy (stejné prvky jako Vzhled), rámečky formátů přes mapu,
// bezpečné zóny, záběry s body kamery, přehrání, uložení předvolby a render přes náhledový server (video.mjs).
// Jen z náhledového serveru (nahled_server.py ho vloží do stránky na http://localhost:8000/?video), do site/ se nedostane.
// Mapa se ovládá normálně; období, počasí a setmění záběru se rovnou promítají do mapy (co vidíš, to vznikne).
(() => {
  const FORMATY = { '1:1': [1, 1], '4:5': [4, 5], '9:16': [9, 16], '16:9': [16, 9] };
  const OSTRE = [0.1, 0.2, 0.4, 0.8, 1.6, 3.2];                         // m na px výstupu, ostré při zvětšení 1 (video.mjs)
  const ROZLISENI = [720, 1080, 1440, 2160], FPS = [24, 25, 30, 50, 60];
  const SEZ = { spring: 'jaro', summer: 'leto', autumn: 'podzim', winter: 'zima' }, SEZ_EN = Object.fromEntries(Object.entries(SEZ).map(([a, b]) => [b, a]));
  const SEZ_TXT = { jaro: 'Jaro', leto: 'Léto', podzim: 'Podzim', zima: 'Zima' };
  const POCASI = { clear: 'Jasno', rain: 'Déšť', snow: 'Sníh', fog: 'Mlha' };
  const CAS_OBDOBI = { jaro: '2026-04-22T10:30', leto: '2026-07-15T10:30', podzim: '2026-10-08T10:30', zima: '2026-01-14T12:00' };
  const UM = 0.2;                                                       // m na pixel souřadnic prohlížeče
  const TIP = {                                                          // nápověda k prvkům (otazníček u nadpisu)
    predvolba: 'Předvolba = uložené nastavení videa nebo fotek pod jménem (soubor nastroje-pavel/video/predvolby/<jméno>.json). Načti existující, nebo začni novou.',
    jmeno: 'Jméno souboru předvolby a složky s výsledky (videa/<jméno>/). Jen malá písmena bez diakritiky, číslice a pomlčky. Když ho necháš prázdné, vznikne z názvu.',
    nazev: 'Popisek předvolby pro tebe, ve videu se neukazuje.',
    druh: 'Video = pohyb a čas, který běží (auta, MHD, lidé). Fotky = z každého záběru jeden snímek v místě prvního bodu.',
    formaty: 'Které formáty se vyrobí. 1 : 1 a 4 : 5 do feedu Instagramu a Facebooku, 9 : 16 na Reels, Stories, TikTok a Shorts, 16 : 9 na YouTube a promítání.',
    ramecek: 'Který rámeček je na mapě plnou čarou a podle kterého se mapa přibližuje. Ostatní zaškrtnuté formáty jsou čárkovaně: vidíš, co z nich zbude.',
    rozliseni: 'Kratší strana výsledku v pixelech. 1080 je standard sítí. 1440 a 2160 jsou ostřejší (YouTube), ale render trvá úměrně déle a soubory jsou větší.',
    fps: 'Snímků za sekundu. 30 je standard sítí, 25 evropská televize, 24 filmový dojem, 50 a 60 plynulejší pohyb, ale dvojnásobný render.',
    pixely: 'Jemné = každý pixel mapy jako jeden pixel videa. Hrubé = pixely 2 × 2, retro vzhled; barvy se na hranách nerozpijí ani po kompresi sítě.',
    titulek: 'Tmavý štítek s názvem mapy vlevo dole, nad bezpečnou zónou formátu. Vypni, když chceš čistý obraz bez textu a grafiky.',
    priblizeni: 'Kolik metrů mapy připadá na jeden pixel výsledku. Jen ostré hodnoty: přesně jedno patro dlaždic, nic se nerozmaže. Kolečko myši mezi nimi skáče.',
    zabery: 'Video se skládá ze záběrů. Každý má vlastní roční období, počasí a čas ve městě; mezi záběry je střih nebo prolnutí.',
    obdobi: 'Roční období záběru. Hned se přepne i na mapě, ať vidíš, co vznikne.',
    pocasi: 'Počasí záběru (déšť a sníh padají, mlha). Hned se přepne i na mapě.',
    setmeni: 'Denní doba na mapě od dne po noc. Nový bod kamery si ji vezme; ve videu se mezi body plynule mění (setmění, rozsvícení).',
    cas: 'Datum a čas ve městě během záběru: podle něj jezdí MHD podle jízdních řádů, auta a chodí lidé.',
    delka: 'Jak dlouho záběr trvá. Jeden bod kamery = kamera stojí a čas ve městě běží. S více body jede kamera z bodu do bodu.',
    prechod: 'Jak tenhle záběr naváže na předchozí: střih, nebo prolnutí (obraz přejde plynule, délka v sekundách).',
    body: 'Klíčové body kamery: v čase t je střed rámečku tady a s tímhle přiblížením a setměním. Mezi body jede kamera plynule (rozjezd a dojezd).',
    vyroba: 'Uložit zapíše předvolbu. Vyrobit ji uloží a spustí render (video.mjs) na tomhle Macu; výsledek je ve videa/<jméno>/ na Google Disku.',
    zkouska: 'Zkušebně = jen pětina snímků, video je zrychlené. Na rychlou kontrolu záběrů; ostrý render pak bez zaškrtnutí.',
  };
  const el = (tag, at = {}, ...deti) => { const e = document.createElement(tag); for (const [k, v] of Object.entries(at)) { if (v == null) continue; if (k === 'on') for (const [ev, f] of Object.entries(v)) e.addEventListener(ev, f); else if (k === 'style') Object.assign(e.style, v); else if (k in e && k !== 'list') e[k] = v; else e.setAttribute(k, v); } e.append(...deti.flat().filter((d) => d != null && d !== false)); return e; };
  const cislo = (x, d = 1) => String(+(+x).toFixed(d)).replace('.', ',');
  const slug = (t) => (t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);

  let Z, zony = {}, predvolby = {}, beh = null, behTimer = null, otevreno = false;
  const prazdna = () => ({ nazev: '', druh: 'video', formaty: ['9:16', '1:1'], kratsi_strana: 1080, fps: 30, zvetseni: 1, zabery: [] });
  const P = { jmeno: '', data: prazdna() };
  let hlavni = '9:16', mNaPx = 0.4, ramM = null, akt = 0, hraje = null, zkusebne = true, geomPosl = null;

  // ── geometrie: rámeček uprostřed volné plochy vedle panelu ───────────────────────────────────────────────────────────
  const vp = () => Z.viewer.viewport;
  const mNaPxObrazovky = () => vp().getBounds(true).width * Z.W * UM / vp().getContainerSize().x;
  function rozmer(f) { const [a, b] = FORMATY[f], s = P.data.kratsi_strana || 1080; return a <= b ? [s, Math.round(s * b / a)] : [Math.round(s * a / b), s]; }
  function geometrie() {
    const cs = vp().getContainerSize(), panel = document.querySelector('#panel'), rail = document.querySelector('#nbRail');
    const zavreno = document.body.classList.contains('nb-zavreno');
    const vlevo = Math.max(rail?.getBoundingClientRect().right || 0, !zavreno && panel ? panel.getBoundingClientRect().right : 0) + 16;
    const vpravo = cs.x - 16, nahore = 40, dole = cs.y - 40;                // 40: štítky nad a pod rámečkem
    const [w, h] = rozmer(hlavni);
    return { cx: (vlevo + vpravo) / 2, cy: (nahore + dole) / 2, f: Math.min((vpravo - vlevo) * 0.9 / w, (dole - nahore) * 0.94 / h) };
  }
  function img2ll(ix, iy) {                                              // inverze ll2img Newtonem (mapa ji navenek nenabízí)
    const h = (location.hash.split('@')[1] || '').split(',').map(Number);
    let lat = Number.isFinite(h[0]) ? h[0] : 48.857, lon = Number.isFinite(h[1]) ? h[1] : 17.124;
    for (let k = 0; k < 25; k++) {
      const e = 1e-5, [x, y] = Z.ll2img(lat, lon), [x1, y1] = Z.ll2img(lat + e, lon), [x2, y2] = Z.ll2img(lat, lon + e);
      const a = (x1 - x) / e, b = (x2 - x) / e, c = (y1 - y) / e, d = (y2 - y) / e, det = a * d - b * c, dx = ix - x, dy = iy - y;
      const dl = (d * dx - b * dy) / det, dn = (-c * dx + a * dy) / det; lat += dl; lon += dn;
      if (Math.abs(dl) + Math.abs(dn) < 1e-10) break;
    }
    return [+lat.toFixed(6), +lon.toFixed(6)];
  }
  const llNa = (cx, cy) => { const q = vp().pointFromPixel(new OpenSeadragon.Point(cx, cy), true); return img2ll(q.x * Z.W, q.y * Z.W); };
  const stredLL = () => { const g = geometrie(); return llNa(g.cx, g.cy); };       // střed rámečku = bod kamery
  // kamera: bod ll do středu rámečku, měřítko obrazovky m / f (f = px obrazovky na px výstupu)
  function kamera(ll, m, f, g = geometrie()) {
    const cs = vp().getContainerSize(), [ix, iy] = Z.ll2img(ll[0], ll[1]);
    vp().zoomTo(Z.W * UM / (m / f * cs.x), null, true);
    const d = vp().deltaPointsFromPixels(new OpenSeadragon.Point(g.cx - cs.x / 2, g.cy - cs.y / 2), true);
    vp().panTo(new OpenSeadragon.Point(ix / Z.W - d.x, iy / Z.W - d.y), true);
  }
  // přiblížení na nejbližší ostrou hodnotu pro rámeček v plné velikosti; vzdy = i beze změny hodnoty (start, okno, panel)
  function prichyt(vzdy = false, ll = null) {
    const g = geometrie(), m = mNaPxObrazovky() * g.f;
    const ostra = OSTRE.reduce((a, b) => (Math.abs(Math.log(b / m)) < Math.abs(Math.log(a / m)) ? b : a));
    if (!vzdy && Math.abs(m / ostra - 1) < 0.002) return;
    const zmena = ostra !== mNaPx; mNaPx = ostra;
    kamera(ll || llNa(g.cx, g.cy), mNaPx, g.f, g); geomPosl = g;
    if (zmena) vykresli(); else kresliRamy();
  }
  const nastavNoc = (n) => { const e = document.querySelector('#night'), h = Math.round(n * 100); if (e && +e.value !== h) { e.value = h; e.dispatchEvent(new Event('input')); } };
  const vzhledZaberu = (z) => { if (!z) return; if (SEZ_EN[z.obdobi] && Z.state.season !== SEZ_EN[z.obdobi]) Z.setSeason(SEZ_EN[z.obdobi]); if (z.pocasi && Z.state.weather !== z.pocasi) Z.setWeather(z.pocasi); };

  // ── rámečky přes mapu ───────────────────────────────────────────────────────────────────────────────────────────────────
  const vrstva = el('div', { id: 'vr-ramy' });
  function kresliRamy() {
    if (!Z) return;
    vrstva.replaceChildren(); vrstva.hidden = !otevreno;
    if (!otevreno) return;
    const g = geometrie(), m = ramM || mNaPx, f = m / mNaPxObrazovky();
    for (const fm of [hlavni, ...P.data.formaty.filter((x) => x !== hlavni)]) {       // hlavní první: jeho ztmavení nepřekryje ostatní
      const [w, h] = rozmer(fm), W = w * f, H = h * f, je = fm === hlavni;
      const r = el('div', { className: 'vr-ram' + (je ? ' vr-hlavni' : ''), style: { left: `${g.cx - W / 2}px`, top: `${g.cy - H / 2}px`, width: `${W}px`, height: `${H}px` } },
        el('span', { className: 'vr-stitek', textContent: `${fm.replace(':', ' : ')}${je ? ` · ${Math.round(w * m)} × ${Math.round(h * m)} m` : ''}` }));
      const zn = zony[fm];
      if (je && zn) for (const [k, v] of Object.entries(zn)) if (v > 0) r.append(el('div', { className: 'vr-zona', style:
        k === 'nahore' ? { top: 0, left: 0, right: 0, height: `${v * 100}%` } : k === 'dole' ? { bottom: 0, left: 0, right: 0, height: `${v * 100}%` }
          : k === 'vpravo' ? { top: 0, bottom: 0, right: 0, width: `${v * 100}%` } : { top: 0, bottom: 0, left: 0, width: `${v * 100}%` } }));
      vrstva.append(r);
    }
    vrstva.append(el('div', { className: 'vr-kriz', style: { left: `${g.cx}px`, top: `${g.cy}px` } }));
  }

  // ── záběry a body ──────────────────────────────────────────────────────────────────────────────────────────────────────
  const zaber = () => P.data.zabery[akt];
  const delkaZ = (z) => Math.max(z.body.at(-1)?.t || 0, +z.delka || 0);
  const nocMapy = () => +(+Z.state.night || 0).toFixed(2);
  function casSOffsetem(lokalni) {                                        // ISO čas s posunem pražského času (letní/zimní)
    const d = new Date(lokalni), o = -d.getTimezoneOffset(), z = o >= 0 ? '+' : '-', a = Math.abs(o);
    return `${lokalni.length === 16 ? lokalni + ':00' : lokalni}${z}${String(Math.floor(a / 60)).padStart(2, '0')}:${String(a % 60).padStart(2, '0')}`;
  }
  const lokalniCas = (iso) => (iso || '').slice(0, 16);
  function novyZaber() {
    const ob = SEZ[Z.state.season] || 'leto', pred = P.data.zabery.length;
    P.data.zabery.push({ obdobi: ob, cas: casSOffsetem(CAS_OBDOBI[ob]), pocasi: Z.state.weather || 'clear', delka: 6,
      ...(pred ? { prechod: { druh: 'prolnuti', delka: 1 } } : {}), body: [{ t: 0, ll: stredLL(), m_na_px: mNaPx, noc: nocMapy() }] });
    akt = P.data.zabery.length - 1; vykresli();
  }
  function pridejBod() {
    const z = zaber(); if (!z) return novyZaber();
    z.body.push({ t: +((z.body.at(-1)?.t || 0) + 4).toFixed(1), ll: stredLL(), m_na_px: mNaPx, noc: nocMapy() }); vykresli();
  }
  function ukazBod(b) {
    vzhledZaberu(zaber()); mNaPx = b.m_na_px; ramM = null;
    const g = geometrie(); kamera(b.ll, b.m_na_px, g.f, g); geomPosl = g; nastavNoc(b.noc ?? 0); vykresli();
  }
  const posun = (i, o) => { const Zs = P.data.zabery, j = i + o; if (j < 0 || j >= Zs.length) return; [Zs[i], Zs[j]] = [Zs[j], Zs[i]]; akt = j; vykresli(); };

  // přehrání: stejná S-křivka a geometrické přiblížení jako video.mjs, v reálném čase, rámeček drží velikost
  const plynule = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
  function stav(body, s) {
    let p = { noc: 0 }; const B = body.map((b) => (p = { ...p, ...b }));
    let k = 0; while (k < B.length - 2 && s > B[k + 1].t) k++;
    const a = B[k], b = B[Math.min(k + 1, B.length - 1)], u = b.t > a.t ? plynule(Math.min(1, Math.max(0, (s - a.t) / (b.t - a.t)))) : 0;
    return { ll: [a.ll[0] + (b.ll[0] - a.ll[0]) * u, a.ll[1] + (b.ll[1] - a.ll[1]) * u], m: Math.exp(Math.log(a.m_na_px) + (Math.log(b.m_na_px) - Math.log(a.m_na_px)) * u), noc: a.noc + (b.noc - a.noc) * u };
  }
  function prehraj(vse) {
    if (hraje) return zastav();
    const seznam = vse ? P.data.zabery.map((_, i) => i) : [akt];
    if (!seznam.length || !P.data.zabery[seznam[0]]?.body.length) return zprava('Není co přehrát: přidej záběr.', true);
    const g = geometrie(); let i = 0, t0 = null;
    const krok = (ts) => {
      const z = P.data.zabery[seznam[i]];
      if (t0 === null) { t0 = ts; vzhledZaberu(z); }
      const s = (ts - t0) / 1000, d = delkaZ(z), k = stav(z.body, Math.min(s, d));
      ramM = k.m; kamera(k.ll, k.m, g.f, g); nastavNoc(k.noc); kresliRamy();
      const zp = document.querySelector('#vr-prehrava'); if (zp) zp.textContent = `▶ záběr ${seznam[i] + 1}: ${cislo(Math.min(s, d))} / ${cislo(d)} s`;
      if (s >= d) { i++; t0 = null; if (i >= seznam.length) return zastav(); }
      hraje = requestAnimationFrame(krok);
    };
    hraje = requestAnimationFrame(krok); vykresli();
  }
  function zastav() { if (hraje) cancelAnimationFrame(hraje); hraje = null; ramM = null; vykresli(); }

  // ── uložení a výroba ───────────────────────────────────────────────────────────────────────────────────────────────────
  let hlaska = ['', false];
  const zprava = (t, chyba = false) => { hlaska = [t, chyba]; const z = document.querySelector('#vr-zprava'); if (z) { z.textContent = t; z.classList.toggle('vr-chyba', chyba); z.hidden = !t; } };
  const dataKUlozeni = () => ({ ...P.data, zabery: P.data.zabery.map((z, i) => { const { prechod, ...r } = z; return i ? { ...r, prechod: prechod || { druh: 'strih' } } : r; }) });
  async function uloz() {
    if (!P.jmeno) P.jmeno = slug(P.data.nazev);
    if (!P.jmeno) { zprava('Vyplň název nebo jméno souboru.', true); return false; }
    if (!P.data.zabery.length) { zprava('Předvolba nemá žádný záběr.', true); return false; }
    try {
      const data = dataKUlozeni();
      const r = await fetch('/_video/predvolba', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jmeno: P.jmeno, data }) });
      const o = await r.json();
      if (!r.ok) { zprava(o.chyba || 'Uložení selhalo.', true); return false; }
      predvolby[P.jmeno] = data; zprava(`Uloženo: ${o.soubor}`); vykresli(); return true;
    } catch { zprava('Server neodpovídá (běží nahled_server.py?).', true); return false; }
  }
  async function vyrob() {
    beh = null; kresliBeh();                                             // starý výsledek pryč, ať se neplete s novým
    if (!(await uloz())) return;
    const r = await fetch('/_video/vyrob', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jmeno: P.jmeno, zkouska: zkusebne }) });
    const o = await r.json();
    if (!r.ok) return zprava(o.chyba || 'Render se nespustil.', true);
    zprava(''); beh = o; kresliBeh(); hlidejBeh();
  }
  async function zrus() { const r = await fetch('/_video/zrus', { method: 'POST' }); beh = await r.json(); kresliBeh(); }
  function hlidejBeh() {
    clearTimeout(behTimer);
    behTimer = setTimeout(async () => {
      try { beh = await (await fetch('/_video/beh')).json(); } catch { return hlidejBeh(); }
      kresliBeh(); if (beh.bezi) hlidejBeh();
    }, 1000);
  }
  const finder = (soubor) => fetch('/_video/finder', { method: 'POST', body: JSON.stringify({ soubor }) });
  function kresliBeh() {
    const box = document.querySelector('#vr-beh'); if (!box) return;
    // dokončený render ukázat jen u své předvolby; běžící vždy (jen jeden naráz, ať je vidět, proč Vyrobit nejde)
    if (!beh || (!beh.bezi && (beh.jmeno !== P.jmeno || (beh.kod === null && !beh.vystupy?.length)))) { box.replaceChildren(); return; }
    const pct = beh.celkem ? Math.round(100 * beh.hotovo / beh.celkem) : 0, uplynulo = Math.round(Date.now() / 1000 - beh.start);
    const mm = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    const zbyva = beh.bezi && beh.hotovo > 5 ? ` · zbývá ~${mm(Math.round(uplynulo * (beh.celkem - beh.hotovo) / beh.hotovo))}` : '';
    const stavT = beh.bezi ? `Vyrábím ${beh.jmeno}: ${beh.hotovo} / ${beh.celkem || '?'} snímků · ${mm(uplynulo)}${zbyva}`
      : beh.kod === 0 ? `Hotovo: ${beh.jmeno}` : `Render skončil chybou (kód ${beh.kod})`;
    const soubory = (beh.vystupy || []).map((s) => ({ s, url: `/_video/vystup/${s.split('/').slice(1).map(encodeURIComponent).join('/')}`, jm: s.split('/').pop() }));
    const video = soubory.find((x) => x.jm.endsWith('.mp4')), obr = soubory.find((x) => /^kontrola/.test(x.jm)) || soubory.find((x) => x.jm.endsWith('.png'));
    box.replaceChildren(
      el('p', { className: 'vr-beh-stav' + (beh.kod && !beh.bezi ? ' vr-chyba' : ''), textContent: stavT }),
      beh.bezi ? el('div', { className: 'vr-pruh' }, el('i', { style: { width: `${pct}%` } })) : null,
      beh.bezi ? el('button', { type: 'button', className: 'px-btn', textContent: 'Zrušit render', on: { click: zrus } }) : null,
      !beh.bezi && video ? el('video', { className: 'vr-nahled', src: video.url, controls: true, muted: true, loop: true, playsInline: true, preload: 'metadata' }) : null,
      !beh.bezi && !video && obr ? el('img', { className: 'vr-nahled', src: obr.url, alt: 'Kontrolní mřížka' }) : null,
      soubory.length ? el('ul', { className: 'vr-soubory' }, ...soubory.map((x) => el('li', {},
        el('a', { href: x.url, target: '_blank', rel: 'noopener', textContent: x.jm }),
        el('button', { type: 'button', className: 'px-btn vr-mini', textContent: 'Finder', title: 'Ukázat ve Finderu', on: { click: () => finder(x.s) } })))) : null,
      beh.kod && !beh.bezi ? el('details', { className: 'vr-log' }, el('summary', { textContent: 'Výpis renderu' }), el('pre', { textContent: beh.radky.join('\n') })) : null);
  }
  function nacti(jmeno) {
    const d = predvolby[jmeno]; if (!d) return;
    P.jmeno = jmeno; P.data = structuredClone({ ...prazdna(), ...d });
    hlavni = P.data.formaty.includes(hlavni) ? hlavni : P.data.formaty[0]; akt = 0; zprava(`Načteno: ${jmeno}`);
    const b = P.data.zabery[0]?.body[0]; if (b) ukazBod(b); else vykresli();
  }

  // ── stavebnice prvků ve stylu menu mapy (nase.css: .label, .px-btn, .chips4, .realtime, .nb-pole) ──────────────────────
  const tipIk = (k) => TIP[k] ? el('span', { className: 'vr-i', tabIndex: 0, role: 'button', 'aria-label': 'Nápověda', 'data-tip': TIP[k], textContent: '?' }) : null;
  const nadpis = (text, tip) => el('p', { className: 'label vr-nadpis' }, text, tipIk(tip));
  const sekce = (text, tip, ...obsah) => el('div', { className: 'vr-sek' }, nadpis(text, tip), ...obsah);
  // segmentový ovladač: moznosti [[hodnota, text]], je(hodnota) → vybraná, klik(hodnota)
  const segment = (moznosti, je, klik, cls = '') => el('div', { className: 'chips4 vr-seg ' + cls, style: { gridTemplateColumns: `repeat(${moznosti.length}, minmax(0, 1fr))` } },
    ...moznosti.map(([v, t]) => el('button', { type: 'button', className: 'px-btn', textContent: t, 'aria-pressed': String(je(v)), on: { click: () => klik(v) } })));
  const pole = (popis, vstup, tip) => el('label', { className: 'nb-pole vr-pole' }, el('span', { className: 'vr-pole-n' }, popis, tipIk(tip)), vstup);
  const vstup = (at) => el('input', at);
  const tl = (text, akce, cls = '', at = {}) => el('button', { type: 'button', className: 'px-btn ' + cls, textContent: text, on: { click: akce }, ...at });
  const prepinac = (text, zap, zmena, tip) => el('label', { className: 'realtime vr-prepinac' }, el('input', { type: 'checkbox', checked: zap, on: { change: (e) => zmena(e.target.checked) } }), el('span', {}, text, tipIk(tip)));

  // ── karta Video ────────────────────────────────────────────────────────────────────────────────────────────────────────
  const karta = el('div', { className: 'nb-pane vr-karta', id: 'nb-video', hidden: true });
  // překreslení během překreslení (opuštěné pole pošle „change“, když ho replaceChildren odebírá) → jen naplánovat znovu
  let kreslim = false, znovu = false;
  function vykresli() {
    if (!Z) return;
    if (kreslim) { znovu = true; return; }
    kreslim = true;
    try { vykresliTed(); } finally { kreslim = false; if (znovu) { znovu = false; queueMicrotask(vykresli); } }
  }
  function vykresliTed() {
    const d = P.data, z = zaber(), kom = `node nastroje-pavel/video.mjs ${P.jmeno || slug(d.nazev) || '<jméno>'}${zkusebne ? ' --zkouska' : ''}`;
    const celkem = d.zabery.reduce((s, x, i) => s + delkaZ(x) - (i && x.prechod?.druh === 'prolnuti' ? +x.prechod.delka || 0 : 0), 0);
    const [w0] = rozmer(hlavni);
    const scroll = document.querySelector('#panel')?.scrollTop;
    karta.replaceChildren(
      sekce('Předvolba', 'predvolba',
        el('div', { className: 'vr-radek' },
          el('label', { className: 'nb-pole vr-pole vr-roste' }, el('select', { 'aria-label': 'Načíst předvolbu', on: { change: (e) => nacti(e.target.value) } },
            el('option', { value: '', textContent: P.jmeno ? `${P.jmeno} (rozpracovaná)` : '— načíst uloženou —' }),
            ...Object.entries(predvolby).filter(([k]) => k !== P.jmeno).map(([k, v]) => el('option', { value: k, textContent: v.nazev ? `${v.nazev} (${k})` : k })))),
          tl('Nová', () => { P.jmeno = ''; P.data = prazdna(); akt = 0; zprava(''); vykresli(); }),
          tl('Kopie', () => { P.jmeno = P.jmeno ? `${P.jmeno}-kopie`.slice(0, 40) : ''; P.data = structuredClone(P.data); d.nazev && (P.data.nazev = `${d.nazev} (kopie)`); zprava('Kopie: uprav a ulož pod novým jménem.'); vykresli(); }, '', { title: 'Kopie předvolby pod novým jménem' })),
        el('div', { className: 'vr-radek2' },
          pole('Název', vstup({ value: d.nazev || '', placeholder: 'Jarmark na Reels', on: { input: (e) => { d.nazev = e.target.value; } } }), 'nazev'),
          pole('Jméno souboru', vstup({ value: P.jmeno, placeholder: slug(d.nazev) || 'jarmark-reels', on: { input: (e) => { P.jmeno = e.target.value.trim(); } } }), 'jmeno'))),
      sekce('Výstup', 'druh',
        segment([['video', 'Video'], ['foto', 'Fotky']], (v) => d.druh === v, (v) => { d.druh = v; vykresli(); }),
        el('div', { className: 'vr-pod' }, el('span', { className: 'vr-pole-n' }, 'Formáty', tipIk('formaty')),
          segment(Object.keys(FORMATY).map((f) => [f, f.replace(':', ' : ')]), (v) => d.formaty.includes(v), (v) => {
            const ma = d.formaty.includes(v); if (ma && d.formaty.length === 1) return;
            d.formaty = Object.keys(FORMATY).filter((x) => (x === v ? !ma : d.formaty.includes(x)));
            if (!d.formaty.includes(hlavni)) { hlavni = d.formaty[0]; prichyt(true); } vykresli(); })),
        d.formaty.length > 1 ? el('div', { className: 'vr-pod' }, el('span', { className: 'vr-pole-n' }, 'Rámeček na mapě', tipIk('ramecek')),
          segment(d.formaty.map((f) => [f, f.replace(':', ' : ')]), (v) => v === hlavni, (v) => { hlavni = v; prichyt(true); vykresli(); })) : null,
        el('div', { className: 'vr-pod' }, el('span', { className: 'vr-pole-n' }, 'Rozlišení (kratší strana)', tipIk('rozliseni')),
          segment(ROZLISENI.map((r) => [r, String(r)]), (v) => d.kratsi_strana === v, (v) => { d.kratsi_strana = v; vykresli(); })),
        d.druh === 'video' ? el('div', { className: 'vr-pod' }, el('span', { className: 'vr-pole-n' }, 'Snímků za sekundu', tipIk('fps')),
          segment(FPS.map((f) => [f, String(f)]), (v) => d.fps === v, (v) => { d.fps = v; vykresli(); })) : null,
        el('div', { className: 'vr-pod' }, el('span', { className: 'vr-pole-n' }, 'Pixely', tipIk('pixely')),
          segment([[1, 'Jemné'], [2, 'Hrubé 2 × 2']], (v) => (d.zvetseni || 1) === v, (v) => { d.zvetseni = v; vykresli(); })),
        prepinac('Titulek ve videu', d.titulek !== false, (v) => { if (v) delete d.titulek; else d.titulek = false; vykresli(); }, 'titulek'),
        d.titulek !== false ? el('div', { className: 'vr-radek2' },
          pole('Nadpis', vstup({ value: d.titulek?.nadpis || '', placeholder: 'Izometrický Hodonín', on: { input: (e) => { d.titulek = { ...(d.titulek || {}), nadpis: e.target.value || undefined }; } } })),
          pole('Podpis', vstup({ value: d.titulek?.podnadpis || '', placeholder: 'Mapa z otevřených dat · …', on: { input: (e) => { d.titulek = { ...(d.titulek || {}), podnadpis: e.target.value || undefined }; } } }))) : null),
      sekce('Přiblížení', 'priblizeni',
        segment(OSTRE.map((m) => [m, cislo(m)]), (v) => v === mNaPx, (v) => { mNaPx = v; const g = geometrie(); kamera(stredLL(), mNaPx, g.f, g); geomPosl = g; vykresli(); }),
        el('p', { className: 'vr-pozn' }, `m na pixel · rámeček ${hlavni.replace(':', ' : ')} = ${Math.round(w0 * mNaPx)} m na šířku`)),
      sekce('Záběry', 'zabery',
        ...d.zabery.map((zz, i) => {
          const je = i === akt;
          return el('div', { className: 'vr-zaber' + (je ? ' vr-akt' : '') },
            el('div', { className: 'vr-zaber-hlava', on: { click: (e) => { if (!je && !e.target.closest('button')) { akt = i; vzhledZaberu(zz); const b = zz.body[0]; if (b) ukazBod(b); else vykresli(); } } } },
              el('b', { textContent: `${i + 1}. ${SEZ_TXT[zz.obdobi] || zz.obdobi} · ${lokalniCas(zz.cas).slice(11) || '?'} · ${POCASI[zz.pocasi] || ''}` }),
              el('small', { textContent: `${zz.body.length < 2 ? 'stojí' : `${zz.body.length} body`} · ${cislo(delkaZ(zz))} s` }),
              // úpravy jen u vybraného záběru, ať se nadpisy ostatních vejdou celé
              je && d.zabery.length > 1 ? tl('↑', () => posun(i, -1), 'vr-mini', { title: 'Posunout dřív', disabled: !i }) : null,
              je && d.zabery.length > 1 ? tl('↓', () => posun(i, 1), 'vr-mini', { title: 'Posunout později', disabled: i === d.zabery.length - 1 }) : null,
              je ? tl('⧉', () => { d.zabery.splice(i + 1, 0, { ...structuredClone(zz), prechod: { druh: 'prolnuti', delka: 1 } }); akt = i + 1; vykresli(); }, 'vr-mini', { title: 'Zkopírovat záběr' }) : null,
              je ? tl('✕', () => { d.zabery.splice(i, 1); akt = Math.max(0, Math.min(akt, d.zabery.length - 1)); vykresli(); }, 'vr-mini', { title: 'Smazat záběr' }) : null),
            !je ? null : el('div', { className: 'vr-zaber-telo' },
              el('div', { className: 'vr-pod' }, el('span', { className: 'vr-pole-n' }, 'Roční období', tipIk('obdobi')),
                segment(Object.entries(SEZ_TXT), (v) => zz.obdobi === v, (v) => { zz.obdobi = v; if (SEZ_EN[v]) Z.setSeason(SEZ_EN[v]); vykresli(); })),
              el('div', { className: 'vr-pod' }, el('span', { className: 'vr-pole-n' }, 'Počasí', tipIk('pocasi')),
                segment(Object.entries(POCASI), (v) => zz.pocasi === v, (v) => { zz.pocasi = v; Z.setWeather(v); vykresli(); })),
              el('div', { className: 'vr-pod daynight' }, el('span', { className: 'vr-pole-n' }, 'Denní doba na mapě', tipIk('setmeni')),
                el('input', { type: 'range', className: 'vr-noc', min: 0, max: 100, value: Math.round(nocMapy() * 100), 'aria-label': 'Denní doba', on: { input: (e) => nastavNoc(+e.target.value / 100) } }),
                el('div', { className: 'ends' }, el('span', { textContent: 'Den' }), el('span', { textContent: 'Noc' }))),
              pole('Datum a čas ve městě', vstup({ type: 'datetime-local', value: lokalniCas(zz.cas), on: { change: (e) => { zz.cas = casSOffsetem(e.target.value); vykresli(); } } }), 'cas'),
              d.druh === 'video' ? el('div', { className: 'vr-radek2 vr-dole' },
                pole('Délka (s)', vstup({ type: 'number', min: 0.5, step: 0.5, value: cislo(delkaZ(zz)).replace(',', '.'), on: { change: (e) => { zz.delka = Math.max(0.5, +e.target.value || 0); vykresli(); } } }), 'delka'),
                el('p', { className: 'vr-pozn' }, zz.body.length < 2 ? 'Kamera stojí, čas ve městě běží.' : `Kamera jede přes ${zz.body.length} body.`)) : null,
              i ? el('div', { className: 'vr-pod' }, el('span', { className: 'vr-pole-n' }, 'Přechod z předchozího', tipIk('prechod')),
                el('div', { className: 'vr-radek' },
                  segment([['strih', 'Střih'], ['prolnuti', 'Prolnutí']], (v) => (zz.prechod?.druh || 'strih') === v, (v) => { zz.prechod = { druh: v, delka: zz.prechod?.delka || 1 }; vykresli(); }, 'vr-roste'),
                  zz.prechod?.druh === 'prolnuti' ? el('label', { className: 'nb-pole vr-pole vr-uzke' }, vstup({ type: 'number', min: 0.2, max: 5, step: 0.1, value: zz.prechod.delka, 'aria-label': 'Délka prolnutí v sekundách', on: { change: (e) => { zz.prechod.delka = Math.max(0.2, +e.target.value || 1); vykresli(); } } })) : null)) : null,
              el('div', { className: 'vr-pod' }, el('span', { className: 'vr-pole-n' }, 'Body kamery', tipIk('body')),
                el('table', { className: 'vr-body' },
                  el('tr', {}, el('th', { textContent: 't (s)' }), el('th', { textContent: 'm/px' }), el('th', { textContent: 'noc' }), el('th')),
                  ...zz.body.map((b, k) => el('tr', {},
                    el('td', {}, k ? vstup({ type: 'number', min: 0.1, step: 0.5, value: b.t, 'aria-label': 'Čas bodu', on: { change: (e) => { b.t = Math.max(0.1, +e.target.value || 0.1); zz.body.sort((x, y) => x.t - y.t); vykresli(); } } }) : el('span', { textContent: '0' })),
                    el('td', {}, el('select', { 'aria-label': 'Přiblížení bodu', on: { change: (e) => { b.m_na_px = +e.target.value; } } }, ...OSTRE.map((m) => el('option', { value: m, textContent: cislo(m), selected: m === b.m_na_px })))),
                    el('td', {}, vstup({ type: 'number', min: 0, max: 1, step: 0.05, value: b.noc ?? 0, 'aria-label': 'Setmění bodu', on: { change: (e) => { b.noc = Math.min(1, Math.max(0, +e.target.value || 0)); } } })),
                    el('td', { className: 'vr-akce' }, tl('👁', () => ukazBod(b), 'vr-mini', { title: 'Ukázat bod na mapě' }),
                      tl('⌖', () => { b.ll = stredLL(); b.m_na_px = mNaPx; b.noc = nocMapy(); vykresli(); }, 'vr-mini', { title: 'Přesunout bod na střed rámečku (s přiblížením a denní dobou z mapy)' }),
                      k ? tl('✕', () => { zz.body.splice(k, 1); vykresli(); }, 'vr-mini', { title: 'Smazat bod' }) : null)))),
                d.druh === 'video' ? tl('+ Bod kamery ze středu rámečku', pridejBod) : el('p', { className: 'vr-pozn' }, 'Fotka bere první bod.'))));
        }),
        tl('+ Nový záběr', novyZaber, '', { title: 'Záběr s obdobím, počasím a denní dobou z mapy, kamera v rámečku' })),
      sekce('Náhled a výroba', 'vyroba',
        d.druh === 'video' ? el('div', { className: 'vr-radek' },
          tl(hraje ? '■ Zastavit' : '▶ Přehrát záběr', () => prehraj(false), 'vr-roste'),
          tl('▶ Celé video', () => prehraj(true), 'vr-roste')) : null,
        hraje ? el('p', { className: 'vr-pozn', id: 'vr-prehrava' }) : null,
        el('p', { className: 'vr-pozn' }, d.druh === 'video'
          ? `Celkem ${cislo(celkem)} s · ${Math.round(celkem * d.fps)} snímků · ${d.formaty.length} ${d.formaty.length === 1 ? 'formát' : d.formaty.length < 5 ? 'formáty' : 'formátů'}`
          : `${d.zabery.length} ${d.zabery.length === 1 ? 'fotka' : d.zabery.length < 5 ? 'fotky' : 'fotek'} × ${d.formaty.length} ${d.formaty.length === 1 ? 'formát' : 'formáty'}`),
        prepinac('Zkušebně (pětina snímků)', zkusebne, (v) => { zkusebne = v; vykresli(); }, 'zkouska'),
        el('div', { className: 'vr-radek' },
          tl('Uložit', uloz, 'vr-roste'),
          tl(beh?.bezi ? 'Vyrábí se…' : '🎬 Vyrobit', vyrob, 'vr-roste vr-hlavni-tl', { disabled: !!beh?.bezi })),
        el('p', { className: 'vr-zprava' + (hlaska[1] ? ' vr-chyba' : ''), id: 'vr-zprava', textContent: hlaska[0], hidden: !hlaska[0] }),
        el('div', { id: 'vr-beh' }),
        el('div', { className: 'vr-prikaz' }, el('code', { textContent: kom, title: kom }),
          tl('Kopírovat', () => navigator.clipboard?.writeText(kom).then(() => zprava('Příkaz zkopírován.')), 'vr-mini', { title: 'Příkaz pro terminál' }))));
    kresliBeh(); kresliRamy();
    if (scroll != null) document.querySelector('#panel').scrollTop = scroll;          // překreslení nesmí panel odscrollovat
  }

  // ── nápověda: jedna plovoucí bublina (panel má overflow, bublina uvnitř by se ořízla) ───────────────────────────────────
  const bublina = el('div', { id: 'vr-tip', role: 'tooltip', hidden: true });
  const ukazTip = (t) => { bublina.textContent = t.dataset.tip; bublina.hidden = false; const r = t.getBoundingClientRect(), b = bublina.getBoundingClientRect();
    bublina.style.left = `${Math.min(innerWidth - b.width - 8, r.right + 10)}px`; bublina.style.top = `${Math.max(8, Math.min(innerHeight - b.height - 8, r.top + r.height / 2 - b.height / 2))}px`; };
  document.addEventListener('mouseover', (e) => { const t = e.target.closest?.('.vr-i'); if (t) ukazTip(t); else if (!e.target.closest?.('#vr-tip')) bublina.hidden = true; });
  document.addEventListener('focusin', (e) => { const t = e.target.closest?.('.vr-i'); if (t) ukazTip(t); else bublina.hidden = true; });
  document.addEventListener('click', (e) => { const t = e.target.closest?.('.vr-i'); if (t) { e.preventDefault(); ukazTip(t); } });

  // ── tlačítko v liště a otevírání karty vedle sekcí nase.js ─────────────────────────────────────────────────────────────
  const IK = '<svg class="nb-ik" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.2 6 3 11l-.9-2.4c-.3-1.1.3-2.2 1.3-2.5l13.5-4c1.1-.3 2.2.3 2.5 1.3Z"/><path d="m6.2 5.3 3.1 3.9"/><path d="m12.4 3.4 3.1 4"/><path d="M3 11h18v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/></svg>';   // Lucide clapperboard
  const tlacitko = el('button', { type: 'button', 'data-vtab': 'video', 'aria-controls': 'panel', 'aria-pressed': 'false', title: 'Video a fotky na sítě' });
  tlacitko.innerHTML = `${IK}<span>Video</span>`;
  function otevriKartu() {
    const rail = document.querySelector('#nbRail');
    const jina = rail?.querySelector('[data-tab].on'); if (jina) jina.click();             // nase.js svou sekci zavře (a ví o tom)
    for (const p of document.querySelectorAll('#panel > .nb-pane')) p.hidden = p !== karta;
    document.body.classList.remove('nb-zavreno'); document.body.classList.add('vr-zapnuto');
    otevreno = true; tlacitko.classList.add('on'); tlacitko.setAttribute('aria-pressed', 'true');
    vykresli(); requestAnimationFrame(() => prichyt(true, geomPosl ? llNa(geomPosl.cx, geomPosl.cy) : null));
  }
  function zavriKartu() {
    if (!otevreno) return;
    otevreno = false; karta.hidden = true; document.body.classList.remove('vr-zapnuto'); tlacitko.classList.remove('on'); tlacitko.setAttribute('aria-pressed', 'false'); kresliRamy();
  }

  // ── start: počkat na mapu ──────────────────────────────────────────────────────────────────────────────────────────────
  async function start() {
    while (!(window.__izo && document.querySelector('#loading')?.hidden && document.querySelector('#nbRail'))) await new Promise((r) => setTimeout(r, 100));
    Z = window.__izo;
    try { [zony, predvolby] = await Promise.all([fetch('/_video/zony.json').then((r) => r.json()), fetch('/_video/predvolby').then((r) => r.json())]); } catch {}
    try { beh = await (await fetch('/_video/beh')).json(); if (beh.bezi) hlidejBeh(); } catch {}
    const rail = document.querySelector('#nbRail');
    rail.insertBefore(tlacitko, rail.querySelector('#nbVice'));
    document.querySelector('#panel').append(karta);
    document.querySelector('#map').append(vrstva); document.body.append(bublina);
    tlacitko.addEventListener('click', () => (otevreno ? (zavriKartu(), document.body.classList.add('nb-zavreno')) : otevriKartu()));
    // jiná sekce nase.js nebo zavření panelu → karta pryč (nase.js o ní neví)
    rail.addEventListener('click', (e) => { if (e.target.closest('[data-tab]')) zavriKartu(); }, true);
    new MutationObserver(() => {
      if (document.body.classList.contains('nb-zavreno')) zavriKartu();
      requestAnimationFrame(() => { if (otevreno && !hraje && geomPosl) prichyt(true, llNa(geomPosl.cx, geomPosl.cy)); });   // panel ubral / přidal místo
    }).observe(document.body, { attributes: true, attributeFilter: ['class'] });
    for (const ev of ['animation', 'update-viewport', 'resize']) Z.viewer.addHandler(ev, () => { if (!hraje) kresliRamy(); });
    // rámeček drží velikost; přiblížení kolečkem se po dojezdu přichytí k nejbližší ostré hodnotě
    Z.viewer.addHandler('animation-finish', () => { if (otevreno && !hraje) { prichyt(); geomPosl = geometrie(); } });
    addEventListener('resize', () => setTimeout(() => { if (otevreno && !hraje && geomPosl) prichyt(true, llNa(geomPosl.cx, geomPosl.cy)); }, 50));
    otevriKartu();
  }
  if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') start();
})();
