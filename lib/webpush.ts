import webpush from 'web-push';
import { db } from '@/lib/db';
import { pushSubscriptions, users } from '@/lib/db/schema';
import { eq, ne } from 'drizzle-orm';

/**
 * web-push requires URL-safe base64 without padding. Env values pasted into
 * dashboards often carry quotes, whitespace, '=' padding or standard base64.
 */
export function cleanVapidKey(key: string | undefined) {
    if (!key) return key;
    return key.trim().replace(/^["']|["']$/g, '').replace(/\s+/g, '').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Lazily configure web-push with VAPID keys (deferred so it doesn't crash at build time)
let vapidConfigured = false;
function ensureVapidConfigured() {
    if (vapidConfigured) return;
    const publicKey = cleanVapidKey(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY);
    const privateKey = cleanVapidKey(process.env.VAPID_PRIVATE_KEY);
    if (!publicKey || !privateKey) {
        console.warn('VAPID keys not set — push notifications disabled');
        return;
    }
    webpush.setVapidDetails(
        'mailto:codetrackduo@example.com',
        publicKey,
        privateKey,
    );
    vapidConfigured = true;
}

/**
 * Send a push notification to all subscriptions EXCEPT the sender's.
 */
export type PushKind = 'chat' | 'prayer' | 'subject' | 'nudge' | 'progress';

export async function sendPushToPartner(
    senderId: string,
    title: string,
    body: string,
    url?: string,
    opts: { kind?: PushKind } = {},
) {
    try {
        ensureVapidConfigured();
        if (!vapidConfigured) return { sent: 0 };

        // Partner's subscriptions + the sender's profile photo (shown as the notification picture)
        const [subscriptions, sender] = await Promise.all([
            db.select().from(pushSubscriptions).where(ne(pushSubscriptions.userId, senderId)),
            db.select({ image: users.image }).from(users).where(eq(users.id, senderId)).catch(() => []),
        ]);

        const kind = opts.kind ?? 'chat';
        const payload = JSON.stringify({
            title,
            body,
            url: url || '/chat',
            kind,
            icon: sender[0]?.image || '/icons/icon-192x192.png',
            // One notification per kind: the service worker merges new ones into it
            tag: `duo-${kind}`,
        });

        const results = await Promise.allSettled(
            subscriptions.map(async (sub) => {
                try {
                    await webpush.sendNotification(
                        {
                            endpoint: sub.endpoint,
                            keys: {
                                p256dh: sub.p256dh,
                                auth: sub.auth,
                            },
                        },
                        payload,
                        { TTL: 60 * 60 * 24, urgency: kind === 'chat' || kind === 'nudge' ? 'high' : 'normal' }
                    );
                } catch (error: any) {
                    // If subscription is expired/invalid (410 Gone or 404), remove it
                    if (error.statusCode === 410 || error.statusCode === 404) {
                        await db.delete(pushSubscriptions)
                            .where(eq(pushSubscriptions.endpoint, sub.endpoint));
                        console.log('Removed expired push subscription:', sub.endpoint.slice(0, 50));
                    } else {
                        console.error('Push send error:', error.statusCode, error.message);
                    }
                }
            })
        );

        return { sent: results.filter(r => r.status === 'fulfilled').length };
    } catch (error) {
        console.error('sendPushToPartner error:', error);
        return { sent: 0 };
    }
}
