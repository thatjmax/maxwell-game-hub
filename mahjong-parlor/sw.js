// Offline cache for Mahjong Parlor. Only same-origin GET requests are handled.
const CACHE = 'mahjong-parlor-v3';
const ASSETS = ['./', './index.html', './app.js', './styles.css', './manifest.webmanifest',
  './icon.svg', './icon-192.png', './icon-512.png', './icon-maskable-512.png',
  './games/klondike.js', './games/gin.js', './games/dominoes.js', './games/checkers.js', './games/dice.js', './games/words.js'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});
// Serve from cache instantly; refresh the cache in the background so updates
// arrive on the next launch.
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(caches.open(CACHE).then((cache) =>
    cache.match(req, { ignoreSearch: true }).then((hit) => {
      const net = fetch(req).then((res) => {
        if (res && res.ok && res.type === 'basic') cache.put(req, res.clone());
        return res;
      }).catch(() => hit);
      return hit || net;
    })));
});
