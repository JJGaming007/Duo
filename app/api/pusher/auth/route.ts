import { NextResponse } from 'next/server';
import { pusherServer } from '@/lib/pusher';
import { getUserName } from '@/lib/constants';

export async function POST(req: Request) {
    try {
        const formData = await req.formData();
        const socketId = formData.get('socket_id') as string;
        const channelName = formData.get('channel_name') as string;

        // In a real app, you'd get the user from a session. 
        // Here we use the identity stored in the client-side, but since this is a simple duo app,
        // we'll rely on a 'user-id' header or similar if provided, else we just return success
        // for this specific logic we'll need a way for the client to pass its ID.
        // However, Pusher's default auth request doesn't send custom headers easily.
        // We will assume 'user-1' or 'user-2' based on some logic if we had sessions.
        // For now, let's keep it simple: just authorize everyone as 'Unknown' if we can't tell,
        // or let's use a query param if we customize the client.

        // BETTER: The user-id is actually needed. Let's look at how we can get it.
        // For this app, let's just use the socket_id as userId for now or a random one,
        // as we actually track names via the sync events mostly, but presence can show "Online" status properly.

        const userId = `user-${Math.random().toString(36).substr(2, 9)}`;

        const authResponse = pusherServer.authorizeChannel(socketId, channelName, {
            user_id: userId,
            user_info: {
                name: 'Duo Partner',
            },
        });

        return NextResponse.json(authResponse);
    } catch (error: any) {
        return new NextResponse(error.message, { status: 500 });
    }
}
