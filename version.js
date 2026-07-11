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

self.APP_VERSION = '1.1.0';
