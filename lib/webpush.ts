import webpush from 'web-push';
import { db } from '@/lib/db';
import { pushSubscriptions, users } from '@/lib/db/schema';
import { eq, inArray, ne } from 'drizzle-orm';
import { pusherServer } from '@/lib/pusher-server';

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

const PRESENCE_CHANNEL = 'presence-duo';
// The app sends a heartbeat every 30s while on screen
const FRESH_MS = 75_000;

/**
 * People who have the app open on screen right now. Each phone is in the
 * presence channel only while the app is visible (lib/presence.ts), and must
 * also have sent a recent heartbeat, in case a dropped connection hasn't been
 * noticed yet. They already get the message live plus an in-app banner, so
 * they don't need a push. (iOS can't hide a push that arrives while the app is
 * open: it shows it anyway, so it's better not to send one.)
 * Any failure counts as "not on screen", so a push is never lost because of it.
 */
async function onScreen(userIds: string[]): Promise<Set<string>> {
    if (!userIds.length) return new Set();
    try {
        const res = await Promise.race([
            pusherServer.get({ path: `/channels/${PRESENCE_CHANNEL}/users` }),
            new Promise<never>((_, reject) => setTimeout(() => reject(new Error('presence timeout')), 1500)),
        ]);
        if (!res.ok) return new Set();
        const { users: members = [] } = (await res.json()) as { users?: { id: string }[] };
        const present = userIds.filter((id) => members.some((m) => m.id === id));
        if (!present.length) return new Set();
        const rows = await db.select({ id: users.id, lastSeenAt: users.lastSeenAt }).from(users).where(inArray(users.id, present));
        return new Set(rows.filter((r) => r.lastSeenAt && Date.now() - new Date(r.lastSeenAt).getTime() < FRESH_MS).map((r) => r.id));
    } catch (e) {
        console.warn('Presence check failed, sending push anyway:', e);
        return new Set();
    }
}

/**
 * Send a push notification to all subscriptions EXCEPT the sender's, skipping
 * anyone who has the app open on screen.
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

        const visible = await onScreen([...new Set(subscriptions.map((s) => s.userId))]);
        const targets = subscriptions.filter((s) => !visible.has(s.userId));
        if (!targets.length) return { sent: 0, skipped: subscriptions.length };

        const kind = opts.kind ?? 'chat';
        const payloadFor = (to: string) => JSON.stringify({
            to,
            title,
            body,
            url: url || '/chat',
            kind,
            icon: sender[0]?.image || '/icons/icon-192x192.png',
            // One notification per kind: the service worker merges new ones into it
            tag: `duo-${kind}`,
        });

        const results = await Promise.allSettled(
            targets.map(async (sub) => {
                try {
                    await webpush.sendNotification(
                        {
                            endpoint: sub.endpoint,
                            keys: {
                                p256dh: sub.p256dh,
                                auth: sub.auth,
                            },
                        },
                        payloadFor(sub.userId),
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
