"""Stáhne náhledy fotek z Wikimedia Commons jako podklad pro dominanty.

  .venv/bin/python nastroje-pavel/commons_fotky.py "<složka ve fotky/>" "Category:…" [File:… …] [--max 8] [--sirka 800]

Ukládá do fotky/<složka>/ (je v .gitignore) a k tomu zdroje.txt s autorem a licencí každé fotky.
Kreslit podle nich se smí (Commons = volné licence); Google Maps / Mapy.cz ne.
"""
import json, pathlib, sys, time, urllib.error, urllib.parse, urllib.request

API = "https://commons.wikimedia.org/w/api.php"
UA = {"User-Agent": "izomapa-local/1.0"}


def stahni(url):
    """GET s ohledem na limit Commons: při 429 počká a zkusí znovu (pouštět po jednom, ne souběžně)."""
    for pokus in range(6):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA)) as r:
                data = r.read()
            time.sleep(1)
            return data
        except urllib.error.HTTPError as e:
            if e.code != 429 or pokus == 5:
                raise
            time.sleep(int(e.headers.get("Retry-After") or 5 * (pokus + 1)))


def api(**p):
    p["format"] = "json"
    return json.loads(stahni(API + "?" + urllib.parse.urlencode(p)))


def main():
    a = sys.argv[1:]
    mx = int(a[a.index("--max") + 1]) if "--max" in a else 8
    w = int(a[a.index("--sirka") + 1]) if "--sirka" in a else 800
    a = [x for i, x in enumerate(a) if not x.startswith("--") and (i == 0 or not a[i - 1].startswith("--"))]
    slozka, zdroje = a[0], a[1:]
    soubory = []
    for z in zdroje:
        if z.startswith("Category:"):
            d = api(action="query", list="categorymembers", cmtitle=z, cmtype="file", cmlimit=50)
            soubory += [m["title"] for m in d["query"]["categorymembers"]]
        else:
            soubory.append(z)
    soubory = [s for s in dict.fromkeys(soubory) if s.lower().endswith((".jpg", ".jpeg", ".png", ".webp"))][:mx]
    cil = pathlib.Path(__file__).resolve().parent.parent / "fotky" / slozka
    cil.mkdir(parents=True, exist_ok=True)
    radky = []
    for s in soubory:
        d = api(action="query", titles=s, prop="imageinfo", iiprop="url|extmetadata", iiurlwidth=w)
        info = next(iter(d["query"]["pages"].values()))["imageinfo"][0]
        meta = info.get("extmetadata", {})
        autor = meta.get("Artist", {}).get("value", "?")
        lic = meta.get("LicenseShortName", {}).get("value", "?")
        jmeno = s.removeprefix("File:").replace("/", "_")
        (cil / jmeno).write_bytes(stahni(info["thumburl"]))
        radky.append(f"{jmeno}\t{lic}\t{autor}\t{info['descriptionurl']}")
        print("✓", jmeno, "·", lic)
    (cil / "zdroje.txt").write_text("\n".join(radky) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
