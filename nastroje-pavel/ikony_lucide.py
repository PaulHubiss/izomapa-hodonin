"""Vnitřek ikon Lucide (ISC) pro vložení do JS: python3 nastroje-pavel/ikony_lucide.py building-2 church …

Bere je ze Společných nástrojů (~/Claude/Spolecne-nastroje/node_modules/lucide-static/icons), vypíše
klíč: 'vnitřek <svg>' bez obalu, jak ho čekají VRSTVY_IK a D_IKONY ve web/app.html.
"""
import os, re, sys

ADR = os.path.expanduser('~/Claude/Spolecne-nastroje/node_modules/lucide-static/icons')
for jm in sys.argv[1:]:
    t = open(os.path.join(ADR, jm + '.svg'), encoding='utf-8').read()
    vnitrek = re.search(r'<svg[^>]*>(.*)</svg>', t, re.S).group(1)
    vnitrek = re.sub(r'\s*\n\s*', '', vnitrek).replace(' />', '/>')
    print(f"'{jm}': '{vnitrek}',")
