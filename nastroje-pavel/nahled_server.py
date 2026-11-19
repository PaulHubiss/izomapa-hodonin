"""Náhledový server mapy (místo `npm run nahled`): stejné jako python http.server, ale prohlížeči říká,
ať si stránku a data po každé přestavbě ověří → stačí obyčejné obnovení, ne ⌘⇧R.

    python3 nastroje-pavel/nahled_server.py          # http://127.0.0.1:8000, složka site/

Proč: python http.server neposílá Cache-Control, prohlížeč si pak index.html a tiles.json (seznam čtverců
a verze dlaždic) podrží podle vlastního odhadu a po přestavbě ukazuje starou mapu (2026-11-13).
Co má v adrese ?v=<verze> (dlaždice, náhledy), smí prohlížeč držet rok: přestavba změní verzi, tedy i adresu.
Jen standardní knihovna, aby šel spustit i bez .venv (autostart).

/api/<jméno>?… obslouží jako Cloudflare: spustí functions/api/<jméno>.js přes nastroje-pavel/api_lokalne.mjs
(program DK, hasiči, výluky; letadla taky). Odpověď drží v paměti tak dlouho, jak říká její Cache-Control (2026-11-15).
"""
import functools, http.server, json, os, shutil, subprocess, sys, time, urllib.parse

PROJEKT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KOREN = os.path.join(PROJEKT, 'site')
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
NODE = shutil.which('node') or next((n for n in ('/opt/homebrew/bin/node', '/usr/local/bin/node') if os.path.exists(n)), None)   # autostart nemá PATH z terminálu
TTL = {'program': 3600, 'vyluky': 600, 'hasici': 60, 'flights': 15}   # s, stejně jako Cache-Control funkcí na Cloudflaru
API = {}   # (jméno, dotaz) → (čas, JSON)


class Handler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        u = urllib.parse.urlsplit(self.path)
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

    def odpoved(self, kod, telo):
        self.send_response(kod)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
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
