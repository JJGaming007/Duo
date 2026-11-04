import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { images } from '@/lib/db/schema';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Images never change once uploaded (a new photo gets a new id), so they can be
// cached forever by the browser and the CDN.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    if (!UUID.test(id)) return new Response('Not found', { status: 404 });

    try {
        const row = await db.query.images.findFirst({
            where: eq(images.id, id),
            columns: { data: true, mime: true },
        });
        if (!row) return new Response('Not found', { status: 404 });

        const buf = Buffer.from(row.data, 'base64');
        const headers: Record<string, string> = {
            'Content-Type': row.mime,
            'Cache-Control': 'public, max-age=31536000, immutable',
            'Accept-Ranges': 'bytes',
        };

        // iOS Safari only plays <audio> from servers that answer Range requests
        const range = req.headers.get('range')?.match(/^bytes=(\d*)-(\d*)$/);
        if (range) {
            const start = range[1] ? Number(range[1]) : Math.max(0, buf.length - Number(range[2]));
            const end = range[1] && range[2] ? Math.min(Number(range[2]), buf.length - 1) : buf.length - 1;
            if (start >= buf.length || start > end) {
                return new Response(null, { status: 416, headers: { ...headers, 'Content-Range': `bytes */${buf.length}` } });
            }
            const part = buf.subarray(start, end + 1);
            return new Response(part, {
                status: 206,
                headers: { ...headers, 'Content-Range': `bytes ${start}-${end}/${buf.length}`, 'Content-Length': String(part.length) },
            });
        }

        return new Response(buf, { headers: { ...headers, 'Content-Length': String(buf.length) } });
    } catch (error) {
        console.error(error);
        return new Response('Server error', { status: 500 });
    }
}
