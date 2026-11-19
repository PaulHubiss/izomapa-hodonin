(async () => {

  // data mapy: vždy se zeptat serveru, jestli se nezměnila (Safari 2026-11-17 držel starý chodci.json i po obnovení
  // stránky, protože ?v= je verze dlaždic a ta se při změně dat nemění); nezměněný soubor = krátká odpověď 304
  // + razítko sestavení (build_html.py) v adrese: jiné sestavení = jiná adresa; v konzoli a v __izo.sestaveni pro kontrolu,
  // že vidíme stejnou verzi. Soubor změněný bez nového sestavení (chodci.py, mhd.py) pokryje no-cache.
  const NC = { cache: 'no-cache' }, SEST = '{{SESTAVENI}}', DV = `?s=${SEST}`;
  console.info(`izomapa: sestavení ${SEST}`);
  const [TILES, OV] = await Promise.all([fetch('tiles.json' + DV, NC).then((r) => r.json()), fetch('overlay.json' + DV, NC).then((r) => r.json())]);
  const HASICI_CFG = {{HASICI}}, VYLUKY_CFG = {{VYLUKY}};    // mesto.json "hasici", "vyluky" (prostředníci functions/api/hasici.js, vyluky.js)
  const PAMATKY = OV.pamatky || [];                        // kulturní památky (nastroje/pamatky.py), přepínač u ostatních vrstev
  const PODNIKY = OV.podniky || [];                        // restaurace, kavárny, hospody (nastroje/podniky.py), vlastní přepínač
  const PINY = [];                                         // všechna místa s ikonkou v mapě (ikPin), pro zvýraznění vybraného
  const VEREJNA = OV.verejna || [];                        // veřejná místa (nastroje-pavel/verejna_mista.py): skupiny níž, přepínač každé
  // kategorie míst (web/kategorie.js): Příběhy, Památky, Restaurace a kavárny a skupiny veřejných míst; stejné ve Vrstvách,
  // v Místech i v mapě (Pavel 2026-11-16). Bez kategorie.js (autorova šablona) jen prázdný seznam.
  const KAT = Object.fromEntries((window.IZO_KAT || []).map((c) => [c.k, c]));
  const katSvg = (ik) => window.IZO_KAT_SVG(ik);
  for (const p of VEREJNA) if (!KAT[p.skupina]) p.skupina = 'sluzby';   // neznámá skupina ze starších dat
  {
    const st = document.createElement('style');
    st.textContent = Object.keys(KAT).map((k) => `#map.nokat-${k} .kat-${k}{display:none!important}`).join('\n');
    document.head.append(st);
  }
  // otevírací doba, která platí dnes: sezónní rozvrh (sezony [{od: 'MM-DD', do: 'MM-DD', oteviraci}], přes Nový rok i do < od) nebo stálá
  function verOteviraci(p, d = new Date()) {
    if (!p.sezony) return p.oteviraci ? { oh: p.oteviraci } : null;
    const md = `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const s = p.sezony.find((z) => (z.od <= z.do ? md >= z.od && md <= z.do : md >= z.od || md <= z.do));
    return s ? { oh: s.oteviraci, od: s.od, do: s.do } : null;
  }
  const POD_DRUH = { restaurant: 'Restaurace', cafe: 'Kavárna', pub: 'Hospoda', bar: 'Bar', biergarten: 'Pivní zahrádka', fast_food: 'Bistro',
    ice_cream: 'Zmrzlina', confectionery: 'Cukrárna', pastry: 'Cukrárna' };
  const POD_KUCH = { pizza: 'pizza', italian: 'italská', czech: 'česká', regional: 'regionální', burger: 'burgery', chinese: 'čínská', asian: 'asijská',
    indian: 'indická', vietnamese: 'vietnamská', thai: 'thajská', japanese: 'japonská', sushi: 'sushi', kebab: 'kebab', soup: 'polévky', salad: 'saláty',
    sandwich: 'sendviče', cake: 'dorty', pancake: 'palačinky', palatschinke: 'palačinky', lasagne: 'lasagne', chips: 'hranolky', fish: 'ryby',
    hot_dog: 'hot dogy', coffee_shop: 'káva', ice_cream: 'zmrzlina', international: 'mezinárodní', steak_house: 'steaky', grill: 'gril', mexican: 'mexická' };
  // otevírací doba z OSM (opening_hours): běžné zápisy „Mo-Fr 09:00-21:00; Sa,Su 10:00-22:00; PH off“, „24/7“, přes půlnoc.
  // Neznámý zápis (sezóny, týdny, „sunrise“…) → null: karta ukáže jen přepsaný text bez „teď otevřeno“. Svátky (PH) se přeskakují.
  const OH_D = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'], OH_CZ = ['Po', 'Út', 'St', 'Čt', 'Pá', 'So', 'Ne'];
  function ohParse(s) {
    if (!s) return null; s = s.trim();
    if (s === '24/7') return OH_D.map(() => [[0, 1440]]);
    const tyden = OH_D.map(() => null), DEN = '(?:Mo|Tu|We|Th|Fr|Sa|Su|PH)(?:-(?:Mo|Tu|We|Th|Fr|Sa|Su))?';
    // pravidla dělí „;“, nebo čárka za časem („…21:00, Sa 10:00-…“); čárka mezi dny („Sa,Su“) pravidlo nedělí
    for (const r of s.split(new RegExp(`;|(?<=\\d|off|closed),\\s*(?=${DEN}[\\s,])`)).map((x) => x.trim()).filter(Boolean)) {
      const m = r.match(new RegExp(`^(${DEN}(?:,${DEN})*)?\\s*(.*)$`)); if (!m) return null;
      const dny = [];
      for (const g of (m[1] || 'Mo-Su').split(',')) {
        if (g === 'PH') continue;
        const [a, b] = g.split('-'); let i = OH_D.indexOf(a); const j = b ? OH_D.indexOf(b) : i;
        for (let n = 0; n < 7; n++) { dny.push(i); if (i === j) break; i = (i + 1) % 7; }
      }
      if (!dny.length) continue;                           // jen svátky
      let iv = [];
      if (!/^(off|closed)$/.test(m[2])) for (const t of m[2].split(',')) {
        const q = t.trim().match(/^(\d{1,2}):(\d\d)-(\d{1,2}):(\d\d)\+?$/); if (!q) return null;
        const a = +q[1] * 60 + +q[2]; let b = +q[3] * 60 + +q[4]; if (b <= a) b += 1440; iv.push([a, b]);
      }
      for (const d of dny) tyden[d] = iv;
    }
    return tyden.map((x) => x || []);
  }
  const ohCas = (m) => (m % 1440 === 0 && m > 0 ? 'půlnoci' : `${Math.floor(m % 1440 / 60)}:${String(m % 60).padStart(2, '0')}`);
  function ohTed(t, now = new Date()) {                    // „otevřeno do 21:00“ / „zavřeno, dnes od 17:00“ / „zavřeno, zítra od 9:00“
    const d = (now.getDay() + 6) % 7, min = now.getHours() * 60 + now.getMinutes();
    for (const [a, b] of t[d]) if (min >= a && min < b) return [true, `otevřeno do ${ohCas(b)}`];
    for (const [, b] of t[(d + 6) % 7]) if (b > 1440 && min < b - 1440) return [true, `otevřeno do ${ohCas(b)}`];
    const dnes = t[d].find(([a]) => a > min), zitra = t[(d + 1) % 7][0];
    return [false, dnes ? `zavřeno, dnes od ${ohCas(dnes[0])}` : zitra ? `zavřeno, zítra od ${ohCas(zitra[0])}` : 'zavřeno'];
  }
  function ohRadky(t) {                                    // po sobě jdoucí dny se stejnou dobou do jednoho řádku: „Po–Pá 9:00–21:00“
    const txt = (iv) => iv.length ? iv.map(([a, b]) => `${ohCas(a)}–${b === 1440 ? '24:00' : ohCas(b)}`).join(', ') : 'zavřeno';
    const out = []; let i = 0;
    while (i < 7) { let j = i; while (j < 6 && txt(t[j + 1]) === txt(t[i])) j++; out.push([i === j ? OH_CZ[i] : `${OH_CZ[i]}–${OH_CZ[j]}`, txt(t[i])]); i = j + 1; }
    return out;
  }
  const ohPreklad = (s) => s.replace(/\b(Mo|Tu|We|Th|Fr|Sa|Su)\b/g, (d) => OH_CZ[OH_D.indexOf(d)]).replace(/\bPH\b/g, 'svátky')
    .replace(/\b(off|closed)\b/g, 'zavřeno').replace(/(\d)-(\d)/g, '$1–$2').replace(/;\s*/g, ' · ');
  // real wind for chimney smoke; the map camera looks from the south-west, so east is right and up, north is left and up
  let realWind = null, realWeather = null, applyRealWeather = () => {};
  // model hlásí kód srážek i při 0 mm: padat smí jen to, co opravdu padá
  const wmoWeather = (c, mm) => mm === 0 && ((c >= 51 && c <= 67) || (c >= 71 && c <= 77) || (c >= 80 && c <= 86) || c >= 95) ? 'clear' : (c >= 51 && c <= 67) || (c >= 80 && c <= 82) || c >= 95 ? 'rain' : (c >= 71 && c <= 77) || c === 85 || c === 86 ? 'snow' : c === 45 || c === 48 ? 'fog' : 'clear';
  const loadWind = () => fetch(`https://api.open-meteo.com/v1/forecast?latitude=${OV.cam.lat0}&longitude=${OV.cam.lon0}&current=precipitation,wind_speed_10m,wind_direction_10m,weather_code&wind_speed_unit=ms`)
    .then((r) => r.json()).then(({ current: c }) => {
      if ({{POCASI}}) { realWeather = wmoWeather(c.weather_code, c.precipitation); applyRealWeather(); }
      if (!{{VITR}}) return;
      const from = c.wind_direction_10m * Math.PI / 180, e = -Math.sin(from), n = -Math.cos(from);
      realWind = { dx: 0.7071 * (e - n), dy: -0.3536 * (e + n), strength: Math.min(2.2, Math.max(0.15, c.wind_speed_10m / 3)) };
    }).catch(() => {});
  if ({{VITR}} || {{POCASI}}) { loadWind(); setInterval(loadWind, 30 * 60 * 1000); }
  const W = OV.w, Hh = OV.h;
  const $ = (id) => document.getElementById(id);
  const isMobile = () => matchMedia('(max-width: 640px)').matches;
  let uiDepth = 0, uiPop = false, uiBackAt = 0, uiSelf = 0;
  // výchozí vzhled (Pavel 2026-11-19): podzim, den, jasno; skutečný čas a počasí vypnuté (10-vrstvy.js), volby se pamatují
  const state = { season: 'autumn', night: 0, weather: 'clear', sel: null, hover: null, wip: false };
  const hashTokens = (location.hash || '').slice(1).split('@')[0].split('-');
  const SEASON_TOKEN = { jaro: 'spring', leto: 'summer', podzim: 'autumn', zima: 'winter' };
  for (const t of hashTokens) { if (SEASON_TOKEN[t]) state.season = SEASON_TOKEN[t]; if (t === 'noc') state.night = 1; if (t === 'soumrak') state.night = 0.42; if (t === 'vse') state.wip = true; }
  if (state.season === 'winter') state.weather = 'snow';
  // vrstvy v odkazu: vypnutá vrstva = slovo v odkazu (#leto-bezdopravy@…), zapnuté (výchozí) se nepíšou
  const LAYER_TOKEN = { bezpopisku: 'l-labels', bezdopravy: 'l-traffic', bezlidi: 'l-lide', bezkoure: 'l-smoke', bezzvyrazneni: 'l-hover',
    ...Object.fromEntries(Object.values(KAT).map((c) => [c.token, c.vrstva])) };
  const applyLayers = (tok) => { for (const [t, id] of Object.entries(LAYER_TOKEN)) { const el = $(id); if (!el) continue; const on = !tok.includes(t); if (el.checked !== on) { el.checked = on; el.dispatchEvent(new Event('change')); } } };
  const WIP = Object.values(TILES.chunks || {}).some((c) => c.status !== 'hotovo');


