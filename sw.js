// ઑફલાઇન: એપ ફોનમાં સેવ રહે, અને છેલ્લી ડાઉનલોડ થયેલી માહિતી નેટ વગર પણ દેખાય.
// કોડ બદલો ત્યારે VERSION વધારવું, એટલે યુઝર્સના ફોનમાં નવું વર્ઝન આવે.
const VERSION = 'v6';
const SHELL = `shell-${VERSION}`;
const DATA = 'data';

const SHELL_FILES = [
  './',
  'index.html',
  'css/app.css',
  'js/app.js',
  'js/config.js',
  'js/options.js',
  'js/store.js',
  'js/match.js',
  'js/speak.js',
  'js/icons.js',
  'fonts/hind-vadodara-gujarati-400-normal.woff2',
  'fonts/hind-vadodara-gujarati-600-normal.woff2',
  'fonts/hind-vadodara-gujarati-700-normal.woff2',
  'fonts/hind-vadodara-latin-400-normal.woff2',
  'fonts/hind-vadodara-latin-600-normal.woff2',
  'fonts/hind-vadodara-latin-700-normal.woff2',
  'manifest.json',
  'privacy.html',
  'terms.html',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL).then((c) => c.addAll(SHELL_FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== SHELL && k !== DATA).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  // યોજનાનો ડેટા: પહેલાં નેટ (તાજી માહિતી). નેટ ધીમું હોય તો 4 સેકન્ડ પછી ફોનમાં સેવ કરેલો બતાવવો,
  // અને નવો ડેટા પાછળથી સેવ થતો રહે (આવતી વખતે દેખાય).
  if (url.pathname.includes('/data/')) {
    const network = fetch(req).then((res) => {
      if (res.ok) {
        const copy = res.clone();
        caches.open(DATA).then((c) => c.put(req, copy));
      }
      return res;
    });
    event.waitUntil(network.catch(() => {}));
    event.respondWith(
      caches.match(req, { ignoreSearch: true }).then((cached) => {
        if (!cached) return network;
        const slow = new Promise((resolve) => setTimeout(() => resolve(cached), 4000));
        return Promise.race([network.catch(() => cached), slow]);
      })
    );
    return;
  }

  // બાકીની એપ: પહેલાં ફોનમાંથી (ઝડપી)
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then(
      (hit) => hit || fetch(req).catch(() => (req.mode === 'navigate' ? caches.match('index.html') : undefined))
    )
  );
});

// છેલ્લી તારીખના નોટિફિકેશન પર ટેપ કરો એટલે એ યોજના ખુલે
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || './';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ('focus' in client) {
          client.navigate(target);
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    })
  );
});
