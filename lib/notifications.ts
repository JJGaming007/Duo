export async function requestNotificationPermission() {
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
    if (!('Notification' in window)) return;

    if (Notification.permission !== 'granted') {
        const granted = await requestNotificationPermission();
        if (!granted) return;
    }

    // Try showing notification via Service Worker first (required for mobile PWAs)
    if ('serviceWorker' in navigator) {
        try {
            const registration = await navigator.serviceWorker.ready;
            if (registration && registration.showNotification) {
                await registration.showNotification(title, {
                    ...options,
                    badge: '/icon-192x192.png', // usually a monochrome icon for Android
                    icon: '/icon-192x192.png',
                });
                return;
            }
        } catch (e) {
            console.warn('Failed to show notification via service worker, falling back to Notification API', e);
        }
    }

    // Fallback to standard Notification API (works on Desktop, but often not on mobile PWAs)
    try {
        new Notification(title, options);
    } catch (e) {
        console.error('Failed to show standard notification', e);
    }
}
