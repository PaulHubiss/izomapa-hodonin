// Kategorie míst – jeden seznam pro Vrstvy, Místa i ikonky v mapě (Pavel 2026-11-16: „ať kategorie ve Vrstvách
// odpovídají kategoriím v Místech a naopak, i s ikonkami“). Pořadí = pořadí v menu.
//   k        klíč (u veřejných míst = "skupina" z nastroje-pavel/verejna_mista.py)
//   vrstva   id přepínače ve Vrstvách (web/app.html), token = slovo ve sdíleném odkazu, když je vrstva vypnutá
//   barva    rámeček ikonky v mapě, tečka v oddálené mapě, ikonka v menu
//   ik       vnitřek ikonky Lucide (ISC), čára 2 px; nové vytáhne nastroje-pavel/ikony_lucide.py
window.IZO_KAT = [
  { k: 'pribehy', nazev: 'Příběhy', vrstva: 'l-labels', token: 'bezpopisku', barva: '#ff4fa3',   // sytá růžová (Pavel 2026-11-18: skoro bílá #f4f1e8 nebyla v mapě vidět)
    ik: '<path d="M12 7v14"/><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/>' },   // book-open
  { k: 'pamatky', nazev: 'Památky', vrstva: 'l-pam', token: 'bezpamatek', barva: '#f2c94c',
    ik: '<path d="M10 18v-7"/><path d="M11.119 2.205a2 2 0 0 1 1.762 0l7.84 3.846A.5.5 0 0 1 20.5 7h-17a.5.5 0 0 1-.22-.949z"/><path d="M14 18v-7"/><path d="M18 18v-7"/><path d="M3 22h18"/><path d="M6 18v-7"/>' },   // landmark
  { k: 'kultura', nazev: 'Kultura', vrstva: 'l-v-kultura', token: 'bezkultury', barva: '#c49cf2',
    ik: '<path d="M10 11h.01"/><path d="M14 6h.01"/><path d="M18 6h.01"/><path d="M6.5 13.1h.01"/><path d="M22 5c0 9-4 12-6 12s-6-3-6-12c0-2 2-3 6-3s6 1 6 3"/><path d="M17.4 9.9c-.8.8-2 .8-2.8 0"/><path d="M10.1 7.1C9 7.2 7.7 7.7 6 8.6c-3.5 2-4.7 3.9-3.7 5.6 4.5 7.8 9.5 8.4 11.2 7.4.9-.5 1.9-2.1 1.9-4.7"/><path d="M9.1 16.5c.3-1.1 1.4-1.7 2.4-1.4"/>' },   // drama
  { k: 'kostely', nazev: 'Kostely a hřbitovy', vrstva: 'l-v-kostely', token: 'bezkostelu', barva: '#e7a3c9',
    ik: '<path d="M10 9h4"/><path d="M12 7v5"/><path d="M14 21v-3a2 2 0 0 0-4 0v3"/><path d="m18 9 3.52 2.147a1 1 0 0 1 .48.854V19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6.999a1 1 0 0 1 .48-.854L6 9"/><path d="M6 21V7a1 1 0 0 1 .376-.782l5-3.999a1 1 0 0 1 1.249.001l5 4A1 1 0 0 1 18 7v14"/>' },   // church
  { k: 'jidlo', nazev: 'Restaurace a kavárny', vrstva: 'l-pod', token: 'bezpodniku', barva: '#f29a5b',
    ik: '<path d="m16 2-2.3 2.3a3 3 0 0 0 0 4.2l1.8 1.8a3 3 0 0 0 4.2 0L22 8"/><path d="M15 15 3.3 3.3a4.2 4.2 0 0 0 0 6l7.3 7.3c.7.7 2 .7 2.8 0L15 15Zm0 0 7 7"/><path d="m2.1 21.8 6.4-6.3"/><path d="m19 5-7 7"/>' },   // utensils-crossed (v mapě podle druhu: příbor, káva, pivo – POD_IK v app.html)
  { k: 'ubytovani', nazev: 'Ubytování', vrstva: 'l-v-ubytovani', token: 'bezubytovani', barva: '#d8b88e',
    ik: '<path d="M2 20v-8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v8"/><path d="M4 10V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4"/><path d="M12 4v6"/><path d="M2 18h20"/>' },   // bed-double
  { k: 'priroda', nazev: 'Příroda a volný čas', vrstva: 'l-v-priroda', token: 'bezprirody', barva: '#a6d65e',
    ik: '<path d="M10 10v.2A3 3 0 0 1 8.9 16H5a3 3 0 0 1-1-5.8V10a3 3 0 0 1 6 0Z"/><path d="M7 16v6"/><path d="M13 19v3"/><path d="M12 19h8.3a1 1 0 0 0 .7-1.7L18 14h.3a1 1 0 0 0 .7-1.7L16 9h.2a1 1 0 0 0 .8-1.7L13 3l-1.4 1.5"/>' },   // trees
  { k: 'sport', nazev: 'Sport', vrstva: 'l-v-sport', token: 'bezsportu', barva: '#6f9cff',
    ik: '<path d="M10 14.66V17a1 1 0 0 1-1 1 2 2 0 0 0-2 2v2"/><path d="M14 14.66V17a1 1 0 0 0 1 1 2 2 0 0 1 2 2v2"/><path d="M17.916 10H19.5A2.5 2.5 0 0 0 22 7.5V5a1 1 0 0 0-1-1h-3"/><path d="M4 22h16"/><path d="M6 9a6 6 0 0 0 12 0V3a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1z"/><path d="M6.084 10H4.5A2.5 2.5 0 0 1 2 7.5V5a1 1 0 0 1 1-1h3"/>' },   // trophy
  { k: 'skoly', nazev: 'Školy', vrstva: 'l-v-skoly', token: 'bezskol', barva: '#5fd0d0',
    ik: '<path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z"/><path d="M22 10v6"/><path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5"/>' },   // graduation-cap
  { k: 'zdravi', nazev: 'Zdraví', vrstva: 'l-v-zdravi', token: 'bezzdravi', barva: '#4fc98a',
    ik: '<path d="M4 9a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2h4a1 1 0 0 1 1 1v4a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2v-4a1 1 0 0 1 1-1h4a2 2 0 0 0 2-2v-2a2 2 0 0 0-2-2h-4a1 1 0 0 1-1-1V4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4a1 1 0 0 1-1 1z"/>' },   // cross
  { k: 'urady', nazev: 'Úřady', vrstva: 'l-v-urady', token: 'bezuradu', barva: '#8fb0d8',
    ik: '<path d="M10 12h4"/><path d="M10 8h4"/><path d="M14 21v-3a2 2 0 0 0-4 0v3"/><path d="M6 10H4a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-2"/><path d="M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16"/>' },   // building-2
  { k: 'sluzby', nazev: 'Služby', vrstva: 'l-v-sluzby', token: 'bezsluzeb', barva: '#b9c2cf',
    ik: '<path d="M3 20a1 1 0 0 1-1-1v-1a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v1a1 1 0 0 1-1 1Z"/><path d="M20 16a8 8 0 1 0-16 0"/><path d="M12 4v4"/><path d="M10 4h4"/>' },   // concierge-bell
  { k: 'doprava', nazev: 'Doprava', vrstva: 'l-v-doprava', token: 'bezdopravnich', barva: '#f08a8a',
    ik: '<path d="M4 6 2 7"/><path d="M10 6h4"/><path d="m22 7-2-1"/><rect width="16" height="16" x="4" y="3" rx="2"/><path d="M4 11h16"/><path d="M8 15h.01"/><path d="M16 15h.01"/><path d="M6 19v2"/><path d="M18 21v-2"/>' },   // bus-front
];
// ikonka jako <svg>; čára pevně 2 px i při zvětšení (vector-effect)
window.IZO_KAT_SVG = (ik, cls = '') => `<svg${cls ? ` class="${cls}"` : ''} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">`
  + ik.replace(/\/>/g, ' vector-effect="non-scaling-stroke"/>') + '</svg>';
