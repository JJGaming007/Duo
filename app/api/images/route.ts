import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { images } from '@/lib/db/schema';
import { ensureSchema } from '@/lib/db/ensure-schema';
import { badRequest, isDuoUser, serverError } from '@/lib/server/util';

const MAX_BYTES = 3 * 1024 * 1024; // photos are resized and voice notes capped well below this
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const AUDIO_TYPES = new Set(['audio/mp4', 'audio/aac', 'audio/mpeg', 'audio/webm', 'audio/ogg']);

// POST raw bytes. Photos: ?userId=&w=&h=   Voice: ?userId=&duration=<ms>&wave=12,40,…
export async function POST(req: Request) {
    try {
        await ensureSchema();
        const { searchParams } = new URL(req.url);
        const userId = searchParams.get('userId');
        if (!isDuoUser(userId)) return badRequest('Invalid user');

        const mime = (req.headers.get('content-type') || '').split(';')[0].trim();
        const isAudio = AUDIO_TYPES.has(mime);
        if (!IMAGE_TYPES.has(mime) && !isAudio) return badRequest('Unsupported file type');

        const buf = Buffer.from(await req.arrayBuffer());
        if (!buf.length) return badRequest('Empty image');
        if (buf.length > MAX_BYTES) return NextResponse.json({ error: 'Image too large' }, { status: 413 });

        const width = Math.max(0, Math.min(10000, Number(searchParams.get('w')) || 0));
        const height = Math.max(0, Math.min(10000, Number(searchParams.get('h')) || 0));

        const durationMs = isAudio ? Math.max(0, Math.min(10 * 60 * 1000, Number(searchParams.get('duration')) || 0)) : null;
        const waveform = isAudio
            ? (searchParams.get('wave') || '')
                .split(',')
                .slice(0, 64)
                .map((n) => Math.max(0, Math.min(100, Math.round(Number(n) || 0))))
            : null;

        const [row] = await db
            .insert(images)
            .values({ data: buf.toString('base64'), mime, width, height, durationMs, waveform, createdBy: userId })
            .returning({ id: images.id });

        const url = `/api/images/${row.id}`;
        return NextResponse.json(isAudio ? { id: row.id, url, durationMs, waveform } : { id: row.id, url, width, height });
    } catch (error) {
        return serverError(error);
    }
}
