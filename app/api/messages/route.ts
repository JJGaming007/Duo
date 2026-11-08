import { NextResponse } from 'next/server';
import { currentUser, unauthorized } from '@/lib/auth/server';
import { desc, eq, inArray, lt } from 'drizzle-orm';
import { db } from '@/lib/db';
import { images, loveNotes } from '@/lib/db/schema';
import { ensureSchema } from '@/lib/db/ensure-schema';
import { pusherServer } from '@/lib/pusher-server';
import { createMessage, MAX_MESSAGE_LENGTH, serializeMessages, uuidOrNull } from '@/lib/server/messages';
import { badRequest, serverError } from '@/lib/server/util';

const EDIT_WINDOW_MS = 15 * 60 * 1000; // same as WhatsApp

// GET /api/messages?before=<iso>&limit=50 — newest first
export async function GET(req: Request) {
    try {
        const me = await currentUser();
        if (!me) return unauthorized();
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

// POST { senderId, content?, imageId?, audioId?, replyToId?, clientId? }
// (Photos and voice messages normally go through POST /api/images with the
// message fields, which uploads and creates the message in one request.)
export async function POST(req: Request) {
    try {
        const me = await currentUser();
        if (!me) return unauthorized();
        await ensureSchema();
        const { content, replyToId, clientId, imageId, audioId } = await req.json();
        const senderId = me;
        const message = await createMessage({ senderId, content, replyToId, clientId, imageId: uuidOrNull(imageId), audioId: uuidOrNull(audioId) });
        if (!message) return badRequest('Message is empty');

        // `note` is kept for older installed clients
        return NextResponse.json({ success: true, message, note: message });
    } catch (error) {
        return serverError(error);
    }
}

// PATCH { messageId, senderId, content } — edit my own text within 15 minutes
export async function PATCH(req: Request) {
    try {
        const me = await currentUser();
        if (!me) return unauthorized();
        await ensureSchema();
        const { messageId, content } = await req.json();
        const senderId = me;
        if (!uuidOrNull(messageId)) return badRequest('Message ID required');
        const text = typeof content === 'string' ? content.trim().slice(0, MAX_MESSAGE_LENGTH) : '';
        if (!text) return badRequest('Message is empty');

        const row = await db.query.loveNotes.findFirst({ where: eq(loveNotes.id, messageId) });
        if (!row || row.senderId !== senderId) return NextResponse.json({ error: 'Not found' }, { status: 404 });
        if (row.deletedAt || row.audioId) return badRequest('This message can’t be edited');
        if (Date.now() - new Date(row.createdAt).getTime() > EDIT_WINDOW_MS) {
            return NextResponse.json({ error: 'Messages can only be edited for 15 minutes' }, { status: 403 });
        }

        const [updated] = await db
            .update(loveNotes)
            .set({ content: text, editedAt: new Date() })
            .where(eq(loveNotes.id, messageId))
            .returning();
        const [message] = await serializeMessages([updated]);
        await pusherServer.trigger('bond-update', 'edit-note', message).catch(() => {});
        return NextResponse.json({ success: true, message });
    } catch (error) {
        return serverError(error);
    }
}

// DELETE { messageId, senderId } — "Delete for everyone". The row stays as a
// "This message was deleted" placeholder; the photo / voice note is removed.
export async function DELETE(req: Request) {
    try {
        const me = await currentUser();
        if (!me) return unauthorized();
        await ensureSchema();
        const { messageId } = await req.json();
        const senderId = me;
        if (!uuidOrNull(messageId)) return badRequest('Message ID required');

        const row = await db.query.loveNotes.findFirst({ where: eq(loveNotes.id, messageId) });
        if (!row || row.senderId !== senderId) return NextResponse.json({ error: 'Not found' }, { status: 404 });

        if (!row.deletedAt) {
            await db
                .update(loveNotes)
                .set({ deletedAt: new Date(), content: '', imageId: null, audioId: null, reactions: {} })
                .where(eq(loveNotes.id, messageId));
            const media = [row.imageId, row.audioId].filter((id): id is string => !!id);
            if (media.length) await db.delete(images).where(inArray(images.id, media)).catch(() => {});
        }

        await pusherServer.trigger('bond-update', 'delete-note', { messageId, senderId, deleted: true }).catch(() => {});
        return NextResponse.json({ success: true });
    } catch (error) {
        return serverError(error);
    }
}
