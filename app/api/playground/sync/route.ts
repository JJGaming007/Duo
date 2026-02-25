import { NextResponse } from 'next/server';
import { pusherServer } from '@/lib/pusher';

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

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
