import { NextResponse } from 'next/server';
import { currentUser, unauthorized } from '@/lib/auth/server';
import { pusherServer } from '@/lib/pusher-server';
import { getUserName } from '@/lib/constants';

export async function POST(req: Request) {
    try {
        const formData = await req.formData();
        const socketId = formData.get('socket_id') as string;
        const channelName = formData.get('channel_name') as string;

        // Presence identity comes from the Google session, not the client
        const userId = await currentUser();
        if (!userId) return unauthorized();
        const userName = getUserName(userId);

        const authResponse = pusherServer.authorizeChannel(socketId, channelName, {
            user_id: userId,
            user_info: {
                name: userName,
            },
        });

        return NextResponse.json(authResponse);
    } catch (error: any) {
        return new NextResponse(error.message, { status: 500 });
    }
}
