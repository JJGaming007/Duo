import PusherClient from 'pusher-js'

// Client-only Pusher instance. The server SDK lives in lib/pusher-server.ts so it
// never gets bundled into the browser.
//
// IMPORTANT: pages must NOT call pusherClient.unsubscribe() on shared channels
// ('bond-update', 'partner-progress', ...). NotificationProvider listens on those
// globally; unsubscribing from a page silently kills app-wide notifications.
// Use channel.unbind(event, handler) in cleanup instead.

let _authParams: Record<string, string> = {}

export const pusherClient = new PusherClient(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
    cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
    userAuthentication: {
        endpoint: '/api/pusher/auth',
        transport: 'ajax',
    },
    channelAuthorization: {
        endpoint: '/api/pusher/auth',
        transport: 'ajax',
        // Read lazily so setPusherUserId() takes effect for later subscriptions
        paramsProvider: () => _authParams,
    },
})

/** Update the user_id sent with Pusher auth requests (presence channels). */
export function setPusherUserId(userId: string) {
    _authParams = { user_id: userId }
}

type Handler = (data: any) => void

/**
 * Bind handlers on a channel and return a cleanup that only unbinds those
 * handlers (leaving the channel subscribed for other listeners).
 */
export function bindChannel(channelName: string, handlers: Record<string, Handler>) {
    const channel = pusherClient.channel(channelName) ?? pusherClient.subscribe(channelName)
    for (const [event, fn] of Object.entries(handlers)) channel.bind(event, fn)
    return () => {
        for (const [event, fn] of Object.entries(handlers)) channel.unbind(event, fn)
    }
}
