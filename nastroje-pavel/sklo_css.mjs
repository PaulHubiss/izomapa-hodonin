// Varianty skla panelu kvůli kontrastu (Pavel 2026-11-18). Používá sklo_varianty.mjs (snímky + měření) a kontrast.mjs --varianta X.
// html:root místo :root – nase.css se načítá až v těle stránky a stejně silný selektor vložený do hlavičky by přebil.
export const VARIANTY = {
  A: { nazev: 'Dnes', popis: 'Sklo 50 % tmavé, mapa pod ním plně jasná.', css: '' },
  B: { nazev: 'Tmavší sklo', popis: 'Sklo 72 % tmavé. Mapa prosvítá méně, vzhled skla zůstává.',
    css: 'html:root { --nb-sklo: rgba(20, 30, 44, .72); }' },
  C: { nazev: 'Ztlumená mapa pod sklem', popis: 'Sklo jako dnes, ale mapa pod ním je ztmavená na 55 %. Světlá místa (sníh) ztmavnou nejvíc, barvy prosvítají dál.',
    css: '.nb-sklo { -webkit-backdrop-filter: blur(18px) saturate(1.5) brightness(.55) !important; backdrop-filter: blur(18px) saturate(1.5) brightness(.55) !important; }' },
  D: { nazev: 'Mírně tmavší a ztlumená', popis: 'Kompromis: sklo 62 % a mapa pod ním ztmavená na 75 %.',
    css: 'html:root { --nb-sklo: rgba(20, 30, 44, .62); } .nb-sklo { -webkit-backdrop-filter: blur(18px) saturate(1.6) brightness(.75) !important; backdrop-filter: blur(18px) saturate(1.6) brightness(.75) !important; }' },
};
// vybraná sekce v liště: dnes zlatý text na světlejším podkladu (3,0–4,1 : 1 i s tmavším sklem)
export const LISTA = {
  X: { nazev: 'Dnes', popis: 'Zlatý text a ikona na světlejším podkladu.', css: '' },
  Y: { nazev: 'Zlaté pozadí', popis: 'Jako vybraná volba ve Vzhledu („Zima“): zlatý podklad, tmavý text a ikona. Kontrast ~11 : 1.',
    css: '.nb-rail button.on { background: var(--nb-zlata) !important; color: var(--nb-na-zlate) !important; }' },
  Z: { nazev: 'Bílý text, zlatá ikona', popis: 'Podklad jako dnes, text bílý, zlatá zůstane jen ikona.',
    css: '.nb-rail button.on { color: #fff !important; } .nb-rail button.on svg { color: var(--nb-zlata); }' },
};
