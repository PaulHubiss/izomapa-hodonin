"""Náhledový server mapy (místo `npm run nahled`): stejné jako python http.server, ale prohlížeči říká,
ať si stránku a data po každé přestavbě ověří → stačí obyčejné obnovení, ne ⌘⇧R.

    python3 nastroje-pavel/nahled_server.py          # http://127.0.0.1:8000, složka site/

Proč: python http.server neposílá Cache-Control, prohlížeč si pak index.html a tiles.json (seznam čtverců
a verze dlaždic) podrží podle vlastního odhadu a po přestavbě ukazuje starou mapu (2026-11-13).
Co má v adrese ?v=<verze> (dlaždice, náhledy), smí prohlížeč držet rok: přestavba změní verzi, tedy i adresu.
Jen standardní knihovna, aby šel spustit i bez .venv (autostart).

/api/<jméno>?… obslouží jako Cloudflare: spustí functions/api/<jméno>.js přes nastroje-pavel/api_lokalne.mjs
(program DK, hasiči, výluky; letadla taky). Odpověď drží v paměti tak dlouho, jak říká její Cache-Control (2026-11-15).

/?video = mapa s režimem pro výběr záběrů videa (nastroje-pavel/video/rezim/, jen odsud, do site/ se nedostane);
/_video/predvolby čte a POST /_video/predvolba ukládá předvolby nastroje-pavel/video/predvolby/ (2026-11-26);
POST /_video/vyrob spustí video.mjs (jeden naráz), /_video/beh průběh, /_video/zrus, /_video/vystup/… hotové soubory
(s Range kvůli <video> v Safari), /_video/finder ukáže soubor ve Finderu.
"""
import functools, http.server, json, os, shutil, subprocess, sys, time, urllib.parse

PROJEKT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KOREN = os.path.join(PROJEKT, 'site')
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
NODE = shutil.which('node') or next((n for n in ('/opt/homebrew/bin/node', '/usr/local/bin/node') if os.path.exists(n)), None)   # autostart nemá PATH z terminálu
TTL = {'program': 3600, 'vyluky': 600, 'hasici': 60, 'flights': 15}   # s, stejně jako Cache-Control funkcí na Cloudflaru
API = {}   # (jméno, dotaz) → (čas, JSON)


VIDEO = os.path.join(PROJEKT, 'nastroje-pavel', 'video')                 # režim ?video (napady/VIDEO.md, fáze 2)
PREDVOLBY = os.path.join(VIDEO, 'predvolby')
VIDEA = os.path.join(PROJEKT, 'videa')
BEH = {'proces': None, 'log': os.path.join(PROJEKT, 'build', 'video', 'beh.log'), 'jmeno': '', 'start': 0}   # jeden render naráz
TYPY = {'.mp4': 'video/mp4', '.png': 'image/png', '.jpg': 'image/jpeg'}


def jmeno_ok(j):
    return 0 < len(j) <= 40 and j.isascii() and all(c.islower() or c.isdigit() or c == '-' for c in j)


def stav_behu():
    """stav renderu pro režim ?video: běží, průběh (řádky PRUBEH z video.mjs), poslední řádky, výstupy (VYSTUP)"""
    p, radky = BEH['proces'], []
    if os.path.exists(BEH['log']):
        with open(BEH['log'], encoding='utf-8', errors='replace') as f:
            radky = f.read().splitlines()
    prubeh = next((r.split()[1] for r in reversed(radky) if r.startswith('PRUBEH ')), None)
    hotovo, celkem = (int(x) for x in prubeh.split('/')) if prubeh else (0, 0)
    kod = None if p is None else p.poll()
    return {'bezi': p is not None and kod is None, 'kod': kod, 'jmeno': BEH['jmeno'], 'start': BEH['start'], 'hotovo': hotovo, 'celkem': celkem,
            'radky': [r for r in radky if not r.startswith(('PRUBEH ', 'VYSTUP '))][-12:],
            'vystupy': [r[7:] for r in radky if r.startswith('VYSTUP ')]}


