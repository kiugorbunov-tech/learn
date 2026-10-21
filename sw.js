// Работа без интернета: после первого открытия все файлы приложений лежат в телефоне.
// При каждом открытии показываем сохранённую версию сразу и тихо проверяем обновление.
const CACHE = "learn-20261021-1742";
const FILES = [
  "./", "index.html", "english.html", "course.html",
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
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const isFont = url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com" || url.hostname === "cdn.jsdelivr.net";
  if (url.origin !== location.origin && !isFont) return;
  if (url.pathname.includes("/models/")) return;   // модели перевода кэширует сама библиотека
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
