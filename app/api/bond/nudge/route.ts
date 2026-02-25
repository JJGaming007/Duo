import { NextResponse } from "next/server";
import { pusherServer } from "@/lib/pusher";
import { sendPushToPartner } from "@/lib/webpush";

export async function POST(req: Request) {
    try {
        const { senderId, type } = await req.json();

        if (!senderId) {
            return new NextResponse("Sender ID required", { status: 400 });
        }

        const { getUserName } = await import('@/lib/constants');
        const senderName = getUserName(senderId);

        // Handle typing indicator (no push needed)
        if (type === 'typing') {
            await pusherServer.trigger('bond-update', 'typing', {
                senderId,
                senderName
            });
            return NextResponse.json({ success: true });
        }

        // Nudge: send both Pusher event and Web Push
        await pusherServer.trigger('bond-update', 'nudge', {
            senderId,
            senderName
        });

        await sendPushToPartner(
            senderId,
            '👋 Nudge!',
            `${senderName} nudged you!`,
            '/bond'
        );

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return new NextResponse(error.message, { status: 500 });
    }
}
