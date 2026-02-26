"use client"

import { useEffect, useRef } from 'react'
import { useIdentity } from '@/lib/identity'
import { pusherClient, setPusherUserId } from '@/lib/pusher'
import { showOsNotification, registerServiceWorker, requestNotificationPermission } from '@/lib/notifications'
import { usePathname } from 'next/navigation'

/**
 * Global notification listener — always mounted via layout.tsx.
 * This is the SINGLE SOURCE OF TRUTH for OS/push notifications.
 * Individual pages should only handle in-app toasts and UI updates.
 *
 * 1. Registers the service worker
 * 2. Subscribes to Web Push (for background/closed-app notifications)
 * 3. Subscribes to Pusher channels (for foreground OS notifications)
 * 4. Suppresses OS notifications when user is actively viewing the relevant page
 */
export default function NotificationProvider() {
    const { currentId } = useIdentity()
    const initializedRef = useRef(false)
    const pathname = usePathname()
    const pathnameRef = useRef(pathname)

    // Keep pathname ref in sync without re-subscribing Pusher
    useEffect(() => {
        pathnameRef.current = pathname
    }, [pathname])

    // Register service worker once
    useEffect(() => {
        registerServiceWorker()
    }, [])

    // Subscribe to Web Push + Pusher when we have a user ID
    useEffect(() => {
        if (!currentId || initializedRef.current) return
        initializedRef.current = true

        // Set the userId for Pusher auth requests (presence channels)
        setPusherUserId(currentId)

        // Subscribe to Web Push for background notifications
        subscribeToPush(currentId)

        // --- Pusher: Bond messages & nudges (OS notifications) ---
        const bondChannel = pusherClient.subscribe('bond-update')

        bondChannel.bind('new-note', (newNote: any) => {
            if (newNote.senderId !== currentId) {
                // Suppress OS notification if user is actively on the bond page
                if (document.visibilityState === 'visible' && pathnameRef.current === '/bond') {
                    return
                }
                showOsNotification(`💌 ${newNote.senderName}`, {
                    body: newNote.content?.substring(0, 100) || 'sent a message',
                })
            }
        })

        bondChannel.bind('nudge', (data: any) => {
            if (data.senderId !== currentId) {
                showOsNotification('👋 Nudge!', {
                    body: `${data.senderName} nudged you!`,
                })
            }
        })

        // --- Pusher: Partner progress (OS notifications) ---
        const progressChannel = pusherClient.subscribe('partner-progress')

        progressChannel.bind('log-complete', (data: any) => {
            if (data.userId !== currentId) {
                showOsNotification('🚀 Partner Update', {
                    body: `${data.userName || 'Your partner'} just completed a day!`,
                })
            }
        })

        return () => {
            initializedRef.current = false
            pusherClient.unsubscribe('bond-update')
            pusherClient.unsubscribe('partner-progress')
        }
    }, [currentId])

    return null
}

/**
 * Subscribe the browser to Web Push via the PushManager API.
 * This is what enables notifications when the app is CLOSED.
 */
async function subscribeToPush(userId: string) {
    try {
        // Must have notification permission
        const granted = await requestNotificationPermission()
        if (!granted) {
            console.log('Notification permission denied, skipping push subscription')
            return
        }

        // Need a service worker
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
            console.log('Push not supported in this browser')
            return
        }

        const registration = await navigator.serviceWorker.ready

        // Check if already subscribed
        let subscription = await registration.pushManager.getSubscription()

        if (!subscription) {
            // Get the VAPID public key from env
            const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
            if (!vapidKey) {
                console.error('NEXT_PUBLIC_VAPID_PUBLIC_KEY not set')
                return
            }

            // Convert VAPID key to Uint8Array
            const applicationServerKey = urlBase64ToUint8Array(vapidKey)

            // Subscribe to push
            subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey,
            })

            console.log('Push subscription created')
        }

        // Send subscription to server
        await fetch('/api/push/subscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId,
                subscription: subscription.toJSON(),
            }),
        })

        console.log('Push subscription saved to server')
    } catch (error) {
        console.error('Failed to subscribe to push:', error)
    }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
    const rawData = window.atob(base64)
    const buffer = new ArrayBuffer(rawData.length)
    const outputArray = new Uint8Array(buffer)
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i)
    }
    return outputArray
}
