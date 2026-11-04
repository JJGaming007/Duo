import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { images } from '@/lib/db/schema';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Images never change once uploaded (a new photo gets a new id), so they can be
// cached forever by the browser and the CDN.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    if (!UUID.test(id)) return new Response('Not found', { status: 404 });

    try {
        const row = await db.query.images.findFirst({
            where: eq(images.id, id),
            columns: { data: true, mime: true },
        });
        if (!row) return new Response('Not found', { status: 404 });

        return new Response(Buffer.from(row.data, 'base64'), {
            headers: {
                'Content-Type': row.mime,
                'Cache-Control': 'public, max-age=31536000, immutable',
            },
        });
    } catch (error) {
        console.error(error);
        return new Response('Server error', { status: 500 });
    }
}
