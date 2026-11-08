import { NextResponse } from 'next/server';
import { currentUser, unauthorized } from '@/lib/auth/server';
import { and, isNull, ne, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { loveNotes } from '@/lib/db/schema';
import { ensureSchema } from '@/lib/db/ensure-schema';
import { pusherServer } from '@/lib/pusher-server';
import { serverError } from '@/lib/server/util';

// Mark every unread message from the partner as read
export async function POST(req: Request) {
    try {
        const me = await currentUser();
        if (!me) return unauthorized();
        await ensureSchema();
        const userId = me;

        const at = new Date();
        const updated = await db
            .update(loveNotes)
            .set({ readAt: at, deliveredAt: sql`coalesce(${loveNotes.deliveredAt}, ${at})` })
            .where(and(ne(loveNotes.senderId, userId), isNull(loveNotes.readAt)))
            .returning({ id: loveNotes.id });

        if (updated.length) {
            await pusherServer
                .trigger('bond-update', 'messages-read', { readerId: userId, at: at.toISOString() })
                .catch(() => {});
        }
        return NextResponse.json({ success: true, count: updated.length });
    } catch (error) {
        return serverError(error);
    }
}
