// public/service-worker.js
const CACHE_NAME = 'yandex-tiles-v1';
const TILE_PATTERNS = [
  /\.maps\.yandex\.(ru|net|com)\/.*tiles.*/,
  /core-renderer-tiles.*/,              // fallback pattern
];

self.addEventListener('install', (event) => {
  // Activate immediately – skip waiting
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Clean up old caches if needed
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      )
    )
  );
});

self.addEventListener('fetch', (event) => {
  const url = event.request.url;

  // Only process GET requests that look like tile URLs
  if (event.request.method !== 'GET') return;

  const isTileRequest = TILE_PATTERNS.some(pattern => pattern.test(url));
  if (!isTileRequest) return;

  // Serve from cache first, then network
  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then(response => {
        if (response.ok) {
          const cloned = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, cloned);
          });
        }
        return response;
      });
    })
  );
});
