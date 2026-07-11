// Basic service worker: caches map tiles and app shell for offline use
const CACHE = 'raasta-v1';
const TILE_CACHE = 'raasta-tiles-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  // Cache CartoDB map tiles
  if (url.hostname.endsWith('.basemaps.cartocdn.com')) {
    event.respondWith(
      caches.open(TILE_CACHE).then(async (cache) => {
        const cached = await cache.match(event.request);
        if (cached) return cached;
        try {
          const resp = await fetch(event.request);
          if (resp.ok) cache.put(event.request, resp.clone());
          return resp;
        } catch (e) {
          return cached || new Response('', { status: 504 });
        }
      })
    );
    return;
  }
  // Cache leaflet assets
  if (url.hostname === 'unpkg.com' && url.pathname.includes('leaflet')) {
    event.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const cached = await cache.match(event.request);
        if (cached) return cached;
        try {
          const resp = await fetch(event.request);
          if (resp.ok) cache.put(event.request, resp.clone());
          return resp;
        } catch {
          return cached || new Response('', { status: 504 });
        }
      })
    );
    return;
  }
});
