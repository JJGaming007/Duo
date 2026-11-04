import { inArray } from 'drizzle-orm';
import { db } from '@/lib/db';
import { loveNotes } from '@/lib/db/schema';
import { getUserName } from '@/lib/constants';
import type { ChatMessage } from '@/lib/types';

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
                    content: parent.content.slice(0, 120),
                    senderId: parent.senderId,
                    senderName: getUserName(parent.senderId),
                }
                : null,
            readAt: iso(r.readAt),
            reactions: (r.reactions as Record<string, string> | null) ?? {},
        };
    });
}
