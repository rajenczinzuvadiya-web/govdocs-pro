const CACHE_NAME = 'govdocs-v1';
const ASSETS = [
    'index.html',
    'global.css',
    'app.js',
    'navigator.js',
    'govt_presets.js',
    'image-engine.js',
    'image-uploader.js',
    'image-previewer.js',
    'history-manager.js',
    'pdf-logic.js',
    'robots.txt',
    'sitemap.xml',
    '404.html',
    'offline.html',
    'assets/icon-192.png',
    'https://cdn.tailwindcss.com',
    'https://cdnjs.cloudflare.com/ajax/libs/cropperjs/1.5.13/cropper.min.css',
    'https://cdnjs.cloudflare.com/ajax/libs/cropperjs/1.5.13/cropper.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js'
];

// Install Service Worker
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS);
        })
    );
});

// Activate and Clean Old Caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
            );
        })
    );
});

// Fetch Strategy: Cache Falling Back to Network
self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request).then((response) => {
            return response || fetch(event.request).catch(() => {
                // If request is for a page/document, return offline fallback
                if (event.request.mode === 'navigate') {
                    return caches.match('offline.html');
                }
            });
        })
    );
});