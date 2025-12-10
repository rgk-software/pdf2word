const CACHE_NAME = 'pdf-converter-v1';
const ASSETS = [
    '/',
    '/index.html',
    '/style.css',
    '/script.js',
    'https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;700&display=swap',
    'https://cdnjs.cloudflare.com/ajax/libs/feather-icons/4.29.0/feather.min.js'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(ASSETS))
    );
});

self.addEventListener('fetch', (event) => {
    // Network first, fall back to cache strategy for this app
    // because conversion requires network.
    event.respondWith(
        fetch(event.request)
            .catch(() => caches.match(event.request))
    );
});
