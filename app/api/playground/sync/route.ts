import { NextResponse } from 'next/server';
import { pusherServer } from '@/lib/pusher';
import { db } from '@/lib/db';
import { playground } from '@/lib/db/schema';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { type, ...data } = body;

        // Broadcast code update, presence, or cursor info
        await pusherServer.trigger('playground', 'code-update', {
            type,
            ...data,
            timestamp: Date.now(),
        });

        // If it's a code sync, persist to database
        if (type === 'sync' && data.code) {
            await db.insert(playground)
                .values({
                    id: 'default',
                    code: data.code,
                    lastEditedBy: data.senderId,
                    updatedAt: new Date(),
                })
                .onConflictDoUpdate({
                    target: playground.id,
                    set: {
                        code: data.code,
                        lastEditedBy: data.senderId,
                        updatedAt: new Date(),
                    },
                });
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
