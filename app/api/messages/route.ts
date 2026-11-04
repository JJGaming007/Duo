import { NextResponse } from 'next/server';
import { desc, eq, inArray, lt } from 'drizzle-orm';
import { db } from '@/lib/db';
import { images, loveNotes } from '@/lib/db/schema';
import { ensureSchema } from '@/lib/db/ensure-schema';
import { pusherServer } from '@/lib/pusher-server';
import { sendPushToPartner } from '@/lib/webpush';
import { getUserName } from '@/lib/constants';
import { serializeMessages } from '@/lib/server/messages';
import { badRequest, isDuoUser, serverError } from '@/lib/server/util';

const MAX_LENGTH = 2000;
const EDIT_WINDOW_MS = 15 * 60 * 1000; // same as WhatsApp
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const uuidOrNull = (v: unknown) => (typeof v === 'string' && UUID.test(v) ? v : null);

const formatDuration = (ms: number) => {
    const s = Math.max(1, Math.round(ms / 1000));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

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

// POST { senderId, content?, imageId?, audioId?, replyToId?, clientId? }
export async function POST(req: Request) {
    try {
        await ensureSchema();
        const { senderId, content, replyToId, clientId, imageId, audioId } = await req.json();
        if (!isDuoUser(senderId)) return badRequest('Invalid sender');
        const text = typeof content === 'string' ? content.trim().slice(0, MAX_LENGTH) : '';
        const image = uuidOrNull(imageId);
        const audio = uuidOrNull(audioId);
        if (!text && !image && !audio) return badRequest('Message is empty');

        const [row] = await db
            .insert(loveNotes)
            .values({ senderId, content: text, imageId: image, audioId: audio, replyToId: uuidOrNull(replyToId) })
            .returning();

        const [message] = await serializeMessages([row]);
        const senderName = getUserName(senderId);
        const pushBody = audio
            ? `Voice message (${formatDuration(message.audio?.durationMs ?? 0)})`
            : image
                ? text ? `Photo · ${text.slice(0, 190)}` : 'Photo'
                : text.slice(0, 200);

        await Promise.allSettled([
            pusherServer.trigger('bond-update', 'new-note', { ...message, clientId }),
            sendPushToPartner(senderId, senderName, pushBody, '/chat', { kind: 'chat' }),
        ]);

        // `note` is kept for older installed clients
        return NextResponse.json({ success: true, message: { ...message, clientId }, note: message });
    } catch (error) {
        return serverError(error);
    }
}

// PATCH { messageId, senderId, content } — edit my own text within 15 minutes
export async function PATCH(req: Request) {
    try {
        await ensureSchema();
        const { messageId, senderId, content } = await req.json();
        if (!uuidOrNull(messageId) || !isDuoUser(senderId)) return badRequest('Message ID and sender ID required');
        const text = typeof content === 'string' ? content.trim().slice(0, MAX_LENGTH) : '';
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
        await ensureSchema();
        const { messageId, senderId } = await req.json();
        if (!uuidOrNull(messageId) || !isDuoUser(senderId)) return badRequest('Message ID and sender ID required');

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
