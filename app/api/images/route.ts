import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { images } from '@/lib/db/schema';
import { ensureSchema } from '@/lib/db/ensure-schema';
import { badRequest, isDuoUser, serverError } from '@/lib/server/util';

const MAX_BYTES = 3 * 1024 * 1024; // client resizes well below this
const TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

// POST raw image bytes. Query: ?userId=&w=&h=
export async function POST(req: Request) {
    try {
        await ensureSchema();
        const { searchParams } = new URL(req.url);
        const userId = searchParams.get('userId');
        if (!isDuoUser(userId)) return badRequest('Invalid user');

        const mime = (req.headers.get('content-type') || '').split(';')[0].trim();
        if (!TYPES.has(mime)) return badRequest('Unsupported image type');

        const buf = Buffer.from(await req.arrayBuffer());
        if (!buf.length) return badRequest('Empty image');
        if (buf.length > MAX_BYTES) return NextResponse.json({ error: 'Image too large' }, { status: 413 });

        const width = Math.max(0, Math.min(10000, Number(searchParams.get('w')) || 0));
        const height = Math.max(0, Math.min(10000, Number(searchParams.get('h')) || 0));

        const [row] = await db
            .insert(images)
            .values({ data: buf.toString('base64'), mime, width, height, createdBy: userId })
            .returning({ id: images.id });

        return NextResponse.json({ id: row.id, url: `/api/images/${row.id}`, width, height });
    } catch (error) {
        return serverError(error);
    }
}
