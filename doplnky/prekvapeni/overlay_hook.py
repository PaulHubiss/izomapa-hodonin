"""Skrytá překvapení (doplněk, Pavel 2026-11-26): předá prohlížeči, kde překvapení jsou.
Zapíná se v mesto.json: "doplnky": {"prekvapeni": {"enabled": true, ...}}. Volby (všechny nepovinné):
  "kostel": "Svatý Vavřinec"   název budovy v datech mapy (site/overlay), na kterou se kliká
  "vez": [lat, lon, výška m]   odkud vyletí noty (špička věže); bez ní nejvyšší bod obrysu (ten má u kostela bez vlastního
                               modelu 22 m navíc, u Hodonína model věže 44,96 m, poloha ze západní hrany půdorysu 2026-11-26)
  "zoo_druh": "lev"            druh z assets/zoo.json (výběh, kde zvíře zařve)
  "kominy_min_h": 80           komíny z assets/kominy.json aspoň tak vysoké (m)
  "vodnik": 0.35               jak často vykoukne vodník (podíl kliknutí do vody)
Vodní plochy (Morava, rybníky) bere z "water.ponds" čtverců mapy, obrysy v pixelech obrázku (0,2 m), zjednodušené."""
from __future__ import annotations

import json
from typing import Any

import shapely


def build_overlay(ctx: dict[str, Any]) -> dict[str, Any] | bool:
    cfg = ctx.get('plugin_config') or {}
    if cfg.get('enabled', True) is False:
        return False
    assets, out = ctx['assets_dir'], {'vodnik': float(cfg.get('vodnik', 0.35))}
    kostel, vody = None, []
    for i, j in ctx['mesto'].get('ctverce', []):
        f = ctx['site_dir'] / 'overlay' / f'c{i}_{j}.json'
        if not f.is_file():
            continue
        d = json.loads(f.read_text(encoding='utf-8'))
        for b in d.get('buildings', []):
            if b.get('name') == cfg.get('kostel', 'Svatý Vavřinec') and (not kostel or len(b['hull']) > len(kostel)):
                kostel = b['hull']
        for p in (d.get('water') or {}).get('ponds', []):
            if len(p) >= 3:
                g = shapely.Polygon(p).buffer(0)
                if g.area > 800: vody.append(g)                 # ~32 m² a víc (louže a jezírka v zahradách ne)
    if kostel:
        out['kostel'] = {'hull': kostel, 'spicka': min(kostel, key=lambda q: q[1])}   # záložní: nejvyšší bod obrysu
        if cfg.get('vez'): out['kostel']['vez'] = cfg['vez']
    if vody:
        u = shapely.unary_union(vody).simplify(1.5)
        kruh = lambda r: [[round(x, 1), round(y, 1)] for x, y in list(r.coords)[:-1]]
        out['voda'] = [[kruh(p.exterior)] + [kruh(h) for h in p.interiors] for p in getattr(u, 'geoms', [u]) if p.geom_type == 'Polygon']
    zf = assets / 'zoo.json'
    if zf.is_file():
        z = [v for v in json.loads(zf.read_text(encoding='utf-8')) if v.get('druh') == cfg.get('zoo_druh', 'lev')]
        if z: out['zoo'] = {'lat': z[0]['lat'], 'lon': z[0]['lon'], 'r': z[0].get('r', 14), 'nazev': z[0].get('nazev')}
    kf = assets / 'kominy.json'
    if kf.is_file():
        out['kominy'] = [{'lat': k['lat'], 'lon': k['lon'], 'h': k['h']} for k in json.loads(kf.read_text(encoding='utf-8'))
                         if (k.get('h') or 0) >= cfg.get('kominy_min_h', 80)]
    return out
