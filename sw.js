/* ===========================================================================
 * Figus Change Hub — Service Worker.
 * Cachea el "app shell" para que la PWA se pueda instalar y funcione offline.
 * Estrategia:
 *   - Navegaciones (HTML): network-first con fallback a index cacheado.
 *   - /api/...: siempre a la red (datos frescos; nunca se cachea).
 *   - Resto de estáticos del mismo origen: stale-while-revalidate.
 * =========================================================================== */

// La versión (fuente única) está escrita a mano en el pie de index.html y llega
// hasta acá por la URL de registro (?v=…), que arma app.js. Define el nombre de
// la caché: al subirla, el `activate` de abajo borra las cachés viejas y la app
// se actualiza.
const APP_VERSION = new URL(self.location).searchParams.get('v') || '0';
const CACHE = 'fch-shell-v' + APP_VERSION;
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
  // Cacheamos el "app shell". A propósito NO llamamos skipWaiting acá: el SW
  // nuevo queda "esperando" y la página muestra el botón "Actualizar". Recién
  // cuando la persona lo toca, la página nos manda {type:'SKIP_WAITING'} (ver el
  // listener de 'message' de abajo) y ahí sí activamos. Es seguro recargar
  // porque todo el estado del álbum vive en localStorage.
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .catch(() => {}) // no bloquees la instalación si algún asset falla
  );
});

// La página nos pide activar la versión nueva cuando se toca "Actualizar".
// Al activarse (clients.claim del 'activate'), cambia el controlador y app.js
// recarga la página una vez para servir los assets frescos.
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
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
