import webpush from 'web-push';
import { db } from '@/lib/db';
import { pushSubscriptions } from '@/lib/db/schema';
import { eq, ne } from 'drizzle-orm';

// Configure web-push with VAPID keys
webpush.setVapidDetails(
    'mailto:codetrackduo@example.com', // change to your email
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
);

/**
 * Send a push notification to all subscriptions EXCEPT the sender's.
 */
export async function sendPushToPartner(senderId: string, title: string, body: string, url?: string) {
    try {
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
