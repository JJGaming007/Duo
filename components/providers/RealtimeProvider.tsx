"use client"

import { useEffect, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { appMutate as mutate, patchCache } from '@/lib/swr-mutate'
import { showBanner } from '@/components/Banner'
import { startPresence } from '@/lib/presence'
import { bindChannel, pusherClient, setPusherUserId } from '@/lib/pusher'
import { registerServiceWorker, setAppBadge, showOsNotification, syncPushSubscription } from '@/lib/notifications'
import { asDeleted, KEYS, markDelivered, patchMessages, unreadCount, upsertMessage, useDuo, useMe, useMessages, usePrayer, useSubjects } from '@/lib/data'
import type { ChatMessage, DuoMember } from '@/lib/types'

/**
 * Always mounted (layout.tsx). Single owner of realtime state:
 *  - prefetches every screen's data so tabs open instantly,
 *  - applies Pusher events straight into the SWR cache,
 *  - shows in-app banners (OS notifications come from Web Push via the SW),
 *  - keeps the app-icon badge in sync with unread messages.
 */
const previewText = (m: ChatMessage) => (m.audio ? 'Voice message' : m.content || (m.image ? 'Photo' : ''))

export default function RealtimeProvider() {
    const { ready, me, partnerName } = useMe()
    const router = useRouter()
    const pathname = usePathname()
    const pathRef = useRef(pathname)
    const pushActive = useRef(false)

    useEffect(() => {
        pathRef.current = pathname
    }, [pathname])

    // Prefetch + keep subscribed (revalidates on focus/reconnect)
    const { data: messages } = useMessages()
    useDuo()
    usePrayer()
    useSubjects()

    useEffect(() => {
        registerServiceWorker()
    }, [])

    useEffect(() => {
        if (!ready) return
        setPusherUserId(me)
        syncPushSubscription(me).then((ok) => (pushActive.current = ok))
        // Online / last seen (joins only while the app is on screen)
        return startPresence(me, () => mutate(KEYS.duo))
    }, [ready, me])

    // Double grey tick for the sender: this phone has the messages
    useEffect(() => {
        if (ready) markDelivered(me, messages)
    }, [ready, me, messages])

    // Unread badge on the app icon
    const unread = unreadCount(messages, me)
    useEffect(() => {
        if (ready) setAppBadge(unread)
    }, [ready, unread])

    useEffect(() => {
        if (!ready) return

        const visible = () => document.visibilityState === 'visible'
        const banner = (from: string, text: string, href: string) =>
            showBanner({ from, text, onOpen: () => router.push(href), id: `banner-${href}` })

        const unbindChat = bindChannel('bond-update', {
            'new-note': (msg: ChatMessage) => {
                patchMessages((list) => upsertMessage(list, msg))
                if (msg.senderId === me) return
                if (visible()) {
                    if (pathRef.current !== '/chat') banner(msg.senderId, previewText(msg), '/chat')
                } else if (!pushActive.current) {
                    showOsNotification(msg.senderName, previewText(msg).slice(0, 120), 'chat', '/chat')
                }
            },
            'edit-note': (msg: ChatMessage) => {
                patchMessages((list) => list.map((m) => (m.id === msg.id ? { ...m, ...msg } : m)))
            },
            'delete-note': ({ messageId, deleted }: { messageId: string; deleted?: boolean }) => {
                // "Delete for everyone" leaves a placeholder (older servers removed the row)
                patchMessages((list) => (deleted ? list.map((m) => (m.id === messageId ? asDeleted(m) : m)) : list.filter((m) => m.id !== messageId)))
            },
            'messages-delivered': ({ recipientId, at }: { recipientId: string; at: string }) => {
                if (recipientId === me) return
                patchMessages((list) => list.map((m) => (m.senderId === me && !m.deliveredAt ? { ...m, deliveredAt: at } : m)))
            },
            reaction: ({ messageId, reactions }: { messageId: string; reactions?: Record<string, string> }) => {
                if (!reactions) return
                patchMessages((list) => list.map((m) => (m.id === messageId ? { ...m, reactions } : m)))
            },
            'messages-read': ({ readerId, at }: { readerId: string; at: string }) => {
                if (readerId === me) return
                patchMessages((list) => list.map((m) => (m.senderId === me && !m.readAt ? { ...m, readAt: at, deliveredAt: m.deliveredAt ?? at } : m)))
            },
            mood: ({ senderId, emoji, label }: { senderId: string; emoji: string | null; label: string | null }) => {
                patchCache<DuoMember[]>(KEYS.duo, (list) =>
                    list.map((u) => (u.id === senderId ? { ...u, moodEmoji: emoji, moodLabel: label } : u)),
                )
            },
            profile: () => {
                mutate(KEYS.duo)
            },
            nudge: ({ senderId }: { senderId: string }) => {
                if (senderId !== me && visible()) banner(senderId, 'Sent you a nudge', '/chat')
            },
        })

        const unbindPrayer = bindChannel('duo-prayer', {
            'prayer-update': ({ by, together }: { by: string; together?: boolean }) => {
                if (by === me) return
                mutate((key) => typeof key === 'string' && key.startsWith('/api/prayer?'))
                if (visible() && pathRef.current !== '/prayer') {
                    banner(by, together ? 'Logged that you prayed together' : 'Just prayed', '/prayer')
                }
            },
            'subjects-update': ({ by, action }: { by: string; action: string }) => {
                if (by === me) return
                mutate(KEYS.subjects)
                if (visible() && action === 'create' && pathRef.current !== '/prayer') {
                    banner(by, 'Added a prayer subject', '/prayer')
                }
            },
        })

        const unbindProgress = bindChannel('partner-progress', {
            'log-complete': (data: { userId: string; userName?: string }) => {
                if (data.userId !== me) mutate((key) => typeof key === 'string' && key.startsWith('/api/stats'))
            },
        })

        // Events sent while we were disconnected are lost: refetch on reconnect
        let wasDisconnected = false
        const onState = ({ current }: { current: string }) => {
            if (current === 'connected' && wasDisconnected) {
                mutate(KEYS.messages)
                mutate(KEYS.subjects)
                mutate((key) => typeof key === 'string' && key.startsWith('/api/prayer?'))
            }
            if (current === 'unavailable' || current === 'disconnected') wasDisconnected = true
        }
        pusherClient.connection.bind('state_change', onState)

        return () => {
            unbindChat()
            unbindPrayer()
            unbindProgress()
            pusherClient.connection.unbind('state_change', onState)
        }
    }, [ready, me, partnerName, router])

    return null
}
