import PusherServer from 'pusher'
import PusherClient from 'pusher-js'

export const pusherServer = new PusherServer({
    appId: process.env.PUSHER_APP_ID!,
    key: process.env.NEXT_PUBLIC_PUSHER_KEY!,
    secret: process.env.PUSHER_SECRET!,
    cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
    useTLS: true,
})

// Helper to create a Pusher client that sends the actual userId for presence auth
function createPusherClient() {
    const client = new PusherClient(
        process.env.NEXT_PUBLIC_PUSHER_KEY!,
        {
            cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
            userAuthentication: {
                endpoint: '/api/pusher/auth',
                transport: 'ajax',
            },
            channelAuthorization: {
                endpoint: '/api/pusher/auth',
                transport: 'ajax',
                params: {},
            },
        }
    )
    return client
}

export const pusherClient = createPusherClient()

// Store auth params that get sent with every Pusher auth request
let _authParams: Record<string, string> = {}

/**
 * Update the user_id sent with Pusher auth requests.
 * Call this whenever the user identity is known/changed.
 */
export function setPusherUserId(userId: string) {
    _authParams = { user_id: userId }
    // Re-create the channel authorization with updated params
    const client = pusherClient as any
    client.config.channelAuthorization = {
        endpoint: '/api/pusher/auth',
        transport: 'ajax',
        params: _authParams,
    }
}
