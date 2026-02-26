import { NextResponse } from 'next/server';
import { pusherServer } from '@/lib/pusher';
import { getUserName } from '@/lib/constants';

export async function POST(req: Request) {
    try {
        const formData = await req.formData();
        const socketId = formData.get('socket_id') as string;
        const channelName = formData.get('channel_name') as string;

        // Extract userId from the custom data sent by the Pusher client
        // The client sends this via channelAuthorization params
        let userId = 'user-1';
        let userName = 'Duo Partner';

        // Pusher sends form-data; some clients also include custom fields
        const rawUserId = formData.get('user_id') as string;
        if (rawUserId && (rawUserId === 'user-1' || rawUserId === 'user-2')) {
            userId = rawUserId;
            userName = getUserName(userId);
        }

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
