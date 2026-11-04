import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { ensureSchema } from '@/lib/db/ensure-schema';
import { pusherServer } from '@/lib/pusher-server';
import { getUserName } from '@/lib/constants';
import { badRequest, isDuoUser, serverError } from '@/lib/server/util';
import type { DuoMember } from '@/lib/types';

// GET — both members with their current mood
export async function GET() {
    try {
        await ensureSchema();
        const rows = await db.select().from(users);
        const members: DuoMember[] = rows.map((u) => ({
            id: u.id,
            name: getUserName(u.id),
            moodEmoji: u.moodEmoji ?? null,
            moodLabel: u.moodLabel ?? null,
            moodUpdatedAt: u.moodUpdatedAt ? new Date(u.moodUpdatedAt).toISOString() : null,
            image: u.image ?? null,
        }));
        return NextResponse.json(members);
    } catch (error) {
        return serverError(error);
    }
}

// POST { userId, emoji, label } — set (or clear with empty emoji) my mood
// POST { userId, image: '/api/images/<id>' | null } — set or remove my profile picture
export async function POST(req: Request) {
    try {
        await ensureSchema();
        const body = await req.json();
        const { userId, emoji, label } = body;
        if (!isDuoUser(userId)) return badRequest('Invalid user');

        if ('image' in body) {
            const image = body.image;
            if (image !== null && !(typeof image === 'string' && /^\/api\/images\/[0-9a-f-]{36}$/i.test(image))) {
                return badRequest('Invalid image');
            }
            await db.update(users).set({ image }).where(eq(users.id, userId));
            await pusherServer.trigger('bond-update', 'profile', { senderId: userId }).catch(() => {});
            return NextResponse.json({ success: true });
        }

        const e = typeof emoji === 'string' && emoji ? emoji.slice(0, 16) : null;
        const l = e && typeof label === 'string' ? label.slice(0, 40) : null;

        await db.update(users).set({ moodEmoji: e, moodLabel: l, moodUpdatedAt: new Date() }).where(eq(users.id, userId));
        await pusherServer.trigger('bond-update', 'mood', { senderId: userId, emoji: e, label: l }).catch(() => {});
        return NextResponse.json({ success: true });
    } catch (error) {
        return serverError(error);
    }
}
