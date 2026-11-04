import { after, NextResponse } from 'next/server';
import { and, gte, lte, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { prayerLogs } from '@/lib/db/schema';
import { ensureSchema } from '@/lib/db/ensure-schema';
import { pusherServer } from '@/lib/pusher-server';
import { sendPushToPartner } from '@/lib/webpush';
import { getUserName, type DuoUser } from '@/lib/constants';
import { addDays, badRequest, isDateKey, isDuoUser, serverError } from '@/lib/server/util';
import type { PrayerSummary } from '@/lib/types';

const USERS: DuoUser[] = ['user-1', 'user-2'];
const HISTORY_DAYS = 60;

async function buildSummary(date: string): Promise<PrayerSummary> {
    const from = addDays(date, -HISTORY_DAYS);
    const rows = await db
        .select()
        .from(prayerLogs)
        .where(and(gte(prayerLogs.date, from), lte(prayerLogs.date, date)));

    const counts = new Map<string, number>(); // `${user}|${date}` -> count
    rows.forEach((r) => counts.set(`${r.userId}|${r.date}`, r.count));
    const get = (u: DuoUser, d: string) => counts.get(`${u}|${d}`) ?? 0;

    const week = Array.from({ length: 7 }, (_, i) => {
        const d = addDays(date, i - 6);
        return { date: d, 'user-1': get('user-1', d), 'user-2': get('user-2', d) };
    });

    // Consecutive days with at least one prayer. Today not prayed yet doesn't break it.
    const streak = (u: DuoUser) => {
        let d = get(u, date) > 0 ? date : addDays(date, -1);
        let n = 0;
        while (n < HISTORY_DAYS && get(u, d) > 0) {
            n++;
            d = addDays(d, -1);
        }
        return n;
    };

    return {
        date,
        today: { 'user-1': get('user-1', date), 'user-2': get('user-2', date) },
        week,
        streaks: { 'user-1': streak('user-1'), 'user-2': streak('user-2') },
    };
}

// GET /api/prayer?date=YYYY-MM-DD (client's local today)
export async function GET(req: Request) {
    try {
        await ensureSchema();
        const date = new URL(req.url).searchParams.get('date');
        if (!isDateKey(date)) return badRequest('date=YYYY-MM-DD required');
        return NextResponse.json(await buildSummary(date));
    } catch (error) {
        return serverError(error);
    }
}

// POST { userId, date, delta: 1 | -1, together?: boolean }
export async function POST(req: Request) {
    try {
        await ensureSchema();
        const { userId, date, delta, together } = await req.json();
        if (!isDuoUser(userId)) return badRequest('Invalid user');
        if (!isDateKey(date)) return badRequest('Invalid date');
        if (delta !== 1 && delta !== -1) return badRequest('delta must be 1 or -1');

        const targets = together ? USERS : [userId];
        await Promise.all(
            targets.map((u) =>
                db
                    .insert(prayerLogs)
                    .values({ userId: u, date, count: Math.max(0, delta) })
                    .onConflictDoUpdate({
                        target: [prayerLogs.userId, prayerLogs.date],
                        set: { count: sql`greatest(0, ${prayerLogs.count} + ${delta})`, updatedAt: new Date() },
                    }),
            ),
        );

        const summary = await buildSummary(date);
        const name = getUserName(userId);
        const myCount = summary.today[userId];

        const notify: Promise<unknown>[] = [
            pusherServer.trigger('duo-prayer', 'prayer-update', { by: userId, date, together: !!together }),
        ];
        if (delta > 0) {
            const body = together ? 'Logged that you prayed together' : `Prayed ${timesLabel(myCount).toLowerCase()} today`;
            after(() => sendPushToPartner(userId, name, body, '/prayer', { kind: 'prayer' }));
        }
        await Promise.allSettled(notify);

        return NextResponse.json(summary);
    } catch (error) {
        return serverError(error);
    }
}

function timesLabel(n: number) {
    if (n === 1) return 'Once';
    if (n === 2) return 'Twice';
    if (n === 3) return 'Thrice';
    return `${n} times`;
}

