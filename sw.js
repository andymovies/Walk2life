// Service worker: guarda la app para usarla sin conexión.
// Al cambiar cualquier archivo de la app, sube VERSION para que los móviles se actualicen.
const VERSION = 'v2';
const APP = 'app-' + VERSION;
const ARCHIVOS = [
  './', 'index.html', 'app.css', 'manifest.webmanifest',
  'js/app.js', 'js/ui.js', 'js/i18n.js', 'js/db.js', 'js/core.js', 'js/media.js', 'js/graficos.js', 'js/entregables.js', 'js/autor.js',
  'vendor/mediabunny.mjs', 'vendor/fflate.mjs',
  'fonts/jost-latin-200-normal.woff2', 'fonts/jost-latin-300-normal.woff2', 'fonts/jost-latin-400-normal.woff2', 'fonts/courier-prime-latin-400-normal.woff2',
  'icons/icono.svg', 'icons/icono-180.png', 'icons/icono-192.png', 'icons/icono-512.png',
  'rutas/index.json', 'rutas/gr55/ruta.json',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(APP).then((c) => c.addAll(ARCHIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((ks) => Promise.all(ks.filter((k) => k.startsWith('app-') && k !== APP).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  const url = new URL(req.url);
  // el contenido de las rutas (ruta.json, index.json): primero red, para recibir novedades; si no hay, la copia guardada
  if (url.pathname.endsWith('.json')) {
    e.respondWith(fetch(req).then((r) => {
      const copia = r.clone();
      caches.open(APP).then((c) => c.put(req, copia));
      return r;
    }).catch(() => caches.match(req, { ignoreSearch: true })));
    return;
  }
  // todo lo demás: primero la copia guardada (app y medios descargados)
  e.respondWith(caches.match(req, { ignoreSearch: true }).then((r) => r || fetch(req)));
});
