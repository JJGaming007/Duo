import { NextResponse } from "next/server";
import { pusherServer } from "@/lib/pusher";
import { sendPushToPartner } from "@/lib/webpush";

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { senderId, type } = body;

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

        // Handle emoji reaction on message (no push needed)
        if (type === 'reaction') {
            await pusherServer.trigger('bond-update', 'reaction', {
                senderId,
                messageId: body.messageId,
                emoji: body.emoji,
            });
            return NextResponse.json({ success: true });
        }

        // Handle mood update (no push needed)
        if (type === 'mood') {
            await pusherServer.trigger('bond-update', 'mood', {
                senderId,
                emoji: body.emoji,
                label: body.label,
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
