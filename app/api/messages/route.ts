import { NextResponse } from 'next/server';
import { and, desc, eq, lt } from 'drizzle-orm';
import { db } from '@/lib/db';
import { images, loveNotes } from '@/lib/db/schema';
import { ensureSchema } from '@/lib/db/ensure-schema';
import { pusherServer } from '@/lib/pusher-server';
import { sendPushToPartner } from '@/lib/webpush';
import { getUserName } from '@/lib/constants';
import { serializeMessages } from '@/lib/server/messages';
import { badRequest, isDuoUser, serverError } from '@/lib/server/util';

const MAX_LENGTH = 2000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// GET /api/messages?before=<iso>&limit=50 — newest first
export async function GET(req: Request) {
    try {
        await ensureSchema();
        const { searchParams } = new URL(req.url);
        const before = searchParams.get('before');
        const limit = Math.min(Math.max(Number(searchParams.get('limit')) || 50, 1), 100);

        const rows = await db
            .select()
            .from(loveNotes)
            .where(before ? lt(loveNotes.createdAt, new Date(before)) : undefined)
            .orderBy(desc(loveNotes.createdAt))
            .limit(limit);

        return NextResponse.json(await serializeMessages(rows));
    } catch (error) {
        return serverError(error);
    }
}

export async function POST(req: Request) {
    try {
        await ensureSchema();
        const { senderId, content, replyToId, clientId, imageId } = await req.json();
        if (!isDuoUser(senderId)) return badRequest('Invalid sender');
        const text = typeof content === 'string' ? content.trim().slice(0, MAX_LENGTH) : '';
        const image = typeof imageId === 'string' && UUID.test(imageId) ? imageId : null;
        if (!text && !image) return badRequest('Message is empty');

        const [row] = await db
            .insert(loveNotes)
            .values({
                senderId,
                content: text,
                imageId: image,
                replyToId: typeof replyToId === 'string' && UUID.test(replyToId) ? replyToId : null,
            })
            .returning();

        const [message] = await serializeMessages([row]);
        const senderName = getUserName(senderId);

        await Promise.allSettled([
            pusherServer.trigger('bond-update', 'new-note', { ...message, clientId }),
            sendPushToPartner(senderId, senderName, image ? (text ? `📷 ${text.slice(0, 190)}` : '📷 Photo') : text.slice(0, 200), '/chat', { kind: 'chat' }),
        ]);

        // `note` is kept for older installed clients
        return NextResponse.json({ success: true, message: { ...message, clientId }, note: message });
    } catch (error) {
        return serverError(error);
    }
}

export async function DELETE(req: Request) {
    try {
        await ensureSchema();
        const { messageId, senderId } = await req.json();
        if (!messageId || !isDuoUser(senderId)) return badRequest('Message ID and sender ID required');

        // Only the sender can delete their own message
        const deleted = await db
            .delete(loveNotes)
            .where(and(eq(loveNotes.id, messageId), eq(loveNotes.senderId, senderId)))
            .returning({ id: loveNotes.id, imageId: loveNotes.imageId });
        if (!deleted.length) return NextResponse.json({ error: 'Not found' }, { status: 404 });
        if (deleted[0].imageId) await db.delete(images).where(eq(images.id, deleted[0].imageId)).catch(() => {});

        await pusherServer.trigger('bond-update', 'delete-note', { messageId, senderId }).catch(() => {});
        return NextResponse.json({ success: true });
    } catch (error) {
        return serverError(error);
    }
}
