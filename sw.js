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
  'legal.html',
  'styles.css',
  'data.js',
  'app.js',
  'manifest.webmanifest',
  'icon-192.png',
  'icon-512.png',
  'apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  // Auto-actualización: activamos apenas terminamos de cachear el shell
  // (skipWaiting), sin esperar a que se cierren las pestañas ni un botón. Junto
  // con clients.claim() del activate y la recarga que hace app.js al cambiar de
  // controlador, la app se actualiza sola en la próxima visita. Es seguro porque
  // todo el estado del álbum vive en localStorage (no se pierde al recargar).
  // skipWaiting va primero e incondicional: si lo encadenáramos después de
  // addAll y algún asset fallara, el .catch se lo tragaría y el SW nuevo quedaría
  // "esperando" para siempre (nunca se actualizaría la app).
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE)
      // { cache: 'reload' }: bajamos el shell salteando el cache HTTP del
      // navegador/CDN, así la caché nueva queda con los archivos realmente
      // frescos (evita servir un app.js viejo detrás de Cloudflare).
      .then((cache) => cache.addAll(SHELL.map((u) => new Request(u, { cache: 'reload' }))))
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
