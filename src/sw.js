const CACHE = 'rutas-managua-__VERSION__';
const ASSETS = /*__ASSETS__*/[];
const urls = new Set(ASSETS.map(p => new URL(p, self.registration.scope).href));
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)));
  // Updates wait for all old clients to close, avoiding mixed dataset/code versions.
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key.startsWith('rutas-managua-') && key !== CACHE) await caches.delete(key);
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;
  // No interception or prefetch of OSM tiles / geocoding, including future proxies.
  const index = new URL('./index.html', self.registration.scope).href;
  const root = self.registration.scope;
  // Query parameters on an installed/bookmarked start URL must not bypass the
  // offline shell. Restrict this normalization to the two actual entry paths.
  const entryPath = url.pathname === new URL(root).pathname || url.pathname === new URL(index).pathname;
  const key = event.request.mode === 'navigate' && entryPath ? index : url.href;
  if (!urls.has(key)) return;
  event.respondWith(caches.open(CACHE).then(async cache => (await cache.match(key)) || fetch(event.request)));
});
