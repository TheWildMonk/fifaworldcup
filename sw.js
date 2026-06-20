// Service worker for the FIFA World Cup 2026 Bracket Tracker.
// Precaches the app shell so it works fully offline; runtime-caches fonts.
const CACHE = 'wc2026-tracker-v3';

const APP_SHELL = [
  './home.html',
  './manifest.json',
  './results.json',
  './trophy.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // results.json must stay fresh: network-first, fall back to cache when offline.
  // The app appends a ?t= cache-buster, so cache under a query-less key to keep
  // the offline fallback findable.
  if (url.pathname.endsWith('results.json')) {
    const cacheKey = new Request(url.origin + url.pathname);
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(cacheKey, copy));
          }
          return res;
        })
        .catch(() => caches.match(cacheKey))
    );
    return;
  }

  // App HTML: network-first so code/UI updates ship promptly, fall back to cache offline.
  if (req.mode === 'navigate' || url.pathname.endsWith('home.html') || url.pathname.endsWith('/')) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => caches.match(req).then((c) => c || caches.match('./home.html')))
    );
    return;
  }

  // Cache-first, then network; cache successful responses (incl. Google Fonts) for offline use.
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req)
        .then((res) => {
          if (res && (res.ok || res.type === 'opaque')) {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
    })
  );
});
