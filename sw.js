/* ===========================================================================
 * Figus Change Hub — Service Worker.
 * Cachea el "app shell" para que la PWA se pueda instalar y funcione offline.
 * Estrategia:
 *   - Navegaciones (HTML): network-first con fallback a index cacheado.
 *   - /api/...: siempre a la red (datos frescos; nunca se cachea).
 *   - Resto de estáticos del mismo origen: stale-while-revalidate.
 * =========================================================================== */

const CACHE = 'fch-shell-v1';
const SHELL = [
  '.',
  'index.html',
  'styles.css',
  'data.js',
  'app.js',
  'manifest.webmanifest',
  'icon-192.png',
  'icon-512.png',
  'apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
      .catch(() => {}) // no bloquees la instalación si algún asset falla
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
  if (url.origin !== self.location.origin) return; // dejá pasar lo externo

  // La API siempre va a la red (comunidad = datos vivos).
  if (url.pathname.includes('/api/')) return;

  // Navegaciones: intentamos red y si falla servimos el index cacheado.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put('index.html', copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(req).then((m) => m || caches.match('index.html')))
    );
    return;
  }

  // Estáticos: stale-while-revalidate.
  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.status === 200 && res.type === 'basic') {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
