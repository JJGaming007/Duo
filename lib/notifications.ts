// Notifications: service worker registration, Web Push subscription, app badge.

export function registerServiceWorker() {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;

    const register = async () => {
        try {
            await navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' });
        } catch (error) {
            console.error('SW registration failed:', error);
        }
    };

    // This runs from a React effect, which is often AFTER the window 'load' event
    // has already fired — in that case a 'load' listener would never run.
    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register, { once: true });
}

export type NotifState = 'unsupported' | 'needs-install' | 'default' | 'granted' | 'denied';

const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
const isStandalone = () =>
    window.matchMedia?.('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;

export function getNotificationState(): NotifState {
    if (typeof window === 'undefined') return 'unsupported';
    // iOS only supports web push for apps added to the Home Screen
    if (isIOS() && !isStandalone()) return 'needs-install';
    if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) return 'unsupported';
    return Notification.permission as NotifState;
}

/** Must be called from a user gesture (button tap) — required on iOS. */
export async function enableNotifications(userId: string): Promise<NotifState> {
    const state = getNotificationState();
    if (state === 'unsupported' || state === 'needs-install') return state;
    try {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') return permission as NotifState;
        await syncPushSubscription(userId, true);
        return 'granted';
    } catch (e) {
        console.error('Enabling notifications failed:', e);
        return getNotificationState();
    }
}

const SUB_KEY = 'duo-push-sub';

/**
 * If permission is already granted, make sure a push subscription exists and the
 * server knows about it. Only talks to the server when something changed.
 */
export async function syncPushSubscription(userId: string, force = false): Promise<boolean> {
    try {
        if (getNotificationState() !== 'granted') return false;
        const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim().replace(/^["']|["']$/g, '').replace(/\s+/g, '');
        if (!vapidKey) return false;

        const registration = await navigator.serviceWorker.ready;
        let subscription = await registration.pushManager.getSubscription();
        if (!subscription) {
            subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(vapidKey),
            });
        }

        const marker = `${userId}|${subscription.endpoint}`;
        let saved: string | null = null;
        try { saved = localStorage.getItem(SUB_KEY); } catch { }
        if (force || saved !== marker) {
            const res = await fetch('/api/push/subscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, subscription: subscription.toJSON() }),
            });
            if (res.ok) {
                try { localStorage.setItem(SUB_KEY, marker); } catch { }
            }
        }
        return true;
    } catch (error) {
        console.error('Push subscription failed:', error);
        return false;
    }
}

/** Close OS notifications of a kind (e.g. when the chat is opened). */
export async function clearNotifications(kind: string) {
    try {
        if (!('serviceWorker' in navigator)) return;
        const reg = await navigator.serviceWorker.ready;
        const list = await reg.getNotifications({ tag: `duo-${kind}` });
        list.forEach((n) => n.close());
    } catch { }
}

export function setAppBadge(count: number) {
    const nav = navigator as Navigator & { setAppBadge?: (n?: number) => Promise<void>; clearAppBadge?: () => Promise<void> };
    try {
        if (count > 0) nav.setAppBadge?.(count)?.catch(() => { });
        else nav.clearAppBadge?.()?.catch(() => { });
    } catch { }
}

/** Fallback OS notification for when Web Push isn't available. */
export async function showOsNotification(title: string, body: string, kind: string, url: string) {
    try {
        if (!('Notification' in window) || Notification.permission !== 'granted') return;
        const reg = await navigator.serviceWorker.ready;
        await reg.showNotification(title, {
            body,
            icon: '/icons/icon-192x192.png',
            badge: '/icons/badge-96.png',
            tag: `duo-${kind}`,
            data: { url, kind },
        });
    } catch { }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const output = new Uint8Array(new ArrayBuffer(rawData.length));
    for (let i = 0; i < rawData.length; ++i) output[i] = rawData.charCodeAt(i);
    return output;
}
