// Service Worker for Duo
// Web Push notifications (grouped per kind), notification clicks, offline caching.

const CACHE_NAME = 'duo-v8';
const NAV_TIMEOUT_MS = 3000;
const APP_SHELL_URLS = ['/', '/chat', '/prayer', '/manifest.json', '/icons/icon-192x192.png', '/icons/icon-512x512.png', '/icons/badge-96.png'];
const IS_APPLE = /iphone|ipad|ipod|macintosh/i.test(self.navigator.userAgent);

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(APP_SHELL_URLS))
            .catch((err) => console.warn('Cache addAll failed:', err))
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
            .then(() => self.clients.claim())
    );
});

// ------------------------------------------------------------------ Push

self.addEventListener('push', (event) => {
    let data = {};
    try {
        data = event.data ? event.data.json() : {};
    } catch (e) {
        data = { title: 'Duo', body: event.data ? event.data.text() : 'New notification' };
    }
    event.waitUntil(handlePush(data));
});

async function handlePush(data) {
    const kind = data.kind || 'chat';

    // Tell the sender it reached this phone (double grey tick), even with the app closed
    if (kind === 'chat' && data.to) {
        fetch('/api/messages/delivered', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: data.to }),
        }).catch(() => {});
    }
    const tag = data.tag || `duo-${kind}`;
    const url = data.url || '/';
    const title = data.title || 'Duo';
    const body = data.body || '';

    // If the app is open on screen, it already shows an in-app banner.
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const appVisible = windows.some((c) => c.visibilityState === 'visible');

    // Merge with an existing notification of the same kind: "3 new messages"
    const existing = await self.registration.getNotifications({ tag });
    const prev = existing[0] && existing[0].data ? existing[0].data : null;
    const lines = (prev && prev.lines ? prev.lines : []).concat(body).slice(-6);
    const count = (prev && prev.count ? prev.count : 0) + 1;

    // Plain and quiet: the person's name as the title, their latest lines as the
    // body. Several messages collapse into one notification ("Jibin (3)").
    const shownTitle = count > 1 && kind === 'chat' ? `${title} (${count})` : title;
    const shownBody = count > 1 ? lines.slice(kind === 'chat' ? -4 : -3).join('\n') : body;

    const options = {
        body: shownBody,
        icon: data.icon || '/icons/icon-192x192.png', // sender's profile photo
        badge: '/icons/badge-96.png', // monochrome status-bar icon
        tag,
        renotify: true,
        vibrate: kind === 'chat' || kind === 'nudge' ? [80, 40, 80] : [60],
        timestamp: Date.now(),
        data: { url, kind, lines, count },
    };

    if (appVisible) {
        // Safari revokes push permission if a push doesn't show a notification,
        // so on Apple devices show it and close it straight away.
        if (IS_APPLE) {
            await self.registration.showNotification(shownTitle, { ...options, silent: true });
            const shown = await self.registration.getNotifications({ tag });
            shown.forEach((n) => n.close());
        }
        return;
    }

    await self.registration.showNotification(shownTitle, options);
}

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const urlToOpen = new URL((event.notification.data && event.notification.data.url) || '/', self.location.origin).href;

    event.waitUntil((async () => {
        const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        for (const client of windows) {
            if (client.url.startsWith(self.location.origin) && 'focus' in client) {
                await client.focus();
                if (client.url !== urlToOpen && 'navigate' in client) {
                    try { await client.navigate(urlToOpen); } catch (e) { /* uncontrolled client */ }
                }
                return;
            }
        }
        await self.clients.openWindow(urlToOpen);
    })());
});

// ------------------------------------------------------------------ Caching

function putInCache(request, response) {
    if (!response || !response.ok || response.type === 'opaque') return;
    const copy = response.clone();
    caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
}

self.addEventListener('fetch', (event) => {
    const { request } = event;
    if (request.method !== 'GET') return;

    const url = new URL(request.url);

    // Uploaded photos never change: cache-first (also works offline)
    // (Range requests — audio seeking — must reach the server for 206 responses.)
    if (url.origin === self.location.origin && url.pathname.startsWith('/api/images/') && !request.headers.has('range')) {
        event.respondWith(
            caches.match(request).then((cached) =>
                cached || fetch(request).then((res) => { putInCache(request, res); return res; })
            )
        );
        return;
    }

    // API data is cached by the app (SWR); skip API and cross-origin requests
    if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

    // Navigations: network-first, but never wait more than NAV_TIMEOUT_MS
    if (request.mode === 'navigate') {
        event.respondWith((async () => {
            const network = fetch(request).then((res) => { putInCache(request, res); return res; });
            const timeout = new Promise((resolve) => setTimeout(resolve, NAV_TIMEOUT_MS));
            try {
                const res = await Promise.race([network, timeout]);
                if (res) return res;
            } catch (e) { /* offline — fall through to cache */ }
            const cached = (await caches.match(request)) || (await caches.match('/'));
            return cached || network;
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
