import { after, NextResponse } from 'next/server';
import { desc, eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { prayerSubjects } from '@/lib/db/schema';
import { ensureSchema } from '@/lib/db/ensure-schema';
import { pusherServer } from '@/lib/pusher-server';
import { sendPushToPartner } from '@/lib/webpush';
import { getUserName } from '@/lib/constants';
import { badRequest, isDuoUser, serverError } from '@/lib/server/util';
import type { PrayerSubject } from '@/lib/types';

type Row = typeof prayerSubjects.$inferSelect;
const iso = (d: Date | null) => (d ? new Date(d).toISOString() : null);

const serialize = (r: Row): PrayerSubject => ({
    id: r.id,
    title: r.title,
    notes: r.notes,
    createdBy: r.createdBy,
    forWhom: (r.forWhom as PrayerSubject['forWhom']) ?? 'both',
    prayedCount: r.prayedCount,
    lastPrayedAt: iso(r.lastPrayedAt),
    answeredAt: iso(r.answeredAt),
    createdAt: iso(r.createdAt)!,
});

const FOR_WHOM = new Set(['both', 'user-1', 'user-2']);

function broadcast(by: string, action: string, id?: string) {
    return pusherServer.trigger('duo-prayer', 'subjects-update', { by, action, id });
}

export async function GET() {
    try {
        await ensureSchema();
        const rows = await db
            .select()
            .from(prayerSubjects)
            .orderBy(sql`${prayerSubjects.answeredAt} IS NOT NULL`, desc(prayerSubjects.answeredAt), desc(prayerSubjects.createdAt))
            .limit(300);
        return NextResponse.json(rows.map(serialize));
    } catch (error) {
        return serverError(error);
    }
}

// Create: { userId, title, notes?, forWhom? }
export async function POST(req: Request) {
    try {
        await ensureSchema();
        const { userId, title, notes, forWhom } = await req.json();
        if (!isDuoUser(userId)) return badRequest('Invalid user');
        const t = typeof title === 'string' ? title.trim().slice(0, 200) : '';
        if (!t) return badRequest('Title required');

        const [row] = await db
            .insert(prayerSubjects)
            .values({
                title: t,
                notes: typeof notes === 'string' && notes.trim() ? notes.trim().slice(0, 1000) : null,
                createdBy: userId,
                forWhom: FOR_WHOM.has(forWhom) ? forWhom : 'both',
            })
            .returning();

        await broadcast(userId, 'create', row.id).catch(() => {});
        after(() => sendPushToPartner(userId, getUserName(userId), `New prayer subject: ${t}`, '/prayer', { kind: 'subject' }));
        return NextResponse.json(serialize(row));
    } catch (error) {
        return serverError(error);
    }
}

// Update: { id, userId, action: 'answer' | 'unanswer' | 'prayed' | 'edit', title?, notes? }
export async function PATCH(req: Request) {
    try {
        await ensureSchema();
        const { id, userId, action, title, notes } = await req.json();
        if (!id || !isDuoUser(userId)) return badRequest('id and userId required');

        let set: Partial<Row> | Record<string, unknown>;
        switch (action) {
            case 'answer':
                set = { answeredAt: new Date() };
                break;
            case 'unanswer':
                set = { answeredAt: null };
                break;
            case 'prayed':
                set = { prayedCount: sql`${prayerSubjects.prayedCount} + 1`, lastPrayedAt: new Date() };
                break;
            case 'edit': {
                const t = typeof title === 'string' ? title.trim().slice(0, 200) : '';
                if (!t) return badRequest('Title required');
                set = { title: t, notes: typeof notes === 'string' && notes.trim() ? notes.trim().slice(0, 1000) : null };
                break;
            }
            default:
                return badRequest('Unknown action');
        }

        const [row] = await db.update(prayerSubjects).set(set).where(eq(prayerSubjects.id, id)).returning();
        if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });

        const tasks: Promise<unknown>[] = [broadcast(userId, action, id)];
        if (action === 'answer') {
            after(() => sendPushToPartner(userId, getUserName(userId), `Marked “${row.title}” as answered`, '/prayer', { kind: 'subject' }));
        }
        await Promise.allSettled(tasks);
        return NextResponse.json(serialize(row));
    } catch (error) {
        return serverError(error);
    }
}

export async function DELETE(req: Request) {
    try {
        const { id, userId } = await req.json();
        if (!id || !isDuoUser(userId)) return badRequest('id and userId required');
        await db.delete(prayerSubjects).where(eq(prayerSubjects.id, id));
        await broadcast(userId, 'delete', id).catch(() => {});
        return NextResponse.json({ success: true });
    } catch (error) {
        return serverError(error);
    }
}
