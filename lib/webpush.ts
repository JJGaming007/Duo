import webpush from 'web-push';
import { db } from '@/lib/db';
import { pushSubscriptions } from '@/lib/db/schema';
import { eq, ne } from 'drizzle-orm';

// Lazily configure web-push with VAPID keys (deferred so it doesn't crash at build time)
let vapidConfigured = false;
function ensureVapidConfigured() {
    if (vapidConfigured) return;
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
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
export async function sendPushToPartner(senderId: string, title: string, body: string, url?: string) {
    try {
        ensureVapidConfigured();
        if (!vapidConfigured) return { sent: 0 };

        // Get all subscriptions that are NOT the sender's
        const subscriptions = await db.select()
            .from(pushSubscriptions)
            .where(ne(pushSubscriptions.userId, senderId));

        const payload = JSON.stringify({
            title,
            body,
            url: url || '/bond',
            tag: `${title}-${Date.now()}`,
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
                        payload
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
