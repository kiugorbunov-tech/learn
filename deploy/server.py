"""Сервер обучающих приложений: отдаёт сайт (как на GitHub Pages) и хранит общий прогресс.

Запуск в фоне: pythonw server.py   (порт 8090)
Сайт берётся из папки ..\\learn-site, прогресс хранится в папке data рядом с этим файлом.
Снаружи доступ идёт через VPS (поддомен с https и паролем), сюда приходят уже проверенные запросы.
"""
import json
import os
import re
import sys
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

PORT = int(os.environ.get("LEARN_PORT", "8090"))
HERE = Path(__file__).resolve().parent
SITE = Path(os.environ.get("LEARN_SITE") or (HERE.parent / "learn-site")).resolve()
DATA = Path(os.environ.get("LEARN_DATA") or (HERE / "data"))
DATA.mkdir(parents=True, exist_ok=True)
APP_RE = re.compile(r"^[a-z0-9_-]{1,32}$")
MAX_BODY = 2 * 1024 * 1024
# отдаём только файлы сайта, ничего служебного (.git, скрипты и т. п.)
ALLOWED = {".html", ".js", ".json", ".png", ".onnx", ".txt", ".spm"}
lock = threading.Lock()


class Handler(SimpleHTTPRequestHandler):
    extensions_map = {**SimpleHTTPRequestHandler.extensions_map,
                      ".js": "text/javascript", ".json": "application/json", ".onnx": "application/octet-stream"}

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(SITE), **kwargs)

    def log_message(self, fmt, *args):  # работаем в фоне без консоли
        pass

    def end_headers(self):
        if self.path.split("?")[0].endswith(("sw.js", ".html")) or self.path.split("?")[0] == "/":
            self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    def _json(self, code, obj):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _app(self):
        m = re.match(r"^/api/progress/([^/?]+)", self.path)
        return m.group(1) if m and APP_RE.match(m.group(1)) else None

    def do_GET(self):
        if self.path.startswith("/api/progress/"):
            app = self._app()
            if not app:
                return self._json(400, {"error": "bad app name"})
            path = DATA / f"{app}.json"
            with lock:
                data = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}
            return self._json(200, data)
        clean = self.path.split("?")[0]
        if clean in ("/", ""):
            return super().do_GET()
        if "/." in clean or Path(clean).suffix.lower() not in ALLOWED:
            return self._json(404, {"error": "not found"})
        return super().do_GET()

    do_HEAD = do_GET

    def do_PUT(self):
        app = self._app()
        if not app:
            return self._json(400, {"error": "bad app name"})
        size = int(self.headers.get("Content-Length") or 0)
        if size <= 0 or size > MAX_BODY:
            return self._json(413, {"error": "bad size"})
        try:
            data = json.loads(self.rfile.read(size).decode("utf-8"))
            if not isinstance(data, dict):
                raise ValueError
        except ValueError:
            return self._json(400, {"error": "bad json"})
        path = DATA / f"{app}.json"
        with lock:
            tmp = path.with_suffix(".tmp")
            tmp.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
            tmp.replace(path)   # атомарная замена: файл не побьётся при сбое питания
        return self._json(200, {"ok": True})


def main():
    try:
        server = ThreadingHTTPServer((os.environ.get("LEARN_HOST", "0.0.0.0"), PORT), Handler)
    except OSError:
        sys.exit(0)   # уже запущен
    server.serve_forever()


if __name__ == "__main__":
    main()
