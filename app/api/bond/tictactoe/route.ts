import { NextResponse } from "next/server";
import { currentUser, unauthorized } from '@/lib/auth/server';
import { pusherServer } from "@/lib/pusher-server";

// This route purely relays purely ephemeral state via Pusher for instant play.
export async function POST(req: Request) {
    try {
        const me = await currentUser();
        if (!me) return unauthorized();
        const body = await req.json();

        // Broadcast the game state change or reset to the partner
        await pusherServer.trigger('bond-tictactoe', 'game-update', body);

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return new NextResponse(error.message, { status: 500 });
    }
}
