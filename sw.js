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
    'manifest.json',
    'assets/icon-192.png',
    'assets/icon-512.png',
    'photo-resize.html',
    'photo-compress.html',
    'signature-resize.html',
    'passport-photo.html',
    'pdf-merge.html',
    'jpg-to-pdf.html',
    'pdf-split.html',
    'pdf-rotate.html',
    'pdf-compress.html',
    'image-crop.html',
    'image-converter.html',
    'document-print-studio.html',
    '20kb-photo.html',
    'privacy-policy.html',
    'terms.html',
    'contact.html',
    'https://cdnjs.cloudflare.com/ajax/libs/cropperjs/1.5.13/cropper.min.css',
    'https://cdnjs.cloudflare.com/ajax/libs/cropperjs/1.5.13/cropper.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js'
];

// Install Service Worker
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return Promise.all(
                ASSETS.map(url => cache.add(url).catch(err => {
                    console.warn(`[SW] Failed to cache asset: ${url}`, err);
                }))
            );
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
                    // Safely return cached index if offline.html is missing
                    return caches.match('index.html');
                }
            });
        })
    );
});