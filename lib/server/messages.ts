import { inArray } from 'drizzle-orm';
import { db } from '@/lib/db';
import { images, loveNotes } from '@/lib/db/schema';
import { getUserName } from '@/lib/constants';
import type { ChatAudio, ChatImage, ChatMessage } from '@/lib/types';

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

    // Media metadata: photo sizes (so bubbles are sized before loading) and voice
    // message duration/waveform. Includes quoted messages for reply thumbnails.
    const all = [...byId.values()];
    const mediaIds = [...new Set(all.flatMap((r) => [r.imageId, r.audioId]).filter((id): id is string => !!id))];
    const imageMeta = new Map<string, ChatImage>();
    const audioMeta = new Map<string, ChatAudio>();
    if (mediaIds.length) {
        const meta = await db
            .select({ id: images.id, width: images.width, height: images.height, durationMs: images.durationMs, waveform: images.waveform })
            .from(images)
            .where(inArray(images.id, mediaIds));
        meta.forEach((m) => {
            const url = `/api/images/${m.id}`;
            imageMeta.set(m.id, { id: m.id, url, width: m.width, height: m.height });
            audioMeta.set(m.id, { id: m.id, url, durationMs: m.durationMs ?? 0, waveform: (m.waveform as number[] | null) ?? [] });
        });
    }
    const preview = (r: Row) =>
        r.deletedAt ? 'Deleted message' : r.content.slice(0, 120) || (r.imageId ? 'Photo' : r.audioId ? 'Voice message' : '');

    return rows.map((r) => {
        const parent = r.replyToId ? byId.get(r.replyToId) : undefined;
        const deleted = !!r.deletedAt;
        return {
            id: r.id,
            content: deleted ? '' : r.content,
            senderId: r.senderId,
            senderName: getUserName(r.senderId),
            createdAt: iso(r.createdAt)!,
            replyToId: r.replyToId ?? null,
            replyTo: parent
                ? {
                    id: parent.id,
                    content: preview(parent),
                    senderId: parent.senderId,
                    senderName: getUserName(parent.senderId),
                    imageUrl: !parent.deletedAt && parent.imageId ? `/api/images/${parent.imageId}` : null,
                }
                : null,
            readAt: iso(r.readAt),
            deliveredAt: iso(r.deliveredAt ?? r.readAt),
            editedAt: iso(r.editedAt),
            deleted,
            reactions: deleted ? {} : (r.reactions as Record<string, string> | null) ?? {},
            image: !deleted && r.imageId ? imageMeta.get(r.imageId) ?? { id: r.imageId, url: `/api/images/${r.imageId}`, width: 0, height: 0 } : null,
            audio: !deleted && r.audioId ? audioMeta.get(r.audioId) ?? { id: r.audioId, url: `/api/images/${r.audioId}`, durationMs: 0, waveform: [] } : null,
        };
    });
}
