// Register service worker on app load
export function registerServiceWorker() {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;

    const register = async () => {
        try {
            const registration = await navigator.serviceWorker.register('/sw.js', {
                scope: '/',
                updateViaCache: 'none',
            });
            console.log('SW registered:', registration.scope);
        } catch (error) {
            console.error('SW registration failed:', error);
        }
    };

    // This runs from a React effect, which is often AFTER the window 'load' event
    // has already fired — in that case a 'load' listener would never run.
    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register, { once: true });
}

export async function requestNotificationPermission() {
    if (typeof window === 'undefined') return false;
    if (!('Notification' in window)) return false;
    if (Notification.permission === 'granted') return true;

    try {
        const permission = await Notification.requestPermission();
        return permission === 'granted';
    } catch (e) {
        console.error("Error requesting notification permission:", e);
        return false;
    }
}

export async function showOsNotification(title: string, options?: NotificationOptions) {
    if (typeof window === 'undefined') return;
    if (!('Notification' in window)) return;

    if (Notification.permission !== 'granted') {
        const granted = await requestNotificationPermission();
        if (!granted) return;
    }

    const notifOptions: NotificationOptions = {
        ...options,
        icon: '/icons/icon-192x192.png',
        badge: '/icons/icon-192x192.png',
    };

    // Try showing notification via Service Worker (required for mobile PWAs)
    if ('serviceWorker' in navigator) {
        try {
            const registration = await navigator.serviceWorker.ready;
            if (registration && registration.showNotification) {
                await registration.showNotification(title, {
                    ...notifOptions,
                    vibrate: [200, 100, 200],
                    tag: title,
                    renotify: true,
                } as any);
                return;
            }
        } catch (e) {
            console.warn('SW notification failed, falling back:', e);
        }
    }

    // Fallback to standard Notification API (Desktop)
    try {
        new Notification(title, notifOptions);
    } catch (e) {
        console.error('Standard notification failed:', e);
    }
}
