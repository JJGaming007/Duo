import { NextResponse } from 'next/server';
import { currentUser, unauthorized } from '@/lib/auth/server';
import { db } from '@/lib/db';
import { images } from '@/lib/db/schema';
import { ensureSchema } from '@/lib/db/ensure-schema';
import { badRequest, serverError } from '@/lib/server/util';
import { createMessage } from '@/lib/server/messages';

const MAX_BYTES = 3 * 1024 * 1024; // photos are resized and voice notes capped well below this
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const AUDIO_TYPES = new Set(['audio/mp4', 'audio/aac', 'audio/mpeg', 'audio/webm', 'audio/ogg']);

type Meta = { userId: string | null; w?: string | null; h?: string | null; duration?: string | null; wave?: string | null };

async function storeMedia(bytes: ArrayBuffer, mime: string, meta: Meta) {
    const isAudio = AUDIO_TYPES.has(mime);
    const buf = Buffer.from(bytes);
    const width = Math.max(0, Math.min(10000, Number(meta.w) || 0));
    const height = Math.max(0, Math.min(10000, Number(meta.h) || 0));
    const durationMs = isAudio ? Math.max(0, Math.min(10 * 60 * 1000, Number(meta.duration) || 0)) : null;
    const waveform = isAudio
        ? (meta.wave || '')
            .split(',')
            .slice(0, 64)
            .map((n) => Math.max(0, Math.min(100, Math.round(Number(n) || 0))))
        : null;

    const [row] = await db
        .insert(images)
        .values({ data: buf.toString('base64'), mime, width, height, durationMs, waveform, createdBy: meta.userId })
        .returning({ id: images.id });
    const url = `/api/images/${row.id}`;
    return { isAudio, media: isAudio ? { id: row.id, url, durationMs, waveform } : { id: row.id, url, width, height } };
}

/**
 * Two ways in:
 *  - multipart/form-data with `file` + message fields (`senderId`, `content`,
 *    `replyToId`, `clientId`): uploads AND creates the chat message in one
 *    request — this is what sending a photo / voice message uses.
 *  - raw bytes with ?userId=&w=&h= (or &duration=&wave=): just stores the file
 *    (profile pictures).
 */
export async function POST(req: Request) {
    try {
        const me = await currentUser();
        if (!me) return unauthorized();
        await ensureSchema();
        const contentType = req.headers.get('content-type') || '';

        if (contentType.startsWith('multipart/form-data')) {
            const form = await req.formData();
            const senderId = me;
            const file = form.get('file');
            if (!(file instanceof Blob) || !file.size) return badRequest('Missing file');
            const mime = (file.type || '').split(';')[0].trim();
            if (!IMAGE_TYPES.has(mime) && !AUDIO_TYPES.has(mime)) return badRequest('Unsupported file type');
            if (file.size > MAX_BYTES) return NextResponse.json({ error: 'File too large' }, { status: 413 });

            const str = (k: string) => (typeof form.get(k) === 'string' ? (form.get(k) as string) : null);
            const { isAudio, media } = await storeMedia(await file.arrayBuffer(), mime, {
                userId: senderId, w: str('w'), h: str('h'), duration: str('duration'), wave: str('wave'),
            });
            const message = await createMessage({
                senderId,
                content: str('content') ?? '',
                replyToId: str('replyToId'),
                clientId: str('clientId'),
                imageId: isAudio ? null : media.id,
                audioId: isAudio ? media.id : null,
            });
            return NextResponse.json({ media, message });
        }

        const { searchParams } = new URL(req.url);
        const userId = me;

        const mime = contentType.split(';')[0].trim();
        if (!IMAGE_TYPES.has(mime) && !AUDIO_TYPES.has(mime)) return badRequest('Unsupported file type');

        const bytes = await req.arrayBuffer();
        if (!bytes.byteLength) return badRequest('Empty file');
        if (bytes.byteLength > MAX_BYTES) return NextResponse.json({ error: 'File too large' }, { status: 413 });

        const { media } = await storeMedia(bytes, mime, {
            userId, w: searchParams.get('w'), h: searchParams.get('h'), duration: searchParams.get('duration'), wave: searchParams.get('wave'),
        });
        return NextResponse.json(media);
    } catch (error) {
        return serverError(error);
    }
}
