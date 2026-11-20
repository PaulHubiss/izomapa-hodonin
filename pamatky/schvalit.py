# modely památek schválené v dashboardu (pamatky/rozhodnuti.json, stav "ok") -> pamatky/schvalene.json
#   .venv/bin/python pamatky/schvalit.py
# Běžný render (render.mjs, dlaždice mapy) kreslí jen tyhle; náhled a před/po (pam=vse) ukazují všechny ze seznam.json.
# prep.py bere vršky (obrys při najetí myší) taky jen u schválených. Po změně: prep + render dotčených čtverců (pamatky/render_mapa.sh).
import json, os
os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
ld = lambda p, d: json.load(open(p, encoding='utf-8')) if os.path.exists(p) else d
seznam = ld('pamatky/seznam.json', [])
# od 2026-11-20 v pamatky/ (podklady-soukrome/pamatky je zástupce na Disk); staré místo jen jako záloha
RJ = next((p for p in ('pamatky/rozhodnuti.json', 'podklady-soukrome/pamatky/rozhodnuti.json') if os.path.exists(p)), None)
if not RJ: raise SystemExit('❌ chybí pamatky/rozhodnuti.json – schválené nepřepisuji (jinak by z mapy zmizely všechny modely)')
roz = ld(RJ, {})
ok = [s for s in seznam if (roz.get(s) or {}).get('stav') == 'ok' and os.path.exists(f'pamatky/{s}.js')]
old = ld('pamatky/schvalene.json', [])
with open('pamatky/schvalene.json', 'w', encoding='utf-8') as f: json.dump(ok, f, ensure_ascii=False, indent=1)
print(f'schváleno {len(ok)} z {len(seznam)}' + (f", přibylo: {', '.join(sorted(set(ok) - set(old)))}" if set(ok) - set(old) else '')
      + (f", ubylo: {', '.join(sorted(set(old) - set(ok)))}" if set(old) - set(ok) else ''))
nesch = [s for s in seznam if s not in ok]
if nesch: print('neschválené (do dlaždic ne):', ', '.join(f"{s} ({(roz.get(s) or {}).get('stav') or 'bez rozhodnutí'})" for s in nesch))
