// Service Worker for CodeTrack Duo PWA
// Handles Web Push notifications, notification clicks, and offline caching

const CACHE_NAME = 'codetrack-duo-v3';
const NAV_TIMEOUT_MS = 3000;
const APP_SHELL_URLS = [
    '/dashboard',
    '/manifest.json',
    '/icons/icon-192x192.png',
    '/icons/icon-512x512.png',
];

// Install — cache a minimal app shell and activate immediately
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(APP_SHELL_URLS))
            .catch((err) => console.warn('Cache addAll failed:', err))
    );
    self.skipWaiting();
});

// Activate — clean old caches, claim clients immediately
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keyList) => {
            return Promise.all(
                keyList
                    .filter((key) => key !== CACHE_NAME)
                    .map((key) => caches.delete(key))
            );
        }).then(() => clients.claim())
    );
});

// Handle incoming push notifications (works even when app is closed!)
self.addEventListener('push', (event) => {
    let data = {};
    try {
        data = event.data ? event.data.json() : {};
    } catch (e) {
        data = { title: 'CodeTrack Duo', body: event.data ? event.data.text() : 'New notification' };
    }

    const title = data.title || 'CodeTrack Duo';
    const options = {
        body: data.body || 'You have a new notification',
        icon: '/icons/icon-192x192.png',
        badge: '/icons/icon-192x192.png',
        vibrate: [200, 100, 200],
        tag: data.tag || 'codetrack-' + Date.now(),
        renotify: true,
        requireInteraction: false,
        actions: [
            { action: 'open', title: 'Open' },
        ],
        data: {
            url: data.url || '/bond',
        },
    };

    // Check if any visible client (tab) is already focused — skip notification if so
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            const isAppFocused = clientList.some(
                (client) => client.url.includes(self.location.origin) && client.visibilityState === 'visible'
            );
            // If app is focused, the Pusher handler already shows in-app notifications
            if (isAppFocused) return;
            return self.registration.showNotification(title, options);
        })
    );
});

// Handle notification click — open/focus the app
self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    const urlToOpen = event.notification.data?.url || '/bond';

    // Handle action buttons
    if (event.action === 'open') {
        // Default open behavior below
    }

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            // If the app is already open, focus it and navigate
            for (const client of clientList) {
                if (client.url.includes(self.location.origin) && 'focus' in client) {
                    client.navigate(urlToOpen);
                    return client.focus();
                }
            }
            // Otherwise open a new window
            return clients.openWindow(urlToOpen);
        })
    );
});

function putInCache(request, response) {
    if (!response || !response.ok || response.type === 'opaque') return;
    const copy = response.clone();
    caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
}

self.addEventListener('fetch', (event) => {
    const { request } = event;
    if (request.method !== 'GET') return;

    const url = new URL(request.url);
    // API data is cached by the app (SWR); skip API and cross-origin requests
    if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

    // Navigations: network-first, but never wait more than NAV_TIMEOUT_MS
    // before falling back to the cached page (avoids long blank screens on bad networks)
    if (request.mode === 'navigate') {
        event.respondWith((async () => {
            const network = fetch(request).then((res) => { putInCache(request, res); return res; });
            const timeout = new Promise((resolve) => setTimeout(resolve, NAV_TIMEOUT_MS));
            try {
                const res = await Promise.race([network, timeout]);
                if (res) return res;
            } catch (e) { /* offline — fall through to cache */ }
            const cached = (await caches.match(request)) || (await caches.match('/dashboard'));
            return cached || network; // nothing cached: keep waiting for the network
        })());
        return;
    }

    // Hashed build assets never change: cache-first
    if (url.pathname.startsWith('/_next/static/')) {
        event.respondWith(
            caches.match(request).then((cached) =>
                cached || fetch(request).then((res) => { putInCache(request, res); return res; })
            )
        );
        return;
    }

    // Other static files (icons, manifest, fonts): stale-while-revalidate
    if (/\.(png|jpg|jpeg|svg|ico|webp|woff2?|json)$/.test(url.pathname)) {
        event.respondWith(
            caches.match(request).then((cached) => {
                const network = fetch(request).then((res) => { putInCache(request, res); return res; }).catch(() => cached);
                return cached || network;
            })
        );
    }
});
