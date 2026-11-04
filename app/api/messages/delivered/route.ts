import { NextResponse } from 'next/server';
import { and, isNull, ne } from 'drizzle-orm';
import { db } from '@/lib/db';
import { loveNotes } from '@/lib/db/schema';
import { ensureSchema } from '@/lib/db/ensure-schema';
import { pusherServer } from '@/lib/pusher-server';
import { badRequest, isDuoUser, serverError } from '@/lib/server/util';

// POST { userId } — the recipient's device received new messages (double grey tick).
// Called by the app when messages arrive, and by the service worker when a push
// notification lands while the app is closed.
export async function POST(req: Request) {
    try {
        await ensureSchema();
        const { userId } = await req.json();
        if (!isDuoUser(userId)) return badRequest('Invalid user');

        const at = new Date();
        const updated = await db
            .update(loveNotes)
            .set({ deliveredAt: at })
            .where(and(ne(loveNotes.senderId, userId), isNull(loveNotes.deliveredAt), isNull(loveNotes.readAt)))
            .returning({ id: loveNotes.id });

        if (updated.length) {
            await pusherServer
                .trigger('bond-update', 'messages-delivered', { recipientId: userId, at: at.toISOString() })
                .catch(() => {});
        }
        return NextResponse.json({ success: true, count: updated.length });
    } catch (error) {
        return serverError(error);
    }
}
