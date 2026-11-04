import { inArray } from 'drizzle-orm';
import { db } from '@/lib/db';
import { images, loveNotes } from '@/lib/db/schema';
import { getUserName } from '@/lib/constants';
import type { ChatImage, ChatMessage } from '@/lib/types';

type Row = typeof loveNotes.$inferSelect;

const iso = (d: Date | string | null | undefined) =>
    d == null ? null : (d instanceof Date ? d : new Date(d)).toISOString();

/** Serialize rows, resolving reply previews (one extra query at most). */
export async function serializeMessages(rows: Row[]): Promise<ChatMessage[]> {
    const byId = new Map(rows.map((r) => [r.id, r]));
    const missing = [...new Set(rows.map((r) => r.replyToId).filter((id): id is string => !!id && !byId.has(id)))];
    if (missing.length) {
        const extra = await db.select().from(loveNotes).where(inArray(loveNotes.id, missing));
        extra.forEach((r) => byId.set(r.id, r));
    }

    // Image dimensions (so bubbles have the right size before the image loads)
    const imageIds = [...new Set(rows.map((r) => r.imageId).filter((id): id is string => !!id))];
    const imageMeta = new Map<string, ChatImage>();
    if (imageIds.length) {
        const meta = await db
            .select({ id: images.id, width: images.width, height: images.height })
            .from(images)
            .where(inArray(images.id, imageIds));
        meta.forEach((m) => imageMeta.set(m.id, { ...m, url: `/api/images/${m.id}` }));
    }

    return rows.map((r) => {
        const parent = r.replyToId ? byId.get(r.replyToId) : undefined;
        return {
            id: r.id,
            content: r.content,
            senderId: r.senderId,
            senderName: getUserName(r.senderId),
            createdAt: iso(r.createdAt)!,
            replyToId: r.replyToId ?? null,
            replyTo: parent
                ? {
                    id: parent.id,
                    content: parent.content.slice(0, 120) || (parent.imageId ? 'Photo' : ''),
                    senderId: parent.senderId,
                    senderName: getUserName(parent.senderId),
                }
                : null,
            readAt: iso(r.readAt),
            reactions: (r.reactions as Record<string, string> | null) ?? {},
            image: r.imageId ? imageMeta.get(r.imageId) ?? { id: r.imageId, url: `/api/images/${r.imageId}`, width: 0, height: 0 } : null,
        };
    });
}
