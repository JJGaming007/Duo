import { NextResponse } from "next/server";
import { pusherServer } from "@/lib/pusher";

export async function POST(req: Request) {
    try {
        const { senderId } = await req.json();

        if (!senderId) {
            return new NextResponse("Sender ID required", { status: 400 });
        }

        const { getUserName } = await import('@/lib/constants');
        const senderName = getUserName(senderId);

        await pusherServer.trigger('bond-update', 'nudge', {
            senderId,
            senderName
        });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return new NextResponse(error.message, { status: 500 });
    }
}
