"""Vánoční výzdoba z plánu jarmarku (obrázek od pořadatele, DK Hodonín) -> assets/vanoce.json.

  .venv/bin/python nastroje-pavel/vanoce_plan.py

Plán 2026 (Vánoční jarmark 29. 11. – 20. 12. 2026, Masarykovo náměstí; obrázek v podklady/vanocni-jarmark-2026-plan-v2.jpg,
starší verze bez -v2, podklady = zástupce na Google Disk) je otočený: na obrázku vpravo = sever, dolů = východ.
v2 (Pavel 2026-11-23): stejný výřez 1920 × 1515, změny jen u radnice a na jižní řadě: nový 14 nad 13, nový 12 v řadě
10–12, zmizel šikmý stánek u fontány (dřív druhý z 12–13); dřívější 14–16 přečíslované na 15–17 beze změny polohy.
Převod pixel -> místo: kotva = střed fontány na náměstí (na plánu u ≈ 680, v ≈ 1130; zeměpisně 48,8486369 / 17,1285768),
měřítko ~14,2 px/m (ověřeno průčelím kostela a ulicí se stánky, odchylka do ~2 m). Plán slouží jen k polohám, tvary a barvy
bere mapa ze svých modelů. Na příští rok: přepsat ROK/OD/DO, kotvu (pokud se změní výřez plánu) a pixely v RADY a STROMY.
Kolotoč, pódium a fotopoint izomapa nekreslí (nemá pro ně model).
"""
import json, math, os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
import geo

# jarmark 2026 je 29. 11. – 20. 12.; v mapě zapnuto už od 19. 11. (Pavel 2026-11-19: „nechal bych výzdobu už defaultně
# zapnutou“ – i jako pozvánka), konec s jarmarkem, pak by stánky na náměstí nesouhlasily
OD, DO = '11-19', '12-20'
# kotva = střed fontány: pixel plánu (U0, V0) a její zeměpisná poloha. Dřív v metrech mapy (x 442,85, y −852,8) – ty se
# s posunem středu mřížky změní (2026-11-20 o −105 / −105 m) a jarmark pak ujel o 105 m k SV (Pavel 2026-11-23)
U0, V0, LAT0, LON0, K = 680, 1130, 48.8486369, 17.1285768, 14.2
X0, Y0 = (float(v) for v in geo.to_local(LON0, LAT0))


def misto(u, v):
    """pixel plánu (u = vodorovně, v = svisle) -> [lat, lon]"""
    x, y = X0 + (v - V0) / K, Y0 + (u - U0) / K
    lon, lat = geo.to_lonlat(x, y)
    return [round(lat, 6), round(lon, 6)]


def smer(a, b):
    """směr řady z pixelu a do b -> stupně od východu proti směru hodin (u = sever, v = východ)"""
    return math.degrees(math.atan2(b[0] - a[0], b[1] - a[1]))


PULT = {'V': 0, 'S': 90, 'Z': 180, 'J': 270}   # kam míří pult (prep: pult je vpravo od směru řady = směr − 90°)


def natoceni(a, b, pult):
    f = PULT[pult]
    if a == b: return round((f + 90) % 360, 1)
    t = smer(a, b)
    if math.cos(math.radians(t - 90 - f)) < 0: t += 180
    return round(t % 360, 1)


# (popis, první stánek, poslední stánek, počet, šířka m, mezera m, kam míří pult); pixely středů [u, v] z plánu
RADY = [
    ('dřevěné 1–4 u ulice',        (858, 620),  (1000, 600), 4, 2.6, 0.8, 'V'),
    ('food trucky 19–21',          (1110, 585), (1440, 535), 3, 8.5, 3.0, 'V'),
    ('plátěné 1–6',                (1553, 520), (1810, 460), 6, 3.0, 0.6, 'V'),
    ('plátěné 7–11',               (1570, 638), (1775, 595), 5, 3.0, 0.6, 'Z'),
    ('food trucky 17–18',          (1170, 700), (1340, 672), 2, 8.5, 3.0, 'Z'),
    ('dřevěné 13–14',              (505, 1045), (497, 1100), 2, 2.6, 1.3, 'S'),
    ('dřevěné 10–12',              (517, 1207), (604, 1218), 3, 2.6, 0.5, 'Z'),
    ('dřevěné 8–9',                (756, 1245), (800, 1252), 2, 2.6, 0.6, 'Z'),
    ('dřevěný 7',                  (898, 1065), (898, 1065), 1, 2.6, 0.0, 'Z'),
    ('stánek DK 5 a dřevěný 6',    (883, 820),  (924, 862),  2, 2.6, 0.6, 'J'),
    ('dřevěné 15–16',              (545, 820),  (597, 775),  2, 2.6, 0.8, 'S'),
    ('dřevěný 17',                 (453, 835),  (453, 835),  1, 3.2, 0.0, 'S'),
    ('Ježíškova pošta',            (842, 1108), (842, 1108), 1, 2.4, 0.0, 'Z'),
]
STROMY = [(840, 1180)]                    # vánoční stromek u fontány
# kluziště „jen ze srandy“ (Pavel 2026-11-19, ve skutečnosti na náměstí není; poznámka u přepínače výzdoby ve web/nase.js):
# střed v pixelech plánu, délka a šířka m, delší strana k severu (mezi stánky 14–16 na západě a fontánou na východě)
KLUZISTE = [((705, 940), 20, 12, 90)]


def main():
    stanky = []
    for _, a, b, n, w, m, pult in RADY:
        lat, lon = misto((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)
        stanky.append({'lat': lat, 'lon': lon, 'a': natoceni(a, b, pult), 'n': n, 'w': w, 'm': m})
    out = {
        '_pozn': 'Z plánu Vánočního jarmarku 2026 (DK Hodonín) přes nastroje-pavel/vanoce_plan.py – neupravovat ručně, přegenerovat.',
        'od': OD, 'do': DO,
        'stromy': [misto(*p) for p in STROMY],
        'kluziste': [dict(zip(('lat', 'lon'), misto(*st)), d=d, s=s, a=a) for st, d, s, a in KLUZISTE],
        'stanky': stanky,
    }
    os.makedirs('assets', exist_ok=True)
    with open('assets/vanoce.json', 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
    print(f"assets/vanoce.json: stromů {len(out['stromy'])}, řad stánků {len(stanky)} ({sum(r[3] for r in RADY)} stánků), {OD} – {DO}")


if __name__ == '__main__':
    main()
