const CACHE_NAME = 'places-app-v1';
const urlsToCache = [
    '/',
    '/index.html',
    '/style.css',
    '/app.js',
    '/manifest.json'
];

// Install event - cache resources
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Opened cache');
                return cache.addAll(urlsToCache);
            })
    );
});

// Fetch event - serve from cache, fallback to network
// IMPORTANT: Do NOT cache Firebase auth or API requests!
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Skip caching for:
    // 1. Firebase authentication requests
    // 2. Firebase API requests
    // 3. Google accounts (authentication)
    if (url.hostname.includes('firebase') ||
        url.hostname.includes('firebaseapp.com') ||
        url.hostname.includes('googleapis.com') ||
        url.hostname.includes('google.com') ||
        url.pathname.includes('__/auth/') ||
        event.request.method !== 'GET') {
        // Always fetch from network for auth requests
        event.respondWith(fetch(event.request));
        return;
    }

    // For everything else, try cache first
    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                if (response) {
                    return response;
                }
                return fetch(event.request);
            })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    const cacheWhitelist = [CACHE_NAME];
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheWhitelist.indexOf(cacheName) === -1) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});