class Handler(http.server.SimpleHTTPRequestHandler):
    def video_get(self, u):
        """Režim ?video jen z tohohle serveru, do site/ se nedostane (Pavel 2026-11-26: „na web se generování nedostane“):
        /?video = mapa s vloženým skriptem režimu; /_video/predvolby = všechny předvolby; /_video/<soubor> = soubory režimu."""
        if u.path in ('/', '/index.html') and 'video' in u.query.split('&'):
            with open(os.path.join(KOREN, 'index.html'), 'rb') as f:
                html = f.read()
            s = str(int(time.time()))
            vlozit = (f'<link rel="stylesheet" href="/_video/rezim.css?s={s}"><script src="/_video/rezim.js?s={s}" defer></script>').encode()
            html = html.replace(b'</body>', vlozit + b'</body>', 1) if b'</body>' in html else html + vlozit
            return self.odpoved(200, html, 'text/html; charset=utf-8')
        if u.path == '/_video/predvolby':
            vse = {}
            for f in sorted(os.listdir(PREDVOLBY)):
                if f.endswith('.json'):
                    with open(os.path.join(PREDVOLBY, f), encoding='utf-8') as fh:
                        vse[f[:-5]] = json.load(fh)
            return self.odpoved(200, json.dumps(vse, ensure_ascii=False).encode())
        if u.path == '/_video/beh':
            return self.odpoved(200, json.dumps(stav_behu(), ensure_ascii=False).encode())
        if u.path.startswith('/_video/vystup/'):                     # hotové video/fotka/mřížka z videa/<předvolba>/
            casti = urllib.parse.unquote(u.path[len('/_video/vystup/'):]).split('/')
            if len(casti) != 2 or not jmeno_ok(casti[0]) or not casti[1].replace('-', '').replace('.', '').isalnum():
                return self.odpoved(404, b'{}')
            return self.soubor_s_rozsahem(os.path.join(VIDEA, *casti))
        soubor = u.path[len('/_video/'):]
        cesta = os.path.join(VIDEO, 'zony.json') if soubor == 'zony.json' else os.path.join(VIDEO, 'rezim', soubor)
        if not soubor.replace('.', '').replace('-', '').isalnum() or not os.path.isfile(cesta):
            return self.odpoved(404, b'{}')
        typ = {'.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json'}.get(os.path.splitext(cesta)[1], 'text/plain')
        with open(cesta, 'rb') as f:
            return self.odpoved(200, f.read(), typ + '; charset=utf-8')

    def soubor_s_rozsahem(self, cesta):
        """soubor s podporou Range: Safari bez ní video v <video> nepřehraje"""
        if not os.path.isfile(cesta):
            return self.odpoved(404, b'{}')
        velikost = os.path.getsize(cesta)
        od, do = 0, velikost - 1
        rozsah = self.headers.get('Range', '')
        if rozsah.startswith('bytes='):
            a, _, b = rozsah[6:].split(',')[0].partition('-')
            if a:
                od, do = int(a), min(int(b), velikost - 1) if b else velikost - 1
            elif b:
                od = max(0, velikost - int(b))
        self.send_response(206 if rozsah else 200)
        self.send_header('Content-Type', TYPY.get(os.path.splitext(cesta)[1].lower(), 'application/octet-stream'))
        self.send_header('Accept-Ranges', 'bytes')
        self.send_header('Content-Length', str(do - od + 1))
        if rozsah:
            self.send_header('Content-Range', f'bytes {od}-{do}/{velikost}')
        self.end_headers()
        with open(cesta, 'rb') as f:
            f.seek(od)
            zbyva = do - od + 1
            while zbyva > 0:
                kus = f.read(min(1 << 20, zbyva))
                if not kus:
                    break
                try:
                    self.wfile.write(kus)
                except (BrokenPipeError, ConnectionResetError):
                    return                                            # prohlížeč si vzal jen kus (přehrávač)
                zbyva -= len(kus)

    def video_post(self, cesta, telo):
        """POST /_video/predvolba {jmeno, data} uloží předvolbu; /_video/vyrob {jmeno, zkouska} spustí video.mjs;
        /_video/zrus zastaví render; /_video/finder {soubor} ukáže výstup ve Finderu (server běží na Macu, kde sedí Pavel)."""
        J = lambda kod, o: self.odpoved(kod, json.dumps(o, ensure_ascii=False).encode())
        try:
            d = json.loads(telo or b'{}')
        except Exception:
            return J(400, {'chyba': 'nečitelná data'})
        if cesta == '/_video/zrus':
            if BEH['proces'] and BEH['proces'].poll() is None:
                BEH['proces'].terminate()
            return J(200, stav_behu())
        if cesta == '/_video/finder':
            soubor = os.path.normpath(os.path.join(PROJEKT, str(d.get('soubor', ''))))
            if not soubor.startswith(VIDEA + os.sep) or not os.path.exists(soubor):
                return J(404, {'chyba': 'soubor nenalezen'})
            subprocess.run(['open', '-R', soubor])
            return J(200, {})
        if cesta == '/_video/vyrob':
            jmeno = str(d.get('jmeno', ''))
            if not jmeno_ok(jmeno) or not os.path.exists(os.path.join(PREDVOLBY, jmeno + '.json')):
                return J(400, {'chyba': 'předvolba neexistuje (nejdřív ulož)'})
            if BEH['proces'] and BEH['proces'].poll() is None:
                return J(409, {'chyba': f'už běží render {BEH["jmeno"]}'})
            if not NODE:
                return J(502, {'chyba': 'nenašel jsem node'})
            os.makedirs(os.path.dirname(BEH['log']), exist_ok=True)
            prikaz = [NODE, os.path.join(PROJEKT, 'nastroje-pavel', 'video.mjs'), jmeno] + (['--zkouska'] if d.get('zkouska') else [])
            log = open(BEH['log'], 'w', encoding='utf-8')
            # autostart nemá PATH z terminálu → ffmpeg a magick z Homebrew dohledat
            env = dict(os.environ, PATH=os.environ.get('PATH', '') + ':/opt/homebrew/bin:/usr/local/bin', HOME=os.path.expanduser('~'))   # HOME: Playwright v něm hledá Chromium
            BEH.update(proces=subprocess.Popen(prikaz, cwd=PROJEKT, stdout=log, stderr=subprocess.STDOUT, env=env), jmeno=jmeno, start=time.time())
            return J(200, stav_behu())
        if cesta != '/_video/predvolba':
            return J(404, {})
        try:
            jmeno, data = str(d['jmeno']), d['data']
        except Exception:
            return J(400, {'chyba': 'nečitelná data'})
        if not jmeno_ok(jmeno):
            return self.odpoved(400, json.dumps({'chyba': 'jméno jen malá písmena bez diakritiky, číslice a pomlčky'}, ensure_ascii=False).encode())
        if not isinstance(data, dict) or not isinstance(data.get('zabery'), list) or not data['zabery']:
            return self.odpoved(400, json.dumps({'chyba': 'předvolba nemá žádný záběr'}, ensure_ascii=False).encode())
        cesta = os.path.join(PREDVOLBY, jmeno + '.json')
        with open(cesta, 'w', encoding='utf-8') as f:
            f.write(json.dumps(data, ensure_ascii=False, indent=2) + '\n')
        self.odpoved(200, json.dumps({'soubor': os.path.relpath(cesta, PROJEKT)}, ensure_ascii=False).encode())

    def do_GET(self):
        u = urllib.parse.urlsplit(self.path)
        if u.path.startswith('/_video/') or (u.path in ('/', '/index.html') and 'video' in u.query.split('&')):
            return self.video_get(u)
        jmeno = u.path[len('/api/'):] if u.path.startswith('/api/') else ''
        if not (jmeno.isalpha() and jmeno.islower() and os.path.exists(os.path.join(PROJEKT, 'functions', 'api', jmeno + '.js'))):
            return super().do_GET()
        if not NODE:
            return self.odpoved(502, b'{}')
        klic = (jmeno, u.query)
        t, data = API.get(klic, (0, None))
        if time.time() - t > TTL.get(jmeno, 60):
            try:
                r = subprocess.run([NODE, os.path.join(PROJEKT, 'nastroje-pavel', 'api_lokalne.mjs'), jmeno, u.query],
                                   capture_output=True, timeout=30, cwd=PROJEKT)
                data = r.stdout if r.returncode == 0 else None
                json.loads(data or b'null')
            except Exception:
                data = None
            if data: API[klic] = (time.time(), data)
        self.odpoved(200 if data else 502, data or b'{}')

    def do_POST(self):
        """POST /ladeni: záznam ladicího nástroje z mapy (?ladeni) uloží do ladeni/<druh>-<čas>.json (2026-11-17)"""
        u = urllib.parse.urlsplit(self.path)
        n = int(self.headers.get('Content-Length') or 0)
        if u.path.startswith('/_video/') and 0 <= n <= 1_000_000:
            return self.video_post(u.path, self.rfile.read(n) if n else b'')
        if u.path != '/ladeni' or not 0 < n <= 20_000_000:
            return self.odpoved(400, b'{}')
        telo = self.rfile.read(n)
        try:
            druh = json.loads(telo).get('druh', 'zaznam')
        except Exception:
            return self.odpoved(400, b'{}')
        druh = ''.join(c for c in str(druh) if c.isalnum())[:20] or 'zaznam'
        os.makedirs(os.path.join(PROJEKT, 'ladeni'), exist_ok=True)
        jmeno = f'{druh}-{time.strftime("%Y-%m-%d-%H%M%S")}.json'
        with open(os.path.join(PROJEKT, 'ladeni', jmeno), 'wb') as f:
            f.write(telo)
        self.odpoved(200, json.dumps({'soubor': 'ladeni/' + jmeno}).encode())

    def odpoved(self, kod, telo, typ='application/json; charset=utf-8'):
        self.send_response(kod)
        self.send_header('Content-Type', typ)
        self.send_header('Content-Length', str(len(telo)))
        self.end_headers()
        self.wfile.write(telo)

    def end_headers(self):
        if '?v=' in self.path or '&v=' in self.path:
            self.send_header('Cache-Control', 'public, max-age=31536000, immutable')   # verze v adrese = nová přestavba, nová adresa
        else:
            self.send_header('Cache-Control', 'no-cache')        # všechno ostatní vždy ověřit (304, když se nic nezměnilo)
        super().end_headers()

    def log_message(self, *a):
        pass                                                      # tiché: dlaždic jsou tisíce


http.server.ThreadingHTTPServer.allow_reuse_address = True
srv = http.server.ThreadingHTTPServer(('127.0.0.1', PORT), functools.partial(Handler, directory=KOREN))
print(f'mapa: http://127.0.0.1:{PORT}  ({KOREN})', flush=True)
srv.serve_forever()
