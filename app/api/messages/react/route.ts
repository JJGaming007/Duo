import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { loveNotes } from '@/lib/db/schema';
import { ensureSchema } from '@/lib/db/ensure-schema';
import { pusherServer } from '@/lib/pusher-server';
import { badRequest, isDuoUser, serverError } from '@/lib/server/util';

// Toggle the caller's reaction on a message (one reaction per person)
export async function POST(req: Request) {
    try {
        await ensureSchema();
        const { userId, messageId, emoji } = await req.json();
        if (!isDuoUser(userId) || !messageId || typeof emoji !== 'string' || emoji.length > 16) {
            return badRequest('Invalid reaction');
        }

        const row = await db.query.loveNotes.findFirst({ where: eq(loveNotes.id, messageId) });
        if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });

        const reactions = { ...((row.reactions as Record<string, string> | null) ?? {}) };
        if (reactions[userId] === emoji) delete reactions[userId];
        else reactions[userId] = emoji;

        await db.update(loveNotes).set({ reactions }).where(eq(loveNotes.id, messageId));
        await pusherServer
            .trigger('bond-update', 'reaction', { messageId, reactions, senderId: userId, emoji })
            .catch(() => {});

        return NextResponse.json({ success: true, reactions });
    } catch (error) {
        return serverError(error);
    }
}
