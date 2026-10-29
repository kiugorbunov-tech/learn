// Работа без интернета: после первого открытия все файлы приложений лежат в телефоне.
// При каждом открытии показываем сохранённую версию сразу и тихо проверяем обновление.
const CACHE = "learn-20261029-onevoice1";
const FILES = [
  "english-voice-worker.js?v=natural1", "audio/english/silence.wav",
  "./", "index.html", "english.html", "course.html", "books.html", "manifest-books.json", "icon-books-180.png", "icon-books-192.png", "icon-books-512.png",
  "manifest-english.json", "manifest-course.json",
  "icon-english-180.png", "icon-english-192.png", "icon-english-512.png",
  "icon-course-180.png", "icon-course-192.png", "icon-course-512.png"
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => /^learn-\d/.test(k) && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const isFont = url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com" || url.hostname === "cdn.jsdelivr.net";
  if (url.origin !== location.origin && !isFont) return;
  if (url.origin === location.origin && url.pathname.includes('/vendor/neural/')) {
    event.respondWith((async () => {
      const cache = await caches.open('english-voice-piper-v1');
      const saved = await cache.match(req);
      if (saved) return saved;
      const response = await fetch(req);
      if (response.ok) event.waitUntil(cache.put(req, response.clone()).catch(() => {}));
      return response;
    })());
    return;
  }
  if (url.pathname.includes("/models/")) return;   // модели перевода кэширует сама библиотека
  if (url.origin === location.origin && url.pathname.includes('/audio/english/')) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      let res = await cache.match(url.href);
      if (!res) {
        res = await fetch(new Request(url.href, { credentials: 'same-origin' }));
        if (!res.ok) return res;
        await cache.put(url.href, res.clone());
      }
      const range = req.headers.get('Range');
      if (!range) return res;
      const match = /^bytes=(\d*)-(\d*)$/.exec(range);
      if (!match || (!match[1] && !match[2])) return res;
      const bytes = await res.arrayBuffer(), size = bytes.byteLength;
      const start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]));
      const end = match[1] ? (match[2] ? Math.min(Number(match[2]), size - 1) : size - 1) : size - 1;
      if (start >= size || start > end) return new Response(null, { status: 416, headers: { 'Content-Range': 'bytes */' + size } });
      return new Response(bytes.slice(start, end + 1), { status: 206, headers: {
        'Content-Type': res.headers.get('Content-Type') || 'audio/mpeg', 'Accept-Ranges': 'bytes',
        'Content-Range': 'bytes ' + start + '-' + end + '/' + size,
        'Content-Length': String(end - start + 1)
      } });
    })());
    return;
  }
  if (url.pathname.includes("/audio/")) return;    // аудиокниги: Safari сам запрашивает файл кусками
  event.respondWith(
    caches.open(CACHE).then(async cache => {
      const cached = await cache.match(req, { ignoreSearch: !isFont });
      const network = fetch(req).then(res => {
        if (res && (res.ok || res.type === "opaque")) cache.put(req, res.clone());
        return res;
      }).catch(() => cached);
      return cached || network;
    })
  );
});
