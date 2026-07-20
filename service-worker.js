const CACHE_NAME = 'workout-tracker-v6';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './js/app.js',
  './js/config.js',
  './js/supabaseClient.js',
  './js/db.js',
  './js/timer.js',
  './js/today.js',
  './js/history.js',
  './js/progress.js',
  './js/body.js',
  './js/manage.js',
  './js/exerciseHistory.js',
  './js/export.js',
  './js/theme.js',
  './icons/icon-192.png?v=3',
  './icons/icon-512.png?v=3',
  './icons/apple-touch-icon.png?v=3',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Only cache same-origin app-shell requests. Supabase and CDN requests
  // (different origin) go straight to the network.
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return response;
        })
        .catch(() => cached);
    })
  );
});
