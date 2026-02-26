// Service Worker for CodeTrack Duo PWA
// Handles Web Push notifications, notification clicks, and offline caching

const CACHE_NAME = 'codetrack-duo-v2';
const APP_SHELL_URLS = [
    '/',
    '/dashboard',
    '/bond',
    '/tracker',
    '/analytics',
    '/log',
    '/playground',
    '/icons/icon-192x192.png',
    '/icons/icon-512x512.png',
];

// Install — cache app shell and activate immediately
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(APP_SHELL_URLS))
            .catch((err) => console.warn('Cache addAll failed (dev mode):', err))
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

// Network-first fetch strategy with cache fallback for navigation requests
self.addEventListener('fetch', (event) => {
    // Only handle GET requests
    if (event.request.method !== 'GET') return;

    // Skip API calls and Pusher/external requests
    const url = new URL(event.request.url);
    if (url.pathname.startsWith('/api/') || url.origin !== self.location.origin) return;

    // For navigation requests: network-first with cache fallback
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request)
                .then((response) => {
                    // Cache the fresh response
                    const responseToCache = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseToCache);
                    });
                    return response;
                })
                .catch(() => {
                    // Offline fallback from cache
                    return caches.match(event.request).then((cached) => {
                        return cached || caches.match('/');
                    });
                })
        );
        return;
    }

    // For static assets: cache-first
    if (url.pathname.match(/\.(js|css|png|jpg|svg|ico|woff2?)$/)) {
        event.respondWith(
            caches.match(event.request).then((cached) => {
                if (cached) return cached;
                return fetch(event.request).then((response) => {
                    const responseToCache = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseToCache);
                    });
                    return response;
                });
            })
        );
    }
});
