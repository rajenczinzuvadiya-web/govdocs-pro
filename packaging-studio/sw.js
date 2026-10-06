/* Offline support for Packaging Studio. Scope: this folder only, so it never touches the
   rest of the site. Bump VERSION whenever an app file changes. */
const VERSION = 'ps-v1';
const SHELL = [
  './', 'index.html', 'app.css', 'manifest.webmanifest',
  'js/app.js', 'js/util.js', 'js/color.js', 'js/theme.js', 'js/model.js', 'js/store.js',
  'js/render.js', 'js/letterpad.js', 'js/files.js', 'js/checks.js',
  'vendor/jspdf.umd.min.js', 'icons/icon-192.png', 'icons/icon-512.png',
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('ps-') && k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const fonts = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (url.origin !== location.origin && !fonts) return;
  if (url.origin === location.origin && !url.pathname.startsWith(new URL('./', self.registration.scope).pathname)) return;
  /* Network first so updates arrive; cache as the offline fallback. */
  e.respondWith(fetch(req).then(res => {
    if (res && (res.ok || res.type === 'opaque')) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
    return res;
  }).catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || (req.mode === 'navigate' ? caches.match('index.html') : Response.error()))));
});
