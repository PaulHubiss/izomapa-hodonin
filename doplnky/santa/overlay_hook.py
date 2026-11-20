"""Santa se soby (doplněk): předá prohlížeči polohy komínů (obrazové souřadnice z site/overlay/<čtverec>.json),
do kterých Santa pouští dárky. Zapíná se v mesto.json: "doplnky": {"santa": {"enabled": true, ...}}.
Volby (nepovinné): "pauza_s" průměrná pauza mezi přelety (výchozí 25), "rychlost" m/s (výchozí 42),
"vyska" m nad terénem (výchozí 110), "darky" false = bez dárků."""
from __future__ import annotations

import json
from typing import Any


def build_overlay(ctx: dict[str, Any]) -> dict[str, Any] | bool:
    cfg = ctx.get('plugin_config') or {}
    if cfg.get('enabled', True) is False:
        return False
    komin = []
    if cfg.get('darky', True) is not False:
        for i, j in ctx['mesto'].get('ctverce', []):          # jen čtverce mapy (site/overlay může mít staré soubory)
            f = ctx['site_dir'] / 'overlay' / f'c{i}_{j}.json'
            if f.is_file():
                komin += [[round(c[0]), round(c[1])] for c in json.loads(f.read_text(encoding='utf-8')).get('chimneys', [])]
    return {'komin': komin}
