/* ===========================================================================
 * Figus Change Hub — versión de la app.
 * Fuente única de la versión (semver). La usan:
 *   - la página, como `window.APP_VERSION`, para mostrarla en el pie; y
 *   - el service worker, como `self.APP_VERSION` (vía `importScripts`), para
 *     nombrar la caché — así cada versión nueva invalida la caché anterior y
 *     la PWA se actualiza en vez de quedar pegada a la primera instalación.
 *
 * Al publicar cambios, subí este número (mayor.menor.parche). En un contexto
 * de ventana `self` es `window`, y en el service worker es el scope global;
 * por eso la misma línea sirve para los dos.
 * =========================================================================== */

self.APP_VERSION = '1.1.1';

// En la página (no en el service worker) mostramos la versión en el pie apenas
// se carga este archivo, sin depender de app.js. Como version.js siempre se
// sirve fresco, la versión aparece aunque el resto del bundle esté cacheado.
if (typeof document !== 'undefined') {
  const showVersion = () => {
    const el = document.getElementById('app-version');
    if (el) el.textContent = 'v' + self.APP_VERSION;
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', showVersion);
  } else {
    showVersion();
  }
}
