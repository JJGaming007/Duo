import { NextResponse } from 'next/server';
import { currentUser, unauthorized } from '@/lib/auth/server';
import { and, desc, isNull, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { loveNotes } from '@/lib/db/schema';
import { ensureSchema } from '@/lib/db/ensure-schema';
import { serializeMessages } from '@/lib/server/messages';
import { serverError } from '@/lib/server/util';

// GET /api/messages/search?q=… — newest first, text messages only
export async function GET(req: Request) {
    try {
        const me = await currentUser();
        if (!me) return unauthorized();
        await ensureSchema();
        const q = (new URL(req.url).searchParams.get('q') || '').trim().slice(0, 100);
        if (q.length < 2) return NextResponse.json([]);

        // Match "%" and "_" literally. Uses ESCAPE '!' rather than backslashes,
        // whose handling differs between Postgres drivers.
        const pattern = `%${q.replace(/[!%_]/g, (c) => `!${c}`)}%`;
        const rows = await db
            .select()
            .from(loveNotes)
            .where(and(sql`${loveNotes.content} ILIKE ${pattern} ESCAPE '!'`, isNull(loveNotes.deletedAt)))
            .orderBy(desc(loveNotes.createdAt))
            .limit(50);

        return NextResponse.json(await serializeMessages(rows));
    } catch (error) {
        return serverError(error);
    }
}
