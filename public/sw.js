// Service Worker for CodeTrack Duo PWA
// Handles Web Push notifications and notification clicks

const CACHE_NAME = 'codetrack-duo-v1';

// Install — activate immediately
self.addEventListener('install', (event) => {
    self.skipWaiting();
});

// Activate — claim clients immediately
self.addEventListener('activate', (event) => {
    event.waitUntil(clients.claim());
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
        data: {
            url: data.url || '/bond',
        },
    };

    event.waitUntil(
        self.registration.showNotification(title, options)
    );
});

// Handle notification click — open/focus the app
self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    const urlToOpen = event.notification.data?.url || '/bond';

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

// Simple fetch pass-through (no aggressive caching)
self.addEventListener('fetch', (event) => {
    return;
});
